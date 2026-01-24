# Follow-Up Questions Feature Plan

## Overview

Add a conversational flow to the plan generation process where the LLM can ask follow-up questions to better understand the user's agent requirements before generating the final document. This focuses on **exploring the agent's functionality**, not learning about the user.

## Current Architecture

```
Frontend (page.tsx)
    ↓ HTTP POST
API (plans.py) → PlanService → Claude API
    ↓
Storage → Return plan
```

## Proposed Architecture

```
Frontend (page.tsx)
    ↓ WebSocket connection
API (plans.py) → LangGraph Agent
    ↓                    ↓
Evaluate Node    Generate Questions Node
    ↓                    ↓
    ←←←←←←←←←←←←←←←←←←←←←
    ↓
Generate Plan Node → Storage → Return plan
```

## Why WebSockets?

Yes, **WebSockets are the right choice** for this feature:

1. **Bidirectional Communication**: The LLM needs to send questions and receive answers in a loop
2. **Real-time Updates**: Users see questions immediately as they're generated
3. **Stateful Conversation**: WebSocket maintains connection during multi-turn dialogue
4. **Already Implemented**: `websocket_service.py` already exists with connection management
5. **Streaming Support**: Can stream partial responses for better UX

HTTP polling would work but adds latency and complexity. Server-Sent Events (SSE) are one-way. WebSockets provide the cleanest solution for conversational flows.

---

## LangGraph Implementation

### Graph State

```python
from typing import TypedDict, List, Literal, Optional
from langgraph.graph import StateGraph, END

class ConversationMessage(TypedDict):
    role: Literal["user", "assistant", "system"]
    content: str

class PlanGenerationState(TypedDict):
    # Core conversation
    messages: List[ConversationMessage]
    original_request: str
    
    # Follow-up tracking
    questions_asked: int
    max_questions: int  # Limit to prevent infinite loops (e.g., 3-5)
    
    # Decision routing
    needs_more_info: bool
    
    # Final output
    plan_title: Optional[str]
    plan_content: Optional[str]
    
    # Session info
    session_id: str
    user_id: str
```

### Graph Nodes

#### 1. Evaluate Node
Decides if we have sufficient information to generate the plan.

```python
async def evaluate_node(state: PlanGenerationState) -> PlanGenerationState:
    """
    Analyze conversation history and determine if we have enough 
    information about the agent's functionality.
    
    Evaluates:
    - Agent's core purpose
    - Input/output specifications
    - Key capabilities and features
    - Integration requirements
    - Success criteria
    
    Returns updated state with needs_more_info flag.
    """
    # Call LLM with evaluation prompt
    # Returns: { needs_more_info: bool, reasoning: str }
```

**Evaluation Prompt Focus Areas:**
- What does the agent do? (core purpose)
- What inputs does it accept?
- What outputs does it produce?
- What are the key capabilities?
- Are there any integrations needed?
- What defines success for this agent?

#### 2. Generate Questions Node
Creates targeted follow-up questions about the agent.

```python
async def generate_questions_node(state: PlanGenerationState) -> PlanGenerationState:
    """
    Generate 1-3 follow-up questions to explore the agent's functionality.
    
    Question types:
    - Capability clarification: "Should the agent also handle X?"
    - Input/Output: "What format should the output be in?"
    - Scope: "Should this be limited to X or include Y?"
    - Edge cases: "How should the agent handle Z scenario?"
    
    Sends questions via WebSocket and waits for response.
    """
```

**Key Principles for Questions:**
- Focus on the **agent**, not the user
- Ask about functionality, not preferences
- Explore capabilities, not personal goals
- Help user discover features they may not have considered

**Example Flow:**
```
User: "I want an agent to help me reach my fitness goals"

Questions:
1. "What specific fitness-related tasks should this agent handle? 
   (e.g., workout planning, nutrition tracking, progress monitoring)"
2. "Should the agent integrate with any external services like 
   fitness trackers, nutrition databases, or workout apps?"
3. "What format should the agent use to communicate? 
   (e.g., structured plans, conversational suggestions, data visualizations)"
```

