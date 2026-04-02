import asyncio
import json
import re
from typing import List, Optional, TypedDict
from uuid import UUID

from anthropic import AsyncAnthropic
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session

from config.prompts import (
    CODEGEN_MANIFEST_PROMPT,
    CODEGEN_SKELETON_PROMPT,
    CODEGEN_IMPLEMENT_FILE_PROMPT,
    CODEGEN_VALIDATE_PROMPT,
    CODEGEN_FIX_BATCH_PROMPT,
)
from config.settings import settings
from models.agent_file import AgentFile
from services.websocket_service import websocket_service
from utils.logger import get_logger

logger = get_logger(__name__)

CODEGEN_MODEL = "claude-sonnet-4-20250514"
MAX_CONCURRENT_FILES = 4
MAX_FIX_ITERATIONS = 1

class FileManifestEntry(TypedDict):
    path: str
    description: str
    language: str


class GeneratedFile(TypedDict):
    path: str
    content: str
    language: str


class CodeGenState(TypedDict):
    agent_id: str
    user_id: str
    session_id: str
    plan_content: str
    file_manifest: List[FileManifestEntry]
    entry_point: str
    skeleton_output: str
    current_file_index: int
    generated_files: List[GeneratedFile]
    messages: List[dict]
    error: Optional[str]
    validation_issues: List[dict]
    fix_iteration: int
    max_fix_iterations: int


