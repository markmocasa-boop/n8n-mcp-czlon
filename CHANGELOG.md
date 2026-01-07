# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.31.9] - 2026-01-07

### Fixed

**Dynamic AI Tool Nodes Not Recognized by Validator (Issue #522)**

Fixed a validator false positive where dynamically-generated AI Tool nodes like `googleDriveTool` and `googleSheetsTool` were incorrectly reported as "unknown node type".

**Root Cause:** n8n creates Tool variants at runtime when ANY node is connected to an AI Agent's tool slot (e.g., `googleDrive` → `googleDriveTool`). These dynamic nodes don't exist in npm packages, so the MCP database couldn't discover them during rebuild.

**Solution:** Added validation-time inference that checks if the base node exists when a `*Tool` node type is not found. If the base node exists, the Tool variant is treated as valid with an informative warning.

**Changes:**
- `workflow-validator.ts`: Added inference logic for dynamic Tool variants
- `node-similarity-service.ts`: Added high-confidence (98%) suggestion for valid Tool variants
- Added 7 new unit tests for inferred tool variant functionality

**Behavior:**
- `googleDriveTool` with existing `googleDrive` → Warning: `INFERRED_TOOL_VARIANT`
- `googleSheetsTool` with existing `googleSheets` → Warning: `INFERRED_TOOL_VARIANT`
- `unknownNodeTool` without base node → Error: "Unknown node type"
- `supabaseTool` (in database) → Uses database record (no inference)

This fix ensures AI Agent workflows with dynamic tools validate correctly without false positives.

## [2.31.8] - 2026-01-07

### Deprecated

**USE_FIXED_HTTP Environment Variable (Issue #524)**

The `USE_FIXED_HTTP=true` environment variable is now deprecated. The fixed HTTP implementation does not support SSE (Server-Sent Events) streaming required by clients like OpenAI Codex.

**What changed:**
- `SingleSessionHTTPServer` is now the default HTTP implementation
- Removed `USE_FIXED_HTTP` from Docker, Railway, and documentation examples
- Added deprecation warnings when `USE_FIXED_HTTP=true` is detected
- Renamed npm script to `start:http:fixed:deprecated`

**Migration:** Simply unset `USE_FIXED_HTTP` or remove it from your environment. The `SingleSessionHTTPServer` supports both JSON-RPC and SSE streaming automatically.

**Why this matters:**
- OpenAI Codex and other SSE clients now work correctly
- The server properly handles `Accept: text/event-stream` headers
- Returns correct `Content-Type: text/event-stream` for SSE requests

The deprecated implementation will be removed in a future major version.

## [2.31.7] - 2026-01-06

### Changed

- Updated n8n from 2.1.5 to 2.2.3
- Updated n8n-core from 2.1.4 to 2.2.2
- Updated n8n-workflow from 2.1.1 to 2.2.2
- Updated @n8n/n8n-nodes-langchain from 2.1.4 to 2.2.2
- Rebuilt node database with 540 nodes (434 from n8n-nodes-base, 106 from @n8n/n8n-nodes-langchain)

## [2.31.6] - 2026-01-03

### Changed

**Dependencies Update**

- Updated n8n from 2.1.4 to 2.1.5
- Updated n8n-core from 2.1.3 to 2.1.4
- Updated @n8n/n8n-nodes-langchain from 2.1.3 to 2.1.4
- Rebuilt node database with 540 nodes (434 from n8n-nodes-base, 106 from @n8n/n8n-nodes-langchain)

## [2.31.5] - 2026-01-02

### Added

**MCP Tool Annotations (PR #512)**

Added MCP tool annotations to all 20 tools following the [MCP specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#annotations). These annotations help AI assistants understand tool behavior and capabilities.

**Annotations added:**
- `title`: Human-readable name for each tool
- `readOnlyHint`: True for tools that don't modify state (11 tools)
- `destructiveHint`: True for delete operations (3 tools)
- `idempotentHint`: True for operations that produce same result when called repeatedly (14 tools)
- `openWorldHint`: True for tools accessing external n8n API (13 tools)

**Documentation tools** (7): All marked `readOnlyHint=true`, `idempotentHint=true`
- `tools_documentation`, `search_nodes`, `get_node`, `validate_node`, `get_template`, `search_templates`, `validate_workflow`

**Management tools** (13): All marked `openWorldHint=true`
- Read-only: `n8n_get_workflow`, `n8n_list_workflows`, `n8n_validate_workflow`, `n8n_health_check`
- Idempotent updates: `n8n_update_full_workflow`, `n8n_update_partial_workflow`, `n8n_autofix_workflow`
- Destructive: `n8n_delete_workflow`, `n8n_executions` (delete action), `n8n_workflow_versions` (delete/truncate)

## [2.31.4] - 2026-01-02

### Fixed

**Workflow Data Mangled During Serialization: snake_case Conversion (Issue #517)**

Fixed a critical bug where workflow mutation data was corrupted during serialization to Supabase, making 98.9% of collected workflow data invalid for n8n API operations.