#### 3. Wait for Response Node
Waits for user input via WebSocket.

```python
async def wait_for_response_node(state: PlanGenerationState) -> PlanGenerationState:
    """
    Send questions to frontend via WebSocket.
    Wait for user response.
    Append response to messages.
    Increment questions_asked counter.
    """
```

#### 4. Generate Plan Node
Creates the final plan document.

```python
async def generate_plan_node(state: PlanGenerationState) -> PlanGenerationState:
    """
    Using all gathered context, generate the comprehensive plan document.
    Uses existing plan generation logic but with enriched context.
    """
```

### Graph Structure

```python
from langgraph.graph import StateGraph, END

def create_plan_graph():
    graph = StateGraph(PlanGenerationState)
    
    # Add nodes
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("generate_questions", generate_questions_node)
    graph.add_node("wait_for_response", wait_for_response_node)
    graph.add_node("generate_plan", generate_plan_node)
    
    # Set entry point
    graph.set_entry_point("evaluate")
    
    # Add conditional edges
    graph.add_conditional_edges(
        "evaluate",
        route_after_evaluation,
        {
            "needs_questions": "generate_questions",
            "ready_to_generate": "generate_plan"
        }
    )
    
    graph.add_edge("generate_questions", "wait_for_response")
    graph.add_edge("wait_for_response", "evaluate")  # Loop back
    graph.add_edge("generate_plan", END)
    
    return graph.compile()

def route_after_evaluation(state: PlanGenerationState) -> str:
    # Check if we've hit the question limit
    if state["questions_asked"] >= state["max_questions"]:
        return "ready_to_generate"
    
    if state["needs_more_info"]:
        return "needs_questions"
    
    return "ready_to_generate"
```

### Visual Graph Flow

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
             ┌──────│  Evaluate   │◄─────────────┐
             │      └──────┬──────┘              │
             │             │                     │
    needs_questions   ready_to_generate          │
             │             │                     │
             ▼             ▼                     │
    ┌─────────────┐  ┌─────────────┐            │
    │  Generate   │  │  Generate   │            │
    │  Questions  │  │    Plan     │            │
    └──────┬──────┘  └──────┬──────┘            │
           │                │                   │
           ▼                ▼                   │
    ┌─────────────┐  ┌─────────────┐            │
    │   Wait For  │  │     END     │            │
    │  Response   │──────────────────────────────┘
    └─────────────┘
```

---

## WebSocket Message Protocol

### Message Types

#### Server → Client (Backend to Frontend)

```typescript
// Follow-up questions
{
  type: "questions",
  session_id: string,
  questions: Array<{
    id: string,
    text: string,
    type: "open" | "multiple_choice",
    options?: string[]  // For multiple choice
  }>,
  context: string,  // Brief explanation of why asking
  progress: {
    questions_asked: number,
    max_questions: number
  }
}

// Status updates
{
  type: "status",
  session_id: string,
  status: "evaluating" | "generating_questions" | "waiting" | "generating_plan",
  message: string
}

// Plan complete
{
  type: "plan_complete",
  session_id: string,
  plan: {
    plan_id: string,
    title: string,
    content: string,
    document_url: string
  }
}

// Error
{
  type: "error",
  session_id: string,
  error: string
}
```

#### Client → Server (Frontend to Backend)

```typescript
// Initial request
{
  type: "start_plan",
  prompt: string
}

// Answer to follow-up questions
{
  type: "answer",
  session_id: string,
  answers: Array<{
    question_id: string,
    response: string
  }>
}