class CodeGenService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    def extract_json(self, text: str) -> dict:
        cleaned = text.strip()

        # Strip markdown code fences if present
        if cleaned.startswith("```"):
            first_newline = cleaned.find("\n")
            if first_newline != -1:
                cleaned = cleaned[first_newline + 1:]
            if cleaned.rstrip().endswith("```"):
                cleaned = cleaned.rstrip()[:-3].rstrip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Brace-matching fallback: find outermost { ... }
        start = cleaned.find('{')
        if start != -1:
            depth = 0
            for i, char in enumerate(cleaned[start:], start):
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(cleaned[start:i + 1])
                        except json.JSONDecodeError:
                            break

        logger.error(f"Failed to extract JSON from response: {text[:500]}...")
        raise json.JSONDecodeError("Could not extract valid JSON from response", text, 0)

    async def call_llm(self, system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
        response = await self.client.messages.create(
            model=CODEGEN_MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )
        return response.content[0].text

    @staticmethod
    def _strip_fences(text: str) -> str:
        content = text.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines)
        return content

    # ---- LangGraph Nodes ----

    async def parse_plan_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]
        logger.info(f"[{session_id}] Parsing plan...")

        await websocket_service.send_message(session_id, {
            "type": "codegen.status",
            "status": "parsing_plan"
        })

        return {}

    async def generate_manifest_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]
        logger.info(f"[{session_id}] Generating file manifest...")

        await websocket_service.send_message(session_id, {
            "type": "codegen.status",
            "status": "generating_manifest"
        })

        prompt = CODEGEN_MANIFEST_PROMPT.format(plan_content=state["plan_content"])

        try:
            response = await self.call_llm(
                "You are a code architecture assistant. Respond only in valid JSON.",
                prompt
            )
            result = self.extract_json(response)
            files = result.get("files", [])
            entry_point = result.get("entry_point", "main.py")

            logger.info(f"[{session_id}] Manifest: {len(files)} files, entry_point={entry_point}")

            await websocket_service.send_message(session_id, {
                "type": "codegen.manifest",
                "files": [{"path": f["path"], "description": f["description"]} for f in files]
            })

            return {
                "file_manifest": files,
                "entry_point": entry_point,
            }
        except Exception as e:
            logger.error(f"[{session_id}] Manifest generation failed: {e}")
            await websocket_service.send_message(session_id, {
                "type": "codegen.error",
                "message": f"Failed to generate file manifest: {e}"
            })
            return {"error": str(e)}

    async def generate_skeletons_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]

        if state.get("error"):
            return {}

        logger.info(f"[{session_id}] Generating skeleton contract...")

        await websocket_service.send_message(session_id, {
            "type": "codegen.status",
            "status": "generating_skeletons"
        })

        manifest_str = json.dumps(state["file_manifest"], indent=2)
        prompt = CODEGEN_SKELETON_PROMPT.format(
            plan_content=state["plan_content"],
            manifest=manifest_str
        )

        try:
            response = await self.call_llm(
                "You are a code generation assistant. Produce the most minimal skeleton possible. Signatures and pass only.",
                prompt,
                max_tokens=4096
            )

            logger.info(f"[{session_id}] Skeleton contract generated ({len(response)} chars)")

            await websocket_service.send_message(session_id, {
                "type": "codegen.skeletons",
                "content": response
            })

            return {
                "skeleton_output": response,
                "current_file_index": 0,
                "generated_files": [],
            }
        except Exception as e:
            logger.error(f"[{session_id}] Skeleton generation failed: {e}")
            await websocket_service.send_message(session_id, {
                "type": "codegen.error",
                "message": f"Failed to generate skeletons: {e}"
            })
            return {"error": str(e)}

    async def _generate_single_file(
        self,
        session_id: str,
        file_entry: FileManifestEntry,
        idx: int,
        total: int,
        skeleton: str,
        semaphore: asyncio.Semaphore,
    ) -> GeneratedFile:
        async with semaphore:
            file_path = file_entry["path"]
            logger.info(f"[{session_id}] Generating file {idx + 1}/{total}: {file_path}")

            await websocket_service.send_message(session_id, {
                "type": "codegen.file_start",
                "path": file_path,
                "index": idx,
                "total": total
            })

            prompt = CODEGEN_IMPLEMENT_FILE_PROMPT.format(
                skeleton=skeleton,
                file_path=file_path,
                file_description=file_entry["description"]
            )

            response = await self.call_llm(
                "You are a code implementation assistant. Output ONLY the file content, no markdown fences or commentary.",
                prompt,
                max_tokens=4096
            )

            content = self._strip_fences(response)

            await websocket_service.send_message(session_id, {
                "type": "codegen.file_complete",
                "path": file_path,
                "content": content,
                "language": file_entry.get("language", "python"),
                "index": idx,
                "total": total,
            })

            logger.info(f"[{session_id}] File complete: {file_path} ({len(content)} chars)")

            return GeneratedFile(
                path=file_path,
                content=content,
                language=file_entry.get("language", "python"),
            )

    async def generate_all_files_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]

        if state.get("error"):
            return {}

        manifest = state["file_manifest"]
        skeleton = state["skeleton_output"]
        total = len(manifest)

        logger.info(f"[{session_id}] Generating {total} files concurrently (max {MAX_CONCURRENT_FILES} at a time)")

        await websocket_service.send_message(session_id, {
            "type": "codegen.status",
            "status": "generating_files"
        })

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_FILES)

        tasks = [
            self._generate_single_file(session_id, entry, idx, total, skeleton, semaphore)
            for idx, entry in enumerate(manifest)
        ]

        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            generated: List[GeneratedFile] = []
            for r in results:
                if isinstance(r, Exception):
                    logger.error(f"[{session_id}] File generation failed: {r}")
                else:
                    generated.append(r)

            if not generated:
                return {"error": "All file generations failed"}

            return {
                "generated_files": generated,
                "current_file_index": total,
            }

        except Exception as e:
            logger.error(f"[{session_id}] Concurrent file generation failed: {e}")
            await websocket_service.send_message(session_id, {
                "type": "codegen.error",
                "message": f"File generation failed: {e}"
            })
            return {"error": str(e)}

    async def validate_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]
        iteration = state.get("fix_iteration", 0)

        if state.get("error"):
            return {}

        logger.info(f"[{session_id}] Validating generated files (iteration {iteration})...")

        await websocket_service.send_message(session_id, {
            "type": "codegen.status",
            "status": "validating"
        })

        files_str = ""
        for f in state["generated_files"]:
            files_str += f"\n--- FILE: {f['path']} ---\n{f['content']}\n"

        prompt = CODEGEN_VALIDATE_PROMPT.format(
            plan_content=state["plan_content"],
            files=files_str,
            entry_point=state.get("entry_point", "main.py")
        )

        try:
            response = await self.call_llm(
                "You are a code review assistant. Respond only in valid JSON.",
                prompt
            )
            result = self.extract_json(response)
            is_valid = result.get("valid", True)
            issues = result.get("issues", [])

            if not is_valid:
                logger.warning(f"[{session_id}] Validation found {len(issues)} issues (iteration {iteration})")

            await websocket_service.send_message(session_id, {
                "type": "codegen.validation_result",
                "iteration": iteration,
                "valid": is_valid,
                "issues": issues,
            })

            return {
                "validation_issues": issues if not is_valid else [],
            }

        except Exception as e:
            logger.error(f"[{session_id}] Validation failed: {e}")
            await websocket_service.send_message(session_id, {
                "type": "codegen.validation_result",
                "iteration": iteration,
                "valid": True,
                "issues": [],
            })
            return {"validation_issues": []}

    async def fix_issues_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]
        iteration = state.get("fix_iteration", 0)
        issues = state.get("validation_issues", [])
        generated_files = state["generated_files"]
        skeleton = state["skeleton_output"]

        files_by_path = {f["path"]: f for f in generated_files}
        affected_paths: set[str] = set()
        for issue in issues:
            fp = issue.get("file", "")
            if fp in files_by_path:
                affected_paths.add(fp)

        if not affected_paths:
            logger.warning(f"[{session_id}] No fixable files found for issues, skipping fix")
            return {"fix_iteration": iteration + 1, "validation_issues": []}

        files_to_fix_list = sorted(affected_paths)

        logger.info(f"[{session_id}] Fix iteration {iteration + 1}: batch-fixing {len(files_to_fix_list)} file(s)")

        await websocket_service.send_message(session_id, {
            "type": "codegen.fix_start",
            "iteration": iteration + 1,
            "filesToFix": files_to_fix_list,
        })

        files_to_fix_str = "\n".join(
            f"--- FILE: {fp} ---\n{files_by_path[fp]['content']}"
            for fp in files_to_fix_list
        )

        issues_str = "\n".join(
            f"- [{issue.get('file', '?')}] {issue.get('line_hint', '')}: {issue['issue']}"
            for issue in issues
        )

        other_files_str = "\n".join(
            f"--- FILE: {f['path']} ---\n{f['content']}"
            for f in generated_files
            if f["path"] not in affected_paths
        )

        prompt = CODEGEN_FIX_BATCH_PROMPT.format(
            skeleton=skeleton,
            files_to_fix=files_to_fix_str,
            issues=issues_str,
            other_files=other_files_str,
        )

        try:
            response = await self.call_llm(
                "You are a code fix assistant. Fix all affected files in one coordinated pass. Respond only in valid JSON.",
                prompt,
                max_tokens=16384,
            )

            result = self.extract_json(response)
            fixed_files = result.get("fixed_files", [])

            updated_files = list(generated_files)
            for fixed in fixed_files:
                fp = fixed["path"]
                content = fixed["content"]
                lang = fixed.get("language", "python")

                for i, f in enumerate(updated_files):
                    if f["path"] == fp:
                        updated_files[i] = GeneratedFile(path=fp, content=content, language=lang)
                        break

                await websocket_service.send_message(session_id, {
                    "type": "codegen.fix_file_complete",
                    "iteration": iteration + 1,
                    "path": fp,
                    "content": content,
                })
                logger.info(f"[{session_id}] Fixed {fp} ({len(content)} chars)")

            return {
                "generated_files": updated_files,
                "fix_iteration": iteration + 1,
            }

        except Exception as e:
            logger.error(f"[{session_id}] Batch fix failed: {e}")
            await websocket_service.send_message(session_id, {
                "type": "codegen.error",
                "message": f"Fix iteration failed: {e}",
            })
            return {"fix_iteration": iteration + 1}

    async def complete_node(self, state: CodeGenState) -> dict:
        session_id = state["session_id"]
        total = len(state["generated_files"])
        issues = state.get("validation_issues", [])
        iterations = state.get("fix_iteration", 0)

        await websocket_service.send_message(session_id, {
            "type": "codegen.complete",
            "totalFiles": total,
            "valid": len(issues) == 0,
            "issues": issues,
            "fixIterations": iterations,
        })

        logger.info(f"[{session_id}] Code generation complete: {total} files, {iterations} fix iteration(s)")
        return {}

    # ---- Routing ----

    def route_after_error_check(self, state: CodeGenState) -> str:
        if state.get("error"):
            return "end"
        return "continue"

    def route_after_validation(self, state: CodeGenState) -> str:
        issues = state.get("validation_issues", [])
        iteration = state.get("fix_iteration", 0)
        max_iter = state.get("max_fix_iterations", MAX_FIX_ITERATIONS)

        if not issues:
            return "complete"
        if iteration >= max_iter:
            logger.warning(f"[{state['session_id']}] Max fix iterations ({max_iter}) reached, completing with {len(issues)} remaining issues")
            return "complete"
        return "fix_issues"

    # ---- Graph Construction ----

    def create_codegen_graph(self):
        graph = StateGraph(CodeGenState)

        graph.add_node("parse_plan", self.parse_plan_node)
        graph.add_node("generate_manifest", self.generate_manifest_node)
        graph.add_node("generate_skeletons", self.generate_skeletons_node)
        graph.add_node("generate_all_files", self.generate_all_files_node)
        graph.add_node("validate", self.validate_node)
        graph.add_node("fix_issues", self.fix_issues_node)
        graph.add_node("complete", self.complete_node)

        graph.set_entry_point("parse_plan")
        graph.add_edge("parse_plan", "generate_manifest")

        graph.add_conditional_edges(
            "generate_manifest",
            self.route_after_error_check,
            {"continue": "generate_skeletons", "end": END}
        )

        graph.add_conditional_edges(
            "generate_skeletons",
            self.route_after_error_check,
            {"continue": "generate_all_files", "end": END}
        )

        graph.add_conditional_edges(
            "generate_all_files",
            self.route_after_error_check,
            {"continue": "validate", "end": END}
        )

        graph.add_conditional_edges(
            "validate",
            self.route_after_validation,
            {"fix_issues": "fix_issues", "complete": "complete"}
        )

        graph.add_edge("fix_issues", "validate")
        graph.add_edge("complete", END)

        return graph.compile()

    # ---- Public API ----

    async def generate_code(
        self,
        agent_id: str,
        plan_content: str,
        session_id: str,
        user_id: str,
        db: Session,
    ) -> List[GeneratedFile]:
        logger.info(f"[{session_id}] Starting code generation for agent {agent_id}")

        graph = self.create_codegen_graph()

        initial_state: CodeGenState = {
            "agent_id": agent_id,
            "user_id": user_id,
            "session_id": session_id,
            "plan_content": plan_content,
            "file_manifest": [],
            "entry_point": "main.py",
            "skeleton_output": "",
            "current_file_index": 0,
            "generated_files": [],
            "messages": [],
            "error": None,
            "validation_issues": [],
            "fix_iteration": 0,
            "max_fix_iterations": MAX_FIX_ITERATIONS,
        }

        try:
            result = await graph.ainvoke(initial_state)

            if result.get("error"):
                raise RuntimeError(result["error"])

            generated_files: List[GeneratedFile] = result.get("generated_files", [])

            self._save_files_to_db(db, agent_id, generated_files)

            entry_point = result.get("entry_point", "main.py")
            self._update_agent_status(db, agent_id, "generated", entry_point)

            return generated_files

        except Exception as e:
            logger.error(f"[{session_id}] Code generation failed: {e}")
            self._update_agent_status(db, agent_id, "error", None)
            await websocket_service.send_message(session_id, {
                "type": "codegen.error",
                "message": str(e)
            })
            raise

    def _save_files_to_db(
        self,
        db: Session,
        agent_id: str,
        files: List[GeneratedFile],
    ):
        from models.agent_file import AgentFile

        db.query(AgentFile).filter(
            AgentFile.agent_id == UUID(agent_id)
        ).delete()

        for f in files:
            agent_file = AgentFile(
                agent_id=UUID(agent_id),
                path=f["path"],
                content=f["content"],
                language=f["language"],
                status="generated",
            )
            db.add(agent_file)

        db.commit()
        logger.info(f"Saved {len(files)} files for agent {agent_id}")

    def _update_agent_status(
        self,
        db: Session,
        agent_id: str,
        status: str,
        entry_point: Optional[str],
    ):
        from models.agent import Agent

        agent = db.query(Agent).filter(Agent.id == UUID(agent_id)).first()
        if agent:
            agent.status = status
            if entry_point:
                agent.entry_point = entry_point
            db.commit()


codegen_service = CodeGenService()
