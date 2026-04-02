# Validation Loop: Auto-Fix Until It Compiles

## Problem

Code generation produces files independently against a skeleton contract. Even with the contract, the LLM invents slightly different data shapes, parameter names, and return structures in each file. The current `validate` node catches these cross-file inconsistencies but does nothing about them — it just reports them and exits.

## Goal

After validation finds issues, automatically fix the broken files and re-validate. Repeat until the project is clean or a safety limit is reached.

## Current Pipeline (LangGraph)

```
parse_plan → generate_manifest → generate_skeletons → generate_all_files → validate → END
```

The `validate` node sends all generated files to the LLM, gets back `{ valid, issues[] }`, emits a `codegen.complete` WebSocket event, and always exits to `END`.

## Proposed Pipeline

```
parse_plan → generate_manifest → generate_skeletons → generate_all_files → validate ─┐
                                                                                      │
                                                          ┌───────────────────────────┘
                                                          │
                                                          ├── valid=true ──→ complete → END
                                                          │
                                                          └── valid=false ─→ fix_issues ─→ validate (loop)
                                                                              │
                                                                              └── max iterations hit → complete → END
```

The key change: `validate` no longer emits `codegen.complete`. Instead, it stores the issues in state and a routing function decides whether to loop back through `fix_issues` or proceed to `complete`.

## Design

### 1. State Changes (`CodeGenState`)

Add three new fields to track the fix loop:

```python
class CodeGenState(TypedDict):
    # ... existing fields ...
    validation_issues: List[dict]       # issues from the latest validation pass
    fix_iteration: int                  # current iteration count (starts at 0)
    max_fix_iterations: int             # safety cap (default 3)
```

### 2. New Node: `fix_issues`

This node receives the current `generated_files` and `validation_issues` from state. It:

1. Groups issues by file path.
2. For each file with issues, makes a targeted LLM call with:
   - The skeleton contract (so it knows the signatures)
   - The current content of the broken file
   - The specific issues flagged for that file
   - The content of any related files referenced in the issues (for cross-file problems)
3. Replaces the fixed files in `generated_files`.
4. Increments `fix_iteration`.
5. Streams progress to the frontend.

The fix calls can run concurrently (same semaphore pattern as initial generation) since each file is fixed independently against the skeleton + issue description.

#### Why per-file fixes, not full regeneration

- Faster — only re-generates the 2-3 files that have problems, not all 9.
- Cheaper — smaller prompts, fewer tokens.
- Stabler — files that already work stay untouched.

### 3. New Prompt: `CODEGEN_FIX_FILE_PROMPT`

```
You are a code fix assistant. A file has cross-file consistency issues that need to be resolved.

## Skeleton Contract (source of truth for all signatures)
{skeleton}

## Current File: {file_path}
{file_content}

## Issues Found
{issues}

## Related Files (for context)
{related_files}

## Instructions
- Fix ONLY the issues listed above.
- Keep all other logic unchanged.
- Ensure imports, function signatures, parameter names, and data structures match
  the skeleton contract and the related files exactly.
- Output ONLY the corrected file content, no markdown fences or commentary.
```

Key constraint: the fix prompt anchors on the skeleton as the source of truth. If `gmail_client.py` returns `{"email_id": ...}` and `main.py` expects `{"id": ...}`, the skeleton dictates which is correct.

### 4. Modified Node: `validate`

Currently, `validate` emits `codegen.complete` and returns `{}`. Change it to:

- Store the validation result in state (`validation_issues`, `valid`).
- Do NOT emit `codegen.complete` — let the routing handle that.
- Emit a new event `codegen.validation_result` so the frontend can show the issues found on each pass.

```python
async def validate_node(self, state: CodeGenState) -> dict:
    # ... existing LLM call to validate ...
    
    await websocket_service.send_message(session_id, {
        "type": "codegen.validation_result",
        "iteration": state.get("fix_iteration", 0),
        "valid": is_valid,
        "issues": issues,
    })
    
    return {
        "validation_issues": issues if not is_valid else [],
    }
```

### 5. New Node: `complete`

A simple terminal node that emits `codegen.complete`:

```python
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
    
    return {}
```