// Skip remaining questions
{
  type: "skip_questions",
  session_id: string
}
```

---

## Implementation Steps

### Phase 1: Backend Infrastructure

#### 1.1 Install LangGraph
```bash
uv add langgraph langchain-anthropic
```

#### 1.2 Create LangGraph Service
Create `services/langgraph_service.py`:

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional, Literal
import asyncio

class PlanGenerationState(TypedDict):
    messages: List[dict]
    original_request: str
    questions_asked: int
    max_questions: int
    needs_more_info: bool
    plan_title: Optional[str]
    plan_content: Optional[str]
    session_id: str
    user_id: str
    pending_questions: Optional[List[dict]]

class LangGraphService:
    def __init__(self):
        self.graph = self._build_graph()
        self.pending_responses: dict[str, asyncio.Event] = {}
        self.response_data: dict[str, dict] = {}
    
    def _build_graph(self) -> StateGraph:
        # Build the graph as described above
        pass
    
    async def start_session(self, session_id: str, prompt: str, user_id: str):
        # Initialize state and start graph execution
        pass
    
    async def submit_response(self, session_id: str, answers: List[dict]):
        # Resume graph with user response
        pass

langgraph_service = LangGraphService()
```

#### 1.3 Update WebSocket Service
Add session-based message handling in `services/websocket_service.py`:

```python
async def send_questions(self, session_id: str, questions: List[dict], context: str):
    """Send follow-up questions to the frontend"""
    message = {
        "type": "questions",
        "session_id": session_id,
        "questions": questions,
        "context": context
    }
    await self.send_message(session_id, message)

async def send_status(self, session_id: str, status: str, message: str):
    """Send status update to frontend"""
    await self.send_message(session_id, {
        "type": "status",
        "session_id": session_id,
        "status": status,
        "message": message
    })
```

#### 1.4 Create WebSocket Endpoint
Update `api/plans.py`:

```python
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/ws/generate")
async def websocket_generate_plan(
    websocket: WebSocket,
    user = Depends(get_current_user_ws)
):
    session_id = str(uuid4())
    await websocket_service.connect_websocket(session_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "start_plan":
                await langgraph_service.start_session(
                    session_id=session_id,
                    prompt=data["prompt"],
                    user_id=str(user.id)
                )
            
            elif data["type"] == "answer":
                await langgraph_service.submit_response(
                    session_id=session_id,
                    answers=data["answers"]
                )
            
            elif data["type"] == "skip_questions":
                await langgraph_service.skip_to_generation(session_id)
                
    except WebSocketDisconnect:
        await websocket_service.disconnect_websocket(session_id)
```

### Phase 2: LangGraph Nodes Implementation

#### 2.1 Evaluation Prompt

```python
EVALUATION_PROMPT = """You are evaluating whether you have enough information to create 
a comprehensive AI agent plan. Focus ONLY on understanding the agent's functionality.

Current conversation:
{conversation}

Evaluate if you understand:
1. The agent's core purpose and main function
2. What inputs the agent will accept
3. What outputs the agent will produce
4. Key capabilities and features required
5. Any integrations or data sources needed

DO NOT ask about:
- The user's personal preferences or background
- Why they want the agent
- Their skill level or experience

Respond in JSON:
{
  "needs_more_info": true/false,
  "understood_aspects": ["list of aspects you understand"],
  "missing_aspects": ["list of aspects that need clarification"],
  "reasoning": "brief explanation"
}
"""
```

#### 2.2 Question Generation Prompt

```python
QUESTION_GENERATION_PROMPT = """Based on the conversation so far, generate 1-3 follow-up 
questions to better understand the AI agent the user wants to build.

Current conversation:
{conversation}

Missing information:
{missing_aspects}

Guidelines:
- Focus on the AGENT's functionality, not the user
- Ask about capabilities, inputs, outputs, and integrations
- Help the user explore features they may not have considered
- Be specific but not overwhelming
- Frame questions as exploring possibilities, not interrogating

Respond in JSON:
{
  "context": "Brief explanation of why you're asking (1 sentence)",
  "questions": [
    {
      "id": "q1",
      "text": "Question text",
      "type": "open",
      "purpose": "What this helps clarify"
    }
  ]
}
"""
```

### Phase 3: Frontend Updates

