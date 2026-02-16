window.BENCHMARK_DATA = {
  "lastUpdate": 1771254957070,
  "repoUrl": "https://github.com/markmocasa-boop/n8n-mcp-czlon",
  "entries": {
    "n8n-mcp Benchmarks": [
      {
        "commit": {
          "author": {
            "email": "bthompson@maillocker.net",
            "name": "Bryan Thompson",
            "username": "triepod-ai"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "2713db6d106f30554f3f144c548504c2097f2741",
          "message": "feat: add MCP tool annotations to all 20 tools (#512)\n\n* feat: add MCP tool annotations to all 20 tools\n\nAdd MCP tool annotations per specification to help AI assistants\nunderstand tool behavior and capabilities.\n\nDocumentation tools (7):\n- tools_documentation, search_nodes, get_node, validate_node,\n  get_template, search_templates, validate_workflow\n- All marked readOnlyHint=true (local database queries)\n\nManagement tools (13):\n- n8n_create_workflow, n8n_get_workflow, n8n_update_full_workflow,\n  n8n_update_partial_workflow, n8n_delete_workflow, n8n_list_workflows,\n  n8n_validate_workflow, n8n_autofix_workflow, n8n_test_workflow,\n  n8n_executions, n8n_health_check, n8n_workflow_versions,\n  n8n_deploy_template\n- All marked openWorldHint=true (n8n API access)\n- Destructive operations (delete_workflow, executions delete,\n  workflow_versions delete/truncate) marked destructiveHint=true\n\nAnnotations follow MCP spec:\nhttps://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#annotations\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* feat: add idempotentHint to all read-only tools\n\nAdds idempotentHint: true annotation to all read-only tools that produce\nthe same output when called multiple times:\n- 7 documentation tools (tools.ts)\n- 4 management tools (tools-n8n-manager.ts): n8n_get_workflow,\n  n8n_list_workflows, n8n_validate_workflow, n8n_health_check\n\nAlso adds trailing newline to tools-n8n-manager.ts.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* feat: add idempotentHint to update operations, bump to 2.31.5\n\nAdds idempotentHint: true to update operations that produce the same\nresult when called repeatedly with the same arguments:\n- n8n_update_full_workflow\n- n8n_update_partial_workflow\n- n8n_autofix_workflow\n\nAlso bumps version to 2.31.5 and updates CHANGELOG.md with complete\ndocumentation of all MCP tool annotations added in this PR.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: triepod-ai <noreply@github.com>\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>",
          "timestamp": "2026-01-02T15:48:47+01:00",
          "tree_id": "2699ee78d2f42d632b1937c421986a2d38a7f1b7",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/2713db6d106f30554f3f144c548504c2097f2741"
        },
        "date": 1767365448403,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "25cb8bb4559a78e36e0f3c32e3d78a807b107abf",
          "message": "chore: update n8n to 2.1.5 and bump version to 2.31.6 (#521)\n\n- Updated n8n from 2.1.4 to 2.1.5\n- Updated n8n-core from 2.1.3 to 2.1.4\n- Updated @n8n/n8n-nodes-langchain from 2.1.3 to 2.1.4\n- Rebuilt node database with 540 nodes (434 from n8n-nodes-base, 106 from @n8n/n8n-nodes-langchain)\n- Updated README badge with new n8n version\n- Updated CHANGELOG with dependency changes\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude <noreply@anthropic.com>",
          "timestamp": "2026-01-04T10:43:35+01:00",
          "tree_id": "458ef1376f2cfc6d2a39a9dc5f9586bc418051ca",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/25cb8bb4559a78e36e0f3c32e3d78a807b107abf"
        },
        "date": 1767519934923,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7b0ff990ec656b3bbd2f37b763f2206a1468a577",
          "message": "chore: update n8n to 2.2.3 and bump version to 2.31.7 (#523)\n\n- Updated n8n from 2.1.5 to 2.2.3\n- Updated n8n-core from 2.1.4 to 2.2.2\n- Updated n8n-workflow from 2.1.1 to 2.2.2\n- Updated @n8n/n8n-nodes-langchain from 2.1.4 to 2.2.2\n- Rebuilt node database with 540 nodes (434 from n8n-nodes-base, 106 from @n8n/n8n-nodes-langchain)\n- Updated README badge with new n8n version\n- Updated CHANGELOG with dependency changes\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude <noreply@anthropic.com>",
          "timestamp": "2026-01-06T13:18:56+01:00",
          "tree_id": "66c78d7c4efc3ae032888f5da73d96cf5a0076be",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/7b0ff990ec656b3bbd2f37b763f2206a1468a577"
        },
        "date": 1767702055945,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "861005eeedf880be2489bc197b85a385735c0356",
          "message": "fix: deprecate USE_FIXED_HTTP for SSE streaming support (Issue #524) (#525)\n\n* fix: deprecate USE_FIXED_HTTP for SSE streaming support (Issue #524)\n\nThe fixed HTTP implementation does not support SSE streaming required\nby clients like OpenAI Codex. This commit deprecates USE_FIXED_HTTP\nand makes SingleSessionHTTPServer the default.\n\nChanges:\n- Add deprecation warnings in src/mcp/index.ts and src/http-server.ts\n- Remove USE_FIXED_HTTP from docker-compose.yml and Dockerfile.railway\n- Update .env.example with deprecation notice\n- Rename npm script to start:http:fixed:deprecated\n- Update all documentation to remove USE_FIXED_HTTP references\n- Mark test case as deprecated\n\nUsers should unset USE_FIXED_HTTP to use the modern SingleSessionHTTPServer\nwhich supports both JSON-RPC and SSE streaming.\n\nCloses #524\n\nConcieved by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* chore: bump version to 2.31.8 and add CHANGELOG entry\n\n- Fix comment inaccuracy: \"deprecated\" not \"deprecated and removed\"\n- Bump version from 2.31.7 to 2.31.8\n- Add CHANGELOG entry documenting USE_FIXED_HTTP deprecation\n- Update all deprecation messages to reference v2.31.8\n\nConcieved by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-07T13:42:16+01:00",
          "tree_id": "1675efb5c222304f76aa99a4ee1dd8396056b1ac",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/861005eeedf880be2489bc197b85a385735c0356"
        },
        "date": 1767789848408,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ce2c94c1a5ca64f82fb5b011d7739bdfd0711c66",
          "message": "fix: recognize dynamic AI Tool nodes in validator (Issue #522) (#526)\n\nWhen n8n connects any node to an AI Agent's tool slot, it creates a\ndynamic Tool variant at runtime (e.g., googleDrive → googleDriveTool).\nThese don't exist in npm packages, causing false \"unknown node type\"\nerrors.\n\nAdded validation-time inference: when a *Tool node type is not found,\ncheck if the base node exists. If yes, treat as valid with warning.\n\nChanges:\n- workflow-validator.ts: Add INFERRED_TOOL_VARIANT logic\n- node-similarity-service.ts: Add 98% confidence for valid Tool variants\n- Added 7 unit tests for inferred tool variant functionality\n\nFixes #522\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-07T18:09:55+01:00",
          "tree_id": "6b568155d3d2e1333dba098ad082367114a4634f",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/ce2c94c1a5ca64f82fb5b011d7739bdfd0711c66"
        },
        "date": 1767805907935,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "211ae72f9698bf64d49e2a3d867d0b77f7a85535",
          "message": "feat: add community nodes support (Issues #23, #490) (#527)\n\n* feat: add community nodes support (Issues #23, #490)\n\nAdd comprehensive support for n8n community nodes, expanding the node\ndatabase from 537 core nodes to 1,084 total (537 core + 547 community).\n\nNew Features:\n- 547 community nodes indexed (301 verified + 246 npm packages)\n- `source` filter for search_nodes: all, core, community, verified\n- Community metadata: isCommunity, isVerified, authorName, npmDownloads\n- Full schema support for verified nodes (no parsing needed)\n\nData Sources:\n- Verified nodes from n8n Strapi API (api.n8n.io)\n- Popular npm packages (keyword: n8n-community-node-package)\n\nCLI Commands:\n- npm run fetch:community (full rebuild)\n- npm run fetch:community:verified (fast, verified only)\n- npm run fetch:community:update (incremental)\n\nFixes #23 - search_nodes not finding community nodes\nFixes #490 - Support obtaining installed community node types\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* test: fix test issues for community nodes feature\n\n- Fix TypeScript literal type errors in search-nodes-source-filter.test.ts\n- Skip timeout-sensitive retry tests in community-node-fetcher.test.ts\n- Fix malformed API response test expectations\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* data: include 547 community nodes in database\n\nUpdated nodes.db with community nodes:\n- 301 verified community nodes (from n8n Strapi API)\n- 246 popular npm community packages\n\nTotal nodes: 1,349 (802 core + 547 community)\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: add community fields to node-repository-outputs test mockRows\n\nUpdate all mockRow objects in the test file to include the new community\nnode fields (is_community, is_verified, author_name, etc.) to match the\nupdated database schema.\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: add community fields to node-repository-core test mockRows\n\nUpdate all mockRow objects and expected results in the core test file\nto include the new community node fields, fixing CI test failures.\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: separate documentation coverage tests for core vs community nodes\n\nCommunity nodes (from npm packages) typically have lower documentation\ncoverage than core n8n nodes. Updated tests to:\n- Check core nodes against 80% threshold\n- Report community nodes coverage informatively (no hard requirement)\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: increase bulk insert performance threshold for community columns\n\nAdjusted performance test thresholds to account for the 8 additional\ncommunity node columns in the database schema. Insert operations are\nslightly slower with more columns.\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: make list-workflows test resilient to pagination\n\nThe \"no filters\" test was flaky in CI because:\n- CI n8n instance accumulates many workflows over time\n- Default pagination (100) may not include newly created workflows\n- Workflows sorted by criteria that push new ones beyond first page\n\nChanged test to verify API response structure rather than requiring\nspecific workflows in results. Finding specific workflows is already\ncovered by pagination tests.\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* ci: increase test timeout from 10 to 15 minutes\n\nWith community nodes support, the database is larger (~1100 nodes vs ~550)\nwhich increases test execution time. Increased timeout to prevent\npremature job termination.\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-08T07:02:56+01:00",
          "tree_id": "86274f568c8a168dac13c956d422d515c44ce2d6",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/211ae72f9698bf64d49e2a3d867d0b77f7a85535"
        },
        "date": 1767852290104,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "28667736cd7aeca5e898c68406706990a72fcb20",
          "message": "fix: use lowercase for community node names to match n8n convention (#529)\n\n* fix: use lowercase for community node names to match n8n convention\n\nCommunity nodes in n8n use lowercase node class names (e.g., chatwoot\nnot Chatwoot). The extractNodeNameFromPackage method was incorrectly\ncapitalizing node names, causing validation failures.\n\nChanges:\n- Fix extractNodeNameFromPackage to use lowercase instead of capitalizing\n- Add case-insensitive fallback in getNode for robustness\n- Update tests to expect lowercase node names\n- Bump version to 2.32.1\n\nFixes the case sensitivity bug where MCP stored Chatwoot but n8n\nexpected chatwoot.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* chore: rebuild community nodes database with lowercase names\n\nRebuilt database after fixing extractNodeNameFromPackage to use\nlowercase node names matching n8n convention.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-08T08:27:56+01:00",
          "tree_id": "12d64f00fae9c4f941dbbdf14f4a351117e69556",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/28667736cd7aeca5e898c68406706990a72fcb20"
        },
        "date": 1767857395185,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "533b105f03ad68e137753bce561d3c1f85f36263",
          "message": "feat: AI-powered documentation for community nodes (#530)\n\n* feat: add AI-powered documentation generation for community nodes\n\nAdd system to fetch README content from npm and generate structured\nAI documentation summaries using local Qwen LLM.\n\nNew features:\n- Database schema: npm_readme, ai_documentation_summary, ai_summary_generated_at columns\n- DocumentationGenerator: LLM integration with OpenAI-compatible API (Zod validation)\n- DocumentationBatchProcessor: Parallel processing with progress tracking\n- CLI script: generate-community-docs.ts with multiple modes\n- Migration script for existing databases\n\nnpm scripts:\n- generate:docs - Full generation (README + AI summary)\n- generate:docs:readme-only - Only fetch READMEs\n- generate:docs:summary-only - Only generate AI summaries\n- generate:docs:incremental - Skip nodes with existing data\n- generate:docs:stats - Show documentation statistics\n- migrate:readme-columns - Apply database migration\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* feat: expose AI documentation summaries in MCP get_node response\n\n- Add AI documentation fields to NodeRow interface\n- Update SQL queries in getNodeDocumentation() to fetch AI fields\n- Add safeJsonParse helper method\n- Include aiDocumentationSummary and aiSummaryGeneratedAt in docs response\n- Fix parseNodeRow to include npmReadme and AI summary fields\n- Add truncateArrayFields to handle LLM responses exceeding schema limits\n- Bump version to 2.33.0\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* test: add unit tests for AI documentation feature (100 tests)\n\nAdded comprehensive test coverage for the AI documentation feature:\n\n- server-node-documentation.test.ts: 18 tests for MCP getNodeDocumentation()\n  - AI documentation field handling\n  - safeJsonParse error handling\n  - Node type normalization\n  - Response structure validation\n\n- node-repository-ai-documentation.test.ts: 16 tests for parseNodeRow()\n  - AI documentation field parsing\n  - Malformed JSON handling\n  - Edge cases (null, empty, missing fields)\n\n- documentation-generator.test.ts: 66 tests (14 new for truncateArrayFields)\n  - Array field truncation\n  - Schema limit enforcement\n  - Edge case handling\n\nAll 100 tests pass with comprehensive coverage.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: add AI documentation fields to test mock data\n\nUpdated test fixtures to include the 3 new AI documentation fields:\n- npm_readme\n- ai_documentation_summary\n- ai_summary_generated_at\n\nThis fixes test failures where getNode() returns objects with these\nfields but test expectations didn't include them.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n* fix: increase CI threshold for database performance test\n\nThe 'should benefit from proper indexing' test was failing in CI with\nquery times of 104-127ms against a 100ms threshold. Increased threshold\nto 150ms to account for CI environment variability.\n\nConceived by Romuald Członkowski - www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Romuald Członkowski <romualdczlonkowski@MacBook-Pro-Romuald.local>\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-08T13:14:02+01:00",
          "tree_id": "b9745fa72e076936efd46eca14c6334a027f1fea",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/533b105f03ad68e137753bce561d3c1f85f36263"
        },
        "date": 1767874566649,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "a9c4400a929d644287825afd6bde0681dc4bb103",
          "message": "fix: sync package.runtime.json version in Docker builds (v2.33.1) (#534)\n\nDocker images were built with stale package.runtime.json (v2.29.5)\nwhile npm package was at v2.33.0. This was caused by the build-docker\njob not syncing the version before building, while publish-npm did.\n\nChanges:\n- Add \"Sync runtime version\" step to release.yml build-docker job\n- Add \"Sync runtime version\" step to docker-build.yml build job\n- Add \"Sync runtime version\" step to docker-build.yml build-railway job\n- Bump version to 2.33.1 to trigger release with fix\n\nThe sync uses a lightweight Node.js one-liner (no npm install needed)\nto update package.runtime.json version from package.json before\nDocker builds.\n\nConceived by Romuald Czlonkowski - www.aiadvisors.pl/en\n\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-12T10:25:58+01:00",
          "tree_id": "af266b355beb2ab2aea4ed0d332eb035448383ea",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/a9c4400a929d644287825afd6bde0681dc4bb103"
        },
        "date": 1768210078230,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "56956555+czlonkowski@users.noreply.github.com",
            "name": "Romuald Członkowski",
            "username": "czlonkowski"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "974a9fb3492fe2c4984ee0549085d531cdc6242a",
          "message": "chore: update n8n to 2.3.3 and bump version to 2.33.2 (#535)\n\n- Updated n8n from 2.2.3 to 2.3.3\n- Updated n8n-core from 2.2.2 to 2.3.2\n- Updated n8n-workflow from 2.2.2 to 2.3.2\n- Updated @n8n/n8n-nodes-langchain from 2.2.2 to 2.3.2\n- Rebuilt node database with 537 nodes (434 from n8n-nodes-base, 103 from @n8n/n8n-nodes-langchain)\n- Updated README badge with new n8n version\n- Updated CHANGELOG with dependency changes\n\nConceived by Romuald Członkowski - https://www.aiadvisors.pl/en\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-authored-by: Claude Opus 4.5 <noreply@anthropic.com>",
          "timestamp": "2026-01-13T17:47:27+01:00",
          "tree_id": "79bb647536c9c858570eb5aef0acf8a1bbcb4a15",
          "url": "https://github.com/czlonkowski/n8n-mcp/commit/974a9fb3492fe2c4984ee0549085d531cdc6242a"
        },
        "date": 1768322967350,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "e0c440b1e37b455c226aba0793dcafd87f0f1e65",
          "message": "Merge pull request #3 from markmocasa-boop/claude/n8n-youtube-transcription-V7ApL\n\nfeat: add YouTube video dubbing workflow for German translation",
          "timestamp": "2026-01-15T19:48:16+01:00",
          "tree_id": "fb3be80d3ca1387c961962f43b5c983bdc407f9b",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/e0c440b1e37b455c226aba0793dcafd87f0f1e65"
        },
        "date": 1768503009595,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7f7d2b1f219e1efadec25a4a34683afdc2a48cb0",
          "message": "Merge pull request #4 from markmocasa-boop/claude/linkedin-post-automation-UrcHu\n\nClaude/linkedin post automation urc hu",
          "timestamp": "2026-01-15T20:25:04+01:00",
          "tree_id": "d4b9fb4f28c8beb043c1e774ffd5e027c600f2bd",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/7f7d2b1f219e1efadec25a4a34683afdc2a48cb0"
        },
        "date": 1768505228189,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "4cf440666b31f22c4729260dd070b7e23999532a",
          "message": "Merge pull request #5 from markmocasa-boop/claude/gmail-inbound-agent-2LW7E\n\nfeat: add Gmail Inbound Agent workflow for Effizienzheld",
          "timestamp": "2026-01-17T09:55:41+01:00",
          "tree_id": "fd6dcbb5dfe44a3f1f10d2ec6c8ae68863fdd04f",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/4cf440666b31f22c4729260dd070b7e23999532a"
        },
        "date": 1768640271011,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "570fff83ef604a60b415571a6cf522cc5ffb52f0",
          "message": "Merge pull request #6 from markmocasa-boop/claude/linkedin-post-automation-UrcHu\n\nfeat: replace LinkedIn native with Blotato + Cloudinary image hosting",
          "timestamp": "2026-01-19T12:42:19+01:00",
          "tree_id": "3edf15f93395dfa302f382da732f28cdc6820301",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/570fff83ef604a60b415571a6cf522cc5ffb52f0"
        },
        "date": 1768823051255,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "3ccdf6c97d2709f28bbb42bec9b5bfa49bdee3cf",
          "message": "Merge pull request #7 from markmocasa-boop/claude/linkedin-dm-tracking-aKYx2\n\nfeat: add LinkedIn DM Follow-up Tracking workflow with PhantomBuster",
          "timestamp": "2026-01-19T19:21:11+01:00",
          "tree_id": "c9cdf2d676ddcad4824ca32c0e605bc595f555c3",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/3ccdf6c97d2709f28bbb42bec9b5bfa49bdee3cf"
        },
        "date": 1768846988835,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7b15b8c5dd7dd385d4db61ebb56c3b840f7ca1e5",
          "message": "Merge pull request #8 from markmocasa-boop/claude/lead-magnet-workflow-gRFZl\n\nfeat: add Lead Magnet Builder workflow with multi-platform distribution",
          "timestamp": "2026-01-19T19:26:32+01:00",
          "tree_id": "8f19a492ab971ee34d36cf020d2c1de648e75f7f",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/7b15b8c5dd7dd385d4db61ebb56c3b840f7ca1e5"
        },
        "date": 1768847293909,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "50d5370bf3919e953f05594937d3f84817b02484",
          "message": "Merge pull request #9 from markmocasa-boop/claude/n8n-funnel-reporting-workflow-tDIl2\n\nfeat: add Funnel & Conversion Reporting workflow (weekly)",
          "timestamp": "2026-01-21T14:09:33+01:00",
          "tree_id": "0d44c4ccaa422e172108dfbfc4355a62d53d36d0",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/50d5370bf3919e953f05594937d3f84817b02484"
        },
        "date": 1769001088597,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "324ae141f1a0065a561b504add4b9ae594c94d7d",
          "message": "Add files via upload",
          "timestamp": "2026-01-22T07:56:14+01:00",
          "tree_id": "514c23c5bf2e3fe086a4ddf50fd4498429f00739",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/324ae141f1a0065a561b504add4b9ae594c94d7d"
        },
        "date": 1769065083867,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "386fa94289ac7dea5f83df2db76b7bcf9b35683c",
          "message": "Merge pull request #10 from markmocasa-boop/claude/german-price-tracker-yEgwi\n\nfeat: add 4 new ScrapingBee shops (Otto, Kaufland, Galaxus, ManoMano)",
          "timestamp": "2026-01-22T08:20:48+01:00",
          "tree_id": "a3a12eef1a14ddfef6475c36a49548254e6c5931",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/386fa94289ac7dea5f83df2db76b7bcf9b35683c"
        },
        "date": 1769066554724,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7abc9dc164b6c3f4cee86aaa3b639708d695517f",
          "message": "Merge pull request #11 from markmocasa-boop/claude/german-price-tracker-yEgwi\n\nClaude/german price tracker y egwi",
          "timestamp": "2026-01-22T13:22:41+01:00",
          "tree_id": "ecaf67603b07ce8063bdc49e3ff2d1dd99dafede",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/7abc9dc164b6c3f4cee86aaa3b639708d695517f"
        },
        "date": 1769084671966,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "dbecfa9c74cd84e25ed6d02b721c2ae709d8ef60",
          "message": "Merge pull request #12 from markmocasa-boop/claude/linkedin-message-monitoring-vyNbP\n\nfeat: add LinkedIn message monitoring workflow with Unipile API",
          "timestamp": "2026-01-22T16:36:38+01:00",
          "tree_id": "6a32a870398d6be56d14c73f260825271eecc0b7",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/dbecfa9c74cd84e25ed6d02b721c2ae709d8ef60"
        },
        "date": 1769096310157,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "be10ff1f577c8f0c8471374b12e62d471ecabef8",
          "message": "Merge pull request #13 from markmocasa-boop/claude/linkedin-message-monitoring-vyNbP\n\nfeat: add PhantomBuster alternative for LinkedIn message monitoring",
          "timestamp": "2026-01-22T17:38:20+01:00",
          "tree_id": "63f15383d7165ad6fa92543226adb745913891b0",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/be10ff1f577c8f0c8471374b12e62d471ecabef8"
        },
        "date": 1769100007327,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "20a391842dc9b398b31d76bf803ef80419ca85a5",
          "message": "Merge pull request #14 from markmocasa-boop/claude/n8n-seo-content-workflow-HcOuY\n\nfeat: add comprehensive SEO Content Planning workflow",
          "timestamp": "2026-01-26T12:24:57+01:00",
          "tree_id": "3ce1f39b1aaa7de17ed8bb1867f5fd2e3d5bca72",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/20a391842dc9b398b31d76bf803ef80419ca85a5"
        },
        "date": 1769426808600,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7884f0cad01ce70e63285c1f6a6b31f7129123fd",
          "message": "Merge pull request #15 from markmocasa-boop/claude/n8n-seo-content-workflow-Te5CK\n\nfeat: add Form-based SEO Content Planning workflow",
          "timestamp": "2026-01-26T19:47:00+01:00",
          "tree_id": "cee3daba277cce83c71f0e1f85bfdf9b73b282d3",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/7884f0cad01ce70e63285c1f6a6b31f7129123fd"
        },
        "date": 1769453324504,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "91f93bb54512e2fb14208340a04345db5d174600",
          "message": "Merge pull request #16 from markmocasa-boop/claude/n8n-backlink-outreach-XyhQu\n\nfeat: add Backlink Outreach Automatisierung workflow",
          "timestamp": "2026-01-27T06:59:28+01:00",
          "tree_id": "5ab8f80dfafb1c136e1a92ea413bbba9c442780e",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/91f93bb54512e2fb14208340a04345db5d174600"
        },
        "date": 1769493782108,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "4ce0e0c8e0812af0603f58b2e3d67e7b9c51baa2",
          "message": "Remove skills-czlon file",
          "timestamp": "2026-01-27T07:12:16+01:00",
          "tree_id": "51c6ca3bab3326bcf2d872af329c9f05a8823b9f",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/4ce0e0c8e0812af0603f58b2e3d67e7b9c51baa2"
        },
        "date": 1769494488319,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "781886783c05e51c67923af90f3283856d035817",
          "message": "Merge pull request #17 from markmocasa-boop/claude/n8n-backlink-outreach-XyhQu\n\nrefactor: use native Apify and Anthropic nodes instead of HTTP Request",
          "timestamp": "2026-01-27T12:33:02+01:00",
          "tree_id": "d32be36070b996a78c90513e03b1774891faa2b3",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/781886783c05e51c67923af90f3283856d035817"
        },
        "date": 1769513693761,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "distinct": true,
          "id": "0b1290e4f19c3be12d63f03f55cb45e50560760c",
          "message": "Merge branch 'main' of https://github.com/markmocasa-boop/n8n-mcp-czlon",
          "timestamp": "2026-01-27T12:43:37+01:00",
          "tree_id": "45f5e4e291fbe1266b8bc5041c14393ba3fd6c09",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/0b1290e4f19c3be12d63f03f55cb45e50560760c"
        },
        "date": 1769514340577,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ac828f3c6fe8cea25d8d7c0b69c804c93799f0b5",
          "message": "Merge pull request #18 from markmocasa-boop/claude/n8n-backlink-outreach-XyhQu\n\nClaude/n8n backlink outreach xyh qu",
          "timestamp": "2026-01-27T14:54:11+01:00",
          "tree_id": "a6f1bd602aacc2a009b8367f25610523110aacae",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/ac828f3c6fe8cea25d8d7c0b69c804c93799f0b5"
        },
        "date": 1769522168924,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "1f812d2a64abaa0c2f3ffb6a86a9ffc1b25a0ce0",
          "message": "Add files via upload",
          "timestamp": "2026-01-28T08:15:27+01:00",
          "tree_id": "de2ed90c59548e4479a29dc319cfb15c610d323e",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/1f812d2a64abaa0c2f3ffb6a86a9ffc1b25a0ce0"
        },
        "date": 1769584641135,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "fc581b9c84a58c9377212e3b4ec84878460c926c",
          "message": "Add files via upload",
          "timestamp": "2026-01-28T08:17:56+01:00",
          "tree_id": "1b0896724b7b951a9f7622011d5503d2af52cac0",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/fc581b9c84a58c9377212e3b4ec84878460c926c"
        },
        "date": 1769584791836,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "5327851d57d1f97584541a4debe481e88d3ec804",
          "message": "Merge pull request #19 from markmocasa-boop/claude/social-media-automation-bDfkm\n\nfeat: add social media content automation workflow",
          "timestamp": "2026-01-28T09:36:15+01:00",
          "tree_id": "efaaa95cba09fc8f96cc164fc31453d09e2eebe6",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/5327851d57d1f97584541a4debe481e88d3ec804"
        },
        "date": 1769589482496,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "504d9ad4c2b103b89fb8e84acb4962bc9a3d0ad5",
          "message": "Merge pull request #20 from markmocasa-boop/claude/ai-coworker-n8n-workflow-c9hkA\n\nfeat: add AI Coworker Slack assistant workflow",
          "timestamp": "2026-01-29T11:04:36+01:00",
          "tree_id": "9e6a5d613174079f671e83685e75892785808b14",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/504d9ad4c2b103b89fb8e84acb4962bc9a3d0ad5"
        },
        "date": 1769681190103,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "cbfe6011a115559d06e60c2ec1981119b7cfbb06",
          "message": "Merge pull request #21 from markmocasa-boop/claude/ai-coworker-n8n-workflow-c9hkA\n\nfix: resolve n8n Cloud import compatibility issues",
          "timestamp": "2026-01-29T13:07:33+01:00",
          "tree_id": "21fe89b543595786ed7c50d7ba61c0dd80ab868e",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/cbfe6011a115559d06e60c2ec1981119b7cfbb06"
        },
        "date": 1769688555012,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "43138855115af56c6e8d5e87261ad7ff931206fe",
          "message": "Add files via upload",
          "timestamp": "2026-02-01T16:18:34+01:00",
          "tree_id": "d5d83b509df50e7a1a9067f1b1224d58b3f37f84",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/43138855115af56c6e8d5e87261ad7ff931206fe"
        },
        "date": 1769959256252,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "c10133c48dbf673f76044c094ba1117e2325ddc7",
          "message": "Add files via upload",
          "timestamp": "2026-02-01T16:19:07+01:00",
          "tree_id": "c90e62c38e74c6021436b83d57c4af34ef8b7cc0",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/c10133c48dbf673f76044c094ba1117e2325ddc7"
        },
        "date": 1769959261192,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "be96b1855ffdf7fde5066ebb5c28a0fc7c17edcc",
          "message": "Add files via upload",
          "timestamp": "2026-02-04T15:16:04+01:00",
          "tree_id": "f4e9ee4e43c132289f4338e7280708c05bd82b7a",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/be96b1855ffdf7fde5066ebb5c28a0fc7c17edcc"
        },
        "date": 1770214689250,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "b1574e12037bf235840da3fca70d4cb85ae1ba0a",
          "message": "Add files via upload",
          "timestamp": "2026-02-06T09:17:41+01:00",
          "tree_id": "8c18c27dca7caaeb77c470b77d174561ccf86512",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/b1574e12037bf235840da3fca70d4cb85ae1ba0a"
        },
        "date": 1770365989623,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "6ecd82f93f641492032f111201b94ac908d3afe3",
          "message": "Delete workflows/MO - Social Media Content Automation - VaSi.json",
          "timestamp": "2026-02-06T09:23:10+01:00",
          "tree_id": "0438f8d47e0249e135d5138f914cbed24f69e15a",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/6ecd82f93f641492032f111201b94ac908d3afe3"
        },
        "date": 1770366315737,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "3cb37c7988c0d6acb2c19b45047849ffbc775df6",
          "message": "Merge pull request #22 from markmocasa-boop/claude/ai-lead-qualifier-Idqjj\n\nAdd Auto-Lead-Closer KI Lead-Qualifier workflow",
          "timestamp": "2026-02-10T07:13:47+01:00",
          "tree_id": "2d3202cadf3f9b0c9acfdf65ea9577d0e54dc240",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/3cb37c7988c0d6acb2c19b45047849ffbc775df6"
        },
        "date": 1770704154137,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ab978411efe67d3331b8485eb7d3f784abca219a",
          "message": "Merge pull request #23 from markmocasa-boop/claude/offer-comprehensibility-checker-WoJ2o\n\nAdd Angebots-Verständlichkeits-Checker workflow",
          "timestamp": "2026-02-10T12:33:39+01:00",
          "tree_id": "cf0e72dd6097d3b09bc77e638045af7723689537",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/ab978411efe67d3331b8485eb7d3f784abca219a"
        },
        "date": 1770723336651,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "8b1a7638e151b4047d4128a50c5a115aba64b2b7",
          "message": "Merge pull request #24 from markmocasa-boop/claude/google-business-audit-workflow-vbGWF\n\nAdd Google Business Profil Audit workflow (Lead Magnet)",
          "timestamp": "2026-02-10T13:15:01+01:00",
          "tree_id": "5b8cf8998c600df30503da339c2b48f11240e9ae",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/8b1a7638e151b4047d4128a50c5a115aba64b2b7"
        },
        "date": 1770725822518,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9090a0446cb0f6c975d1baa192e6668e60a05395",
          "message": "Merge pull request #25 from markmocasa-boop/claude/classify-bundesliga-regions-yoQpI\n\nAdd Bundesliga Region Classifier workflow",
          "timestamp": "2026-02-10T15:25:13+01:00",
          "tree_id": "59ea793a3f355ba966886f3015e8b5e14ea28fd3",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/9090a0446cb0f6c975d1baa192e6668e60a05395"
        },
        "date": 1770733627870,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "4ae4d06500d68b0d01605570d62055bc1cc5d8e2",
          "message": "Merge pull request #26 from markmocasa-boop/claude/google-business-audit-workflow-vbGWF\n\nFix: Remove $env references for n8n Cloud compatibility",
          "timestamp": "2026-02-10T15:37:51+01:00",
          "tree_id": "a9203d8f966c74e7dc86ac0184281bce6d40acd4",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/4ae4d06500d68b0d01605570d62055bc1cc5d8e2"
        },
        "date": 1770734390533,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "90ff92e4cbf06d2fcb2d3a75046782705a4f71cb",
          "message": "Add files via upload",
          "timestamp": "2026-02-12T15:54:48+01:00",
          "tree_id": "f833ff27931796592eeeb54ba86118d9db45817c",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/90ff92e4cbf06d2fcb2d3a75046782705a4f71cb"
        },
        "date": 1770908203826,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "0611b0a8dec902d9aed93c24be05569f174d20e9",
          "message": "Add files via upload",
          "timestamp": "2026-02-13T04:20:35+01:00",
          "tree_id": "d4b69910a5952bf9635d26724476863ea41fd0a5",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/0611b0a8dec902d9aed93c24be05569f174d20e9"
        },
        "date": 1770952947447,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "b52bfda2f9a2126b1c3b0f201a12684bf9a215d4",
          "message": "Merge pull request #27 from markmocasa-boop/claude/comment-analysis-workflow-Ppl2a\n\nClaude/comment analysis workflow ppl2a",
          "timestamp": "2026-02-16T08:12:51+01:00",
          "tree_id": "d348698788719cfbb78d3faa9f29d253e9af5e94",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/b52bfda2f9a2126b1c3b0f201a12684bf9a215d4"
        },
        "date": 1771226083496,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "62425e4d60b9d27fc0f9f40448ef5cc114707e36",
          "message": "Add files via upload",
          "timestamp": "2026-02-16T08:41:37+01:00",
          "tree_id": "a9171aef9bd7b566d85f452f51d777ce9d6f3819",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/62425e4d60b9d27fc0f9f40448ef5cc114707e36"
        },
        "date": 1771227809832,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f792945bd82fd9479a0d0408498b789a7777ed29",
          "message": "Add files via upload",
          "timestamp": "2026-02-16T10:42:19+01:00",
          "tree_id": "95f3b4957ba8e73982f6315d086b98418c106efb",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/f792945bd82fd9479a0d0408498b789a7777ed29"
        },
        "date": 1771235053034,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "markmocasa@gmail.com",
            "name": "markmocasa-boop",
            "username": "markmocasa-boop"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "719e260044f09c44c5f3611f16f367b74f6202bf",
          "message": "Merge pull request #28 from markmocasa-boop/claude/comment-analysis-workflow-Ppl2a\n\nReplace HTTP-Requests with native n8n nodes where possible",
          "timestamp": "2026-02-16T16:13:58+01:00",
          "tree_id": "e798e1c879a433a6d9de78c0eb0968ba1d054341",
          "url": "https://github.com/markmocasa-boop/n8n-mcp-czlon/commit/719e260044f09c44c5f3611f16f367b74f6202bf"
        },
        "date": 1771254956626,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "sample - array sorting - small",
            "value": 0.0136,
            "range": "0.3096",
            "unit": "ms",
            "extra": "73341 ops/sec"
          }
        ]
      }
    ]
  }
}