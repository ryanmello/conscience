from anthropic import AsyncAnthropic
import re

from config.settings import settings
from utils.logger import get_logger

SYSTEM_PROMPT = """You are an AI agent planning assistant. Given a user's request, 
generate a comprehensive plan document for building an AI agent.

The plan should include:
- Agent name and description
- Core capabilities and features
- Input/output specifications
- Data sources needed (if any)
- Success criteria
- Edge cases to handle
- Implementation considerations

Format your response as:
<title>Agent Title Here</title>
<plan>
# Agent Name

## Overview
...

## Core Capabilities
...

## Input/Output Specifications
...

## Data Sources
...

## Success Criteria
...

## Edge Cases
...

## Implementation Notes
...
</plan>
"""

logger = get_logger(__name__)

class PlanService:
    def __init__(self):
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY is not set in environment variables")
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

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
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            result = self._parse_response(response.content[0].text)
            logger.info(f"Generated plan: {result['title']}")
            return result
        except Exception as e:
            logger.error(f"Failed to generate plan: {e}")
            raise

    def _parse_response(self, response: str) -> dict:
        title_match = re.search(r'<title>(.*?)</title>', response, re.DOTALL)
        plan_match = re.search(r'<plan>(.*?)</plan>', response, re.DOTALL)
        
        title = title_match.group(1).strip() if title_match else "Untitled Plan"
        content = plan_match.group(1).strip() if plan_match else response
        
        return {
            "title": title,
            "content": content
        }

plan_service = PlanService()