#### 3.1 Update Message Types
In `page.tsx`:

```typescript
type Message = 
  | { type: "user"; content: string }
  | { type: "loading"; status?: string }
  | { type: "questions"; questions: Question[]; context: string }
  | { type: "response"; plan: GeneratePlanResult; isExpanded: boolean };

interface Question {
  id: string;
  text: string;
  type: "open" | "multiple_choice";
  options?: string[];
}
```

#### 3.2 WebSocket Hook
Create `hooks/use-plan-websocket.ts`:

```typescript
export function usePlanWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/api/plans/ws/generate`);
    // Handle connection, messages, errors
  }, []);
  
  const startPlan = useCallback((prompt: string) => {
    socket?.send(JSON.stringify({ type: "start_plan", prompt }));
  }, [socket]);
  
  const answerQuestions = useCallback((answers: Answer[]) => {
    socket?.send(JSON.stringify({ 
      type: "answer", 
      session_id: sessionId,
      answers 
    }));
  }, [socket, sessionId]);
  
  return { connect, startPlan, answerQuestions, sessionId };
}
```

#### 3.3 Question Response Component
Create a new component for displaying and answering questions:

```typescript
function QuestionResponse({ 
  questions, 
  context, 
  onSubmit 
}: {
  questions: Question[];
  context: string;
  onSubmit: (answers: Answer[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <p className="text-sm text-muted-foreground mb-4">{context}</p>
      {questions.map(q => (
        <div key={q.id} className="mb-4">
          <label className="block text-sm font-medium mb-2">{q.text}</label>
          <Textarea 
            value={answers[q.id] || ""}
            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
          />
        </div>
      ))}
      <Button onClick={() => onSubmit(Object.entries(answers).map(([id, response]) => ({ question_id: id, response })))}>
        Continue
      </Button>
    </div>
  );
}
```

---

## File Changes Summary

### New Files
- `services/langgraph_service.py` - LangGraph agent implementation
- `ui/hooks/use-plan-websocket.ts` - WebSocket hook for frontend
- `ui/components/QuestionResponse.tsx` - Question display/answer component

### Modified Files
- `services/websocket_service.py` - Add question-specific helper methods
- `services/plan_service.py` - Refactor to work with LangGraph (may become part of langgraph_service)
- `api/plans.py` - Add WebSocket endpoint, update HTTP endpoint
- `ui/app/build/page.tsx` - Integrate WebSocket, add question handling

### Dependencies
```bash
# Backend
uv add langgraph langchain-anthropic

# Frontend (if not already installed)
# No new dependencies needed - using native WebSocket API
```

---

## Configuration

### Environment Variables
```bash
# Already have ANTHROPIC_API_KEY
# Add for LangGraph if needed:
MAX_FOLLOWUP_QUESTIONS=5  # Limit question rounds
```

### Settings
Update `config/settings.py`:
```python
MAX_FOLLOWUP_QUESTIONS: int = int(os.getenv("MAX_FOLLOWUP_QUESTIONS", "5"))
```

---

## Edge Cases & Error Handling

1. **WebSocket disconnection mid-conversation**: Save state to allow reconnection
2. **User skips all questions**: Proceed with best-effort plan
3. **LLM keeps asking questions**: Enforce max_questions limit
4. **Timeout on user response**: Send reminder, eventual timeout
5. **Empty answers**: Accept and proceed (some info is better than none)

---

## Testing Strategy

1. **Unit Tests**: Test each LangGraph node independently
2. **Integration Tests**: Test full graph execution with mocked LLM
3. **WebSocket Tests**: Test message protocol compliance
4. **E2E Tests**: Full flow from UI to plan generation

---

## Future Enhancements

1. **Streaming responses**: Stream LLM thinking process
2. **Question suggestions**: Provide example answers
3. **Conversation branching**: Allow going back to previous questions
4. **Template suggestions**: Based on similar agents
5. **Progress persistence**: Resume interrupted conversations