### 6. Routing Logic

```python
def route_after_validation(self, state: CodeGenState) -> str:
    issues = state.get("validation_issues", [])
    iteration = state.get("fix_iteration", 0)
    max_iter = state.get("max_fix_iterations", 3)
    
    if not issues:
        return "complete"          # clean — we're done
    if iteration >= max_iter:
        return "complete"          # safety cap — ship what we have
    return "fix_issues"            # loop back
```

### 7. Updated Graph

```python
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
    
    # existing error-check edges ...
    graph.add_conditional_edges("generate_manifest", self.route_after_error_check,
                                {"continue": "generate_skeletons", "end": END})
    graph.add_conditional_edges("generate_skeletons", self.route_after_error_check,
                                {"continue": "generate_all_files", "end": END})
    graph.add_conditional_edges("generate_all_files", self.route_after_error_check,
                                {"continue": "validate", "end": END})
    
    # validation loop
    graph.add_conditional_edges("validate", self.route_after_validation,
                                {"fix_issues": "fix_issues", "complete": "complete"})
    graph.add_edge("fix_issues", "validate")          # always re-validate after fixing
    graph.add_edge("complete", END)
    
    return graph.compile()
```

### 8. Frontend Changes

#### New WebSocket Events

| Event | When | Payload |
|---|---|---|
| `codegen.validation_result` | After each validation pass | `{ iteration, valid, issues[] }` |
| `codegen.fix_start` | Beginning of fix iteration | `{ iteration, filesToFix: string[] }` |
| `codegen.fix_file_start` | Starting to fix a specific file | `{ iteration, path }` |
| `codegen.fix_file_complete` | File fix done | `{ iteration, path, content }` |

#### `useCodeGenWebSocket.ts`

- Add new `CodeGenStatus` values: `"fixing"`.
- Handle the new events in `handleMessage` to generate log entries:
  - `codegen.validation_result` with `valid=false`: "Validation found 6 issues, starting fix iteration 1..."
  - `codegen.fix_file_start`: "Fixing main.py..."
  - `codegen.fix_file_complete`: "main.py fixed (3,491 chars)"
  - `codegen.validation_result` with `valid=true`: "Validation passed on iteration 2"
- Update `files` state when fix completions arrive (replace the existing file entry).
- `codegen.complete` now includes `fixIterations` for display.

#### `ExecutionLogs.tsx`

No changes needed — it renders whatever logs the hook produces.

#### `SandboxHeader.tsx`

Add a label for the fixing status, e.g. "Fixing issues (iteration 1/3)...".

## Safety Limits

| Limit | Value | Rationale |
|---|---|---|
| `max_fix_iterations` | 3 | Prevents infinite loops. Most issues resolve in 1-2 passes. |
| Per-fix `max_tokens` | 4096 | Same as initial generation. |
| Fix timeout | 60s per file | Kill the fix attempt if the LLM hangs. |

If the loop exhausts all 3 iterations and issues remain, the pipeline completes with the remaining issues reported to the user. They can manually fix in the editor or regenerate.

## Potential Future Improvements

- **Sandbox compilation check**: Instead of LLM-based validation, actually run `python -m py_compile` in a Daytona sandbox and use real compiler errors as the issue list. This would be more reliable than asking the LLM to spot its own mistakes.
- **Targeted re-validation**: After fixing only 2 files, re-validate only the cross-file interfaces involving those files instead of re-validating everything.
- **Issue deduplication**: If the same issue appears across iterations, mark it as unresolvable and skip it to avoid wasting iterations.

## Implementation Order

1. Add `validation_issues`, `fix_iteration`, `max_fix_iterations` to `CodeGenState`.
2. Add `CODEGEN_FIX_FILE_PROMPT` to `config/prompts.py`.
3. Refactor `validate_node` — remove `codegen.complete` emission, store issues in state.
4. Add `fix_issues_node` with concurrent per-file fixing.
5. Add `complete_node`.
6. Update `create_codegen_graph` with the new routing.
7. Add new WebSocket event handlers in `useCodeGenWebSocket.ts`.
8. Update `SandboxHeader.tsx` with fixing status label.
