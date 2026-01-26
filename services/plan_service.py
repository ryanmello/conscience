import json
import re
from typing import List, Literal, Optional, TypedDict

from anthropic import AsyncAnthropic
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command

from config.prompts import (
    PLAN_SERVICE_SYSTEM_PROMPT,
    EVALUATE_CONTEXT_PROMPT,
    GENERATE_QUESTIONS_PROMPT,
    GENERATE_PLAN_PROMPT,
)
from config.settings import settings
from services.websocket_service import websocket_service
from services.storage_service import storage_service
from utils.logger import get_logger

logger = get_logger(__name__)

class ConversationMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str

class PlanGenerationState(TypedDict):
    # Conversation history
    messages: List[ConversationMessage]
    
    # Follow-up tracking
    questions_asked: int
    
    # Decision routing (set by evaluate_node)
    needs_more_info: bool
    
    # Current questions (set by generate_questions_node)
    current_questions: Optional[List[dict]]
    
    # Final output
    plan_title: Optional[str]
    plan_content: Optional[str]
    
    # Session info
    session_id: str
    user_id: str

class PlanService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.checkpointer = MemorySaver()
        self.graph = self.create_plan_graph()

    def format_messages(self, messages: List[ConversationMessage]) -> str:
        """Format messages for prompt injection."""
        formatted = []
        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            formatted.append(f"{role}: {msg['content']}")
        return "\n\n".join(formatted)

    def extract_json(self, text: str) -> dict:
        """
        Extract JSON from LLM response that may contain markdown code blocks.
        Handles responses like:
        - Pure JSON: {"key": "value"}
        - Markdown wrapped: ```json\n{"key": "value"}\n```
        - Text before/after JSON
        """
        # First, try to parse as-is
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            pass
        
        # Try to extract from markdown code blocks
        # Match ```json ... ``` or ``` ... ```
        code_block_pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
        matches = re.findall(code_block_pattern, text, re.DOTALL)
        for match in matches:
            try:
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue
        
        # Try to find JSON object by looking for { ... }
        json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.findall(json_pattern, text, re.DOTALL)
        for match in matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        
        # Last resort: try to find the largest {...} block
        start = text.find('{')
        if start != -1:
            # Find matching closing brace
            depth = 0
            for i, char in enumerate(text[start:], start):
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            break
        
        # If all else fails, raise an error with context
        logger.error(f"Failed to extract JSON from response: {text[:500]}...")
        raise json.JSONDecodeError("Could not extract valid JSON from response", text, 0)

    async def call_llm(self, system_prompt: str, user_message: str) -> str:
        """Make an LLM call and return the response text."""
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )
        return response.content[0].text

    async def evaluate_node(self, state: PlanGenerationState) -> dict:
        """
        Analyze conversation history and determine if we have enough 
        information about the agent's functionality.
        """
        logger.info(f"[{state['session_id']}] Evaluating context...")
        
        # Send status update
        await websocket_service.send_message(state["session_id"], {
            "type": "status",
            "status": "evaluating",
            "message": "Analyzing your request..."
        })
        
        formatted_messages = self.format_messages(state["messages"])
        prompt = EVALUATE_CONTEXT_PROMPT.format(messages=formatted_messages)
        
        try:
            response = await self.call_llm(
                "You are an evaluation assistant. Respond only in valid JSON.",
                prompt
            )
            
            # Parse JSON response (handles markdown code blocks)
            result = self.extract_json(response)
            needs_more_info = result.get("needs_more_info", False)
            gaps = result.get("gaps", [])
            
            logger.info(f"[{state['session_id']}] Evaluation: needs_more_info={needs_more_info}")
            
            return {
                "needs_more_info": needs_more_info,
                "gaps": gaps  # Internal use for question generation
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"[{state['session_id']}] Evaluation failed: {e}")
            # On error, proceed to generate plan with what we have
            return {"needs_more_info": False}

    async def generate_questions_node(self, state: PlanGenerationState) -> dict:
        """
        Generate 1-3 follow-up questions to explore the agent's functionality.
        """
        logger.info(f"[{state['session_id']}] Generating follow-up questions...")
        
        await websocket_service.send_message(state["session_id"], {
            "type": "status",
            "status": "generating_questions",
            "message": "Preparing follow-up questions..."
        })
        
        formatted_messages = self.format_messages(state["messages"])
        gaps = state.get("gaps", ["General clarification needed"])
        
        prompt = GENERATE_QUESTIONS_PROMPT.format(
            messages=formatted_messages,
            gaps=json.dumps(gaps)
        )
        
        try:
            response = await self.call_llm(
                "You are a question generation assistant. Respond only in valid JSON.",
                prompt
            )
            
            # Parse JSON response (handles markdown code blocks)
            result = self.extract_json(response)
            questions = result.get("questions", [])
            
            logger.info(f"[{state['session_id']}] Generated {len(questions)} questions")
            
            return {"current_questions": questions}
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"[{state['session_id']}] Question generation failed: {e}")
            # On error, proceed without questions
            return {"current_questions": [], "needs_more_info": False}

    async def wait_for_response_node(self, state: PlanGenerationState) -> dict:
        """
        Send questions to frontend via WebSocket and wait for user response.
        Uses LangGraph's interrupt() to pause execution.
        """
        questions = state.get("current_questions", [])
        session_id = state["session_id"]
        
        if not questions:
            # No questions to ask, continue to plan generation
            return {"needs_more_info": False}
        
        # Send questions to user via WebSocket
        for question in questions:
            await websocket_service.send_message(session_id, {
                "type": "question",
                "question": question,
                "progress": {
                    "round": state["questions_asked"] + 1,
                    "max_rounds": settings.MAX_FOLLOWUP_QUESTIONS
                }
            })
        
        logger.info(f"[{session_id}] Waiting for user response (interrupt)...")
        
        # Interrupt and wait for user response
        # The interrupt() call pauses the graph and returns the questions
        # When resumed with Command(resume=response), the response is returned here
        user_response = interrupt(questions)
        
        logger.info(f"[{session_id}] Received user response, resuming graph...")
        
        # Append user response to messages
        new_messages = state["messages"] + [
            {"role": "assistant", "content": f"Questions: {json.dumps([q['text'] for q in questions])}"},
            {"role": "user", "content": user_response}
        ]
        
        return {
            "messages": new_messages,
            "questions_asked": state["questions_asked"] + 1,
            "current_questions": None
        }

    async def generate_plan_node(self, state: PlanGenerationState) -> dict:
        """
        Generate the comprehensive plan document using all gathered context.
        """
        session_id = state["session_id"]
        logger.info(f"[{session_id}] Generating plan document...")
        
        await websocket_service.send_message(session_id, {
            "type": "status",
            "status": "generating",
            "message": "Generating your plan document..."
        })
        
        formatted_messages = self.format_messages(state["messages"])
        prompt = GENERATE_PLAN_PROMPT.format(messages=formatted_messages)
        
        try:
            response = await self.call_llm(
                "You are a plan generation assistant. Respond only in valid JSON.",
                prompt
            )
            
            # Parse JSON response (handles markdown code blocks)
            result = self.extract_json(response)
            title = result.get("title", "Untitled Plan")
            content = result.get("content", "")
            
            logger.info(f"[{session_id}] Generated plan: {title}")
            
            # Upload to storage
            file_path = storage_service.upload_plan_document(
                user_id=state["user_id"],
                plan_id=session_id,
                content=content
            )
            document_url = storage_service.get_signed_url(file_path)
            
            # Send document to frontend
            await websocket_service.send_message(session_id, {
                "type": "document.update",
                "document": {
                    "title": title,
                    "content": content,
                    "url": document_url,
                    "version": 1
                }
            })
            
            # Send ready for approval
            await websocket_service.send_message(session_id, {
                "type": "ready_for_approval",
                "message": "Your plan document is ready. Review and approve to continue."
            })
            
            return {
                "plan_title": title,
                "plan_content": content
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"[{session_id}] Plan generation failed: {e}")
            await websocket_service.send_error(session_id, f"Failed to generate plan: {str(e)}")
            raise

    def route_after_evaluation(self, state: PlanGenerationState) -> str:
        """Determine next node after evaluation."""
        # Check if we've hit the question limit
        if state["questions_asked"] >= settings.MAX_FOLLOWUP_QUESTIONS:
            logger.info(f"[{state['session_id']}] Max questions reached, generating plan")
            return "generate_plan"
        
        # Check if we need more info
        if state.get("needs_more_info", False):
            return "generate_questions"
        
        return "generate_plan"

    def create_plan_graph(self):
        """Create and compile the LangGraph state machine."""
        graph = StateGraph(PlanGenerationState)
        
        # Add nodes
        graph.add_node("evaluate", self.evaluate_node)
        graph.add_node("generate_questions", self.generate_questions_node)
        graph.add_node("wait_for_response", self.wait_for_response_node)
        graph.add_node("generate_plan", self.generate_plan_node)
        
        # Set entry point
        graph.set_entry_point("evaluate")
        
        # Add conditional edges from evaluate
        graph.add_conditional_edges(
            "evaluate",
            self.route_after_evaluation,
            {
                "generate_questions": "generate_questions",
                "generate_plan": "generate_plan"
            }
        )
        
        # Linear edges
        graph.add_edge("generate_questions", "wait_for_response")
        graph.add_edge("wait_for_response", "evaluate")  # Loop back to evaluate
        graph.add_edge("generate_plan", END)
        
        # Compile with checkpointer for interrupt support
        return graph.compile(checkpointer=self.checkpointer)

    async def develop_plan(self, session_id: str, prompt: str, user_id: str) -> dict:
        """
        Start plan development with the initial user prompt.
        The graph will run until it either completes or hits an interrupt.
        """
        logger.info(f"[{session_id}] Starting plan development...")
        
        initial_state: PlanGenerationState = {
            "messages": [{"role": "user", "content": prompt}],
            "questions_asked": 0,
            "needs_more_info": False,
            "current_questions": None,
            "plan_title": None,
            "plan_content": None,
            "session_id": session_id,
            "user_id": user_id,
        }
        
        config = {"configurable": {"thread_id": session_id}}
        
        try:
            # Run the graph - will pause at interrupt() if questions needed
            result = await self.graph.ainvoke(initial_state, config)
            return result
        except Exception as e:
            logger.error(f"[{session_id}] Plan development failed: {e}")
            await websocket_service.send_error(session_id, f"Plan development failed: {str(e)}")
            raise

    async def update_plan(self, session_id: str, response: str) -> dict:
        """
        Resume plan development with user's response to follow-up questions.
        """
        logger.info(f"[{session_id}] Resuming with user response...")
        
        config = {"configurable": {"thread_id": session_id}}
        
        try:
            # Resume the graph with the user's response
            result = await self.graph.ainvoke(Command(resume=response), config)
            return result
        except Exception as e:
            logger.error(f"[{session_id}] Plan update failed: {e}")
            await websocket_service.send_error(session_id, f"Plan update failed: {str(e)}")
            raise

    async def generate(self, prompt: str) -> dict:
        """
        Generate a complete plan document from user prompt.
        Returns: { "title": str, "content": str }
        """
        logger.info(f"Generating plan for prompt: {prompt[:100]}...")
        
        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=PLAN_SERVICE_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            result = self.parse_response(response.content[0].text)
            logger.info(f"Generated plan: {result['title']}")
            return result
        except Exception as e:
            logger.error(f"Failed to generate plan: {e}")
            raise

    def parse_response(self, response: str) -> dict:
        title_match = re.search(r'<title>(.*?)</title>', response, re.DOTALL)
        plan_match = re.search(r'<plan>(.*?)</plan>', response, re.DOTALL)
        
        title = title_match.group(1).strip() if title_match else "Untitled Plan"
        content = plan_match.group(1).strip() if plan_match else response
        
        return {
            "title": title,
            "content": content
        }

plan_service = PlanService()
