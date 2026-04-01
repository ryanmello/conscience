PLAN_SERVICE_SYSTEM_PROMPT = """You are an AI agent planning assistant. Given a user's request, 
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

EVALUATE_CONTEXT_PROMPT = """You are an AI agent planning assistant. Analyze the conversation history 
and determine if you have enough information to create a comprehensive agent plan.

## Conversation History
{messages}

## Evaluation Criteria
You have ENOUGH information if you understand:
1. The agent's core purpose and what problem it solves
2. Key capabilities and features the agent should have
3. Input sources and output formats
4. Any integrations or external services needed

You NEED MORE information if:
1. The core functionality is vague or ambiguous
2. Input/output specifications are unclear
3. Important capability decisions haven't been made
4. Integration requirements are unknown

Respond in JSON format:
{{
  "needs_more_info": true/false,
  "reasoning": "Brief explanation of what's clear vs unclear",
  "gaps": ["list", "of", "information", "gaps"] // empty if needs_more_info is false
}}
"""

GENERATE_QUESTIONS_PROMPT = """You are an AI agent planning assistant. Based on the conversation history 
and identified gaps, generate 1-3 focused follow-up questions to better understand the agent requirements.

## Conversation History
{messages}

## Information Gaps
{gaps}

## Question Guidelines
- Focus on the AGENT's functionality, not the user's background
- Ask about capabilities, inputs, outputs, and integrations
- Be specific and actionable
- Avoid yes/no questions when possible

DO NOT ask about:
- The user's personal preferences or experience level
- Why they want to build this agent
- Their technical background

Respond in JSON format:
{{
  "questions": [
    {{
      "id": "q1",
      "text": "Question text here"
    }}
  ]
}}
"""

GENERATE_PLAN_PROMPT = """You are an AI agent planning assistant. Using the complete conversation history, 
generate a comprehensive plan document for building an AI agent.

## Conversation History
{messages}

## Instructions
Create a detailed plan document that incorporates all the information gathered from the conversation.
The document should be actionable and complete.

Respond in JSON format:
{{
  "title": "Agent Name",
  "content": "Full markdown document content..."
}}

The content should follow this structure:
# Agent Name

## Overview
A clear description of what this agent does and the problem it solves.

## Core Capabilities
- Capability 1: Description
- Capability 2: Description

## Input/Output Specifications
### Inputs
- Input source and format

### Outputs
- Output format and destination

## Data Sources
- External APIs, databases, or services needed

## Success Criteria
- How to measure if the agent is working correctly

## Edge Cases
- Potential failure scenarios and how to handle them

## Implementation Notes
- Technical considerations and recommendations
"""

# ---------------------------------------------------------------------------
# Code Generation Prompts
# ---------------------------------------------------------------------------

CODEGEN_MANIFEST_PROMPT = """You are a code generation assistant. Given an agent plan document, 
determine the list of files that need to be created to implement this agent.

## Agent Plan
{plan_content}

## Instructions
Analyze the plan and produce a JSON manifest of the files the project needs.
Each entry must include:
- `path`: relative file path (e.g. "agent.py", "utils.py", "requirements.txt")
- `description`: one-sentence summary of what the file does
- `language`: the programming language or file type ("python", "json", "text", "yaml", etc.)

IMPORTANT CONSTRAINTS:
- Keep the project FLAT — do NOT create nested directory structures (no src/, no packages).
  All Python files should live in the project root.
- Target 5-12 files maximum. Consolidate related functionality into single files rather than 
  splitting into many small modules. Fewer, larger files are better than many tiny ones.
- Every project MUST include exactly these two files:
  1. `main.py` — the entry point that runs the agent end-to-end
  2. `requirements.txt` — all pip dependencies with version pins

Respond ONLY in valid JSON:
{{
  "files": [
    {{"path": "main.py", "description": "Entry point that runs the agent", "language": "python"}},
    ...
  ],
  "entry_point": "main.py"
}}
"""

CODEGEN_SKELETON_PROMPT = """You are a code generation assistant. Given an agent plan and a file 
manifest, produce a MINIMAL contract skeleton for the entire project.

## Agent Plan
{plan_content}

## File Manifest
{manifest}

## Instructions
Produce the shortest possible skeleton that defines the API surface for every file.

STRICT RULES — follow these exactly:
- Python files: ONLY imports, class names, and function signatures with type hints. 
  Use `pass` for ALL bodies. NO docstrings. NO comments. NO default values. NO constants.
  NO example code. NO logging setup. NO error handling logic.
- requirements.txt: one package per line, with version pin. Nothing else.
- JSON/YAML/config files: minimal valid structure only.
- README.md: skip entirely (generate directly in implementation pass).

EXAMPLE of correct Python skeleton density:

--- FILE: agent.py ---
import os
from gmail_client import GmailClient

class Agent:
    def __init__(self, config: dict) -> None: pass
    def run(self) -> None: pass
    def process_email(self, email_id: str) -> dict: pass

The entire skeleton for a 10-file project should be under 150 lines total.
Do NOT skip any file from the manifest (except README.md).

Output ALL files concatenated with clear delimiters:

--- FILE: filename.py ---
<skeleton>
"""

CODEGEN_IMPLEMENT_FILE_PROMPT = """You are a code generation assistant. Implement a single file 
for an AI agent project.

## Project Skeleton (contract)
{skeleton}

## File to Implement
Path: {file_path}
Description: {file_description}

## Instructions
Write a CONCISE, WORKING implementation for this file.

Rules:
- Produce ONLY the file content — no markdown fences, no commentary.
- Import from sibling files exactly as shown in the skeleton contract.
- Implement every function body from the skeleton (replace `pass` with real logic).
- Keep the code SHORT and FUNCTIONAL. Aim for 50-150 lines per file.
- Do NOT add extra classes, methods, or utilities beyond what the skeleton defines.
- Do NOT add extensive error handling, logging, or retry logic unless essential.
- Do NOT write docstrings or inline comments.
"""

CODEGEN_VALIDATE_PROMPT = """You are a code review assistant. Review the following set of 
generated files for an AI agent project and check for inter-file consistency.

## Agent Plan
{plan_content}

## Generated Files
{files}

## Checks
1. All imports between files resolve correctly (no missing modules).
2. Function signatures match across call sites.
3. The entry point (`{entry_point}`) can actually run the agent end-to-end.
4. `requirements.txt` includes every third-party package used in the code.
5. No placeholder or stub code remains (no `pass` or `...` in function bodies).

Respond in JSON:
{{
  "valid": true/false,
  "issues": [
    {{"file": "path", "line_hint": "function or class name", "issue": "description"}}
  ]
}}

If everything looks correct, return {{"valid": true, "issues": []}}.
"""

CODEGEN_MODIFY_FILES_PROMPT = """You are a code modification assistant. The user wants to make 
changes to an existing AI agent project.

## User Request
{user_request}

## Current File Contents
{file_contents}

## Project Skeleton (all files for context)
{skeleton}

## Instructions
Apply the user's requested changes to the relevant files. Return the FULL updated content for 
each file that needs to change.

Respond in JSON:
{{
  "modified_files": [
    {{"path": "file/path.py", "content": "full updated file content", "language": "python"}}
  ],
  "summary": "Brief description of what was changed"
}}
"""