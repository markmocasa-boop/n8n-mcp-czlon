# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n-mcp is a comprehensive documentation and knowledge server that provides AI assistants with complete access to n8n node information through the Model Context Protocol (MCP). It serves as a bridge between n8n's workflow automation platform and AI models, enabling them to understand and work with n8n nodes effectively.

### Current Architecture:
```
src/
├── loaders/
│   └── node-loader.ts         # NPM package loader for both packages
├── parsers/
│   ├── node-parser.ts         # Enhanced parser with version support
│   └── property-extractor.ts  # Dedicated property/operation extraction
├── mappers/
│   └── docs-mapper.ts         # Documentation mapping with fixes
├── database/
│   ├── schema.sql             # SQLite schema
│   ├── node-repository.ts     # Data access layer
│   └── database-adapter.ts    # Universal database adapter (NEW in v2.3)
├── services/
│   ├── property-filter.ts     # Filters properties to essentials (NEW in v2.4)
│   ├── example-generator.ts   # Generates working examples (NEW in v2.4)
│   ├── task-templates.ts      # Pre-configured node settings (NEW in v2.4)
│   ├── config-validator.ts    # Configuration validation (NEW in v2.4)
│   ├── enhanced-config-validator.ts # Operation-aware validation (NEW in v2.4.2)
│   ├── node-specific-validators.ts  # Node-specific validation logic (NEW in v2.4.2)
│   ├── property-dependencies.ts # Dependency analysis (NEW in v2.4)
│   ├── expression-validator.ts # n8n expression syntax validation (NEW in v2.5.0)
│   └── workflow-validator.ts  # Complete workflow validation (NEW in v2.5.0)
├── templates/
│   ├── template-fetcher.ts    # Fetches templates from n8n.io API (NEW in v2.4.1)
│   ├── template-repository.ts # Template database operations (NEW in v2.4.1)
│   └── template-service.ts    # Template business logic (NEW in v2.4.1)
├── scripts/
│   ├── rebuild.ts             # Database rebuild with validation
│   ├── validate.ts            # Node validation
│   ├── test-nodes.ts          # Critical node tests
│   ├── test-essentials.ts     # Test new essentials tools (NEW in v2.4)
│   ├── test-enhanced-validation.ts # Test enhanced validation (NEW in v2.4.2)
│   ├── test-workflow-validation.ts # Test workflow validation (NEW in v2.5.0)
│   ├── test-ai-workflow-validation.ts # Test AI workflow validation (NEW in v2.5.1)
│   ├── test-mcp-tools.ts      # Test MCP tool enhancements (NEW in v2.5.1)
│   ├── test-n8n-validate-workflow.ts # Test n8n_validate_workflow tool (NEW in v2.6.3)
│   ├── test-typeversion-validation.ts # Test typeVersion validation (NEW in v2.6.1)
│   ├── test-workflow-diff.ts  # Test workflow diff engine (NEW in v2.7.0)
│   ├── test-tools-documentation.ts # Test tools documentation (NEW in v2.7.3)
│   ├── fetch-templates.ts     # Fetch workflow templates from n8n.io (NEW in v2.4.1)
│   └── test-templates.ts      # Test template functionality (NEW in v2.4.1)
├── mcp/
│   ├── server.ts              # MCP server with enhanced tools
│   ├── tools.ts               # Tool definitions including new essentials
│   ├── tools-documentation.ts # Tool documentation system (NEW in v2.7.3)
│   └── index.ts               # Main entry point with mode selection
├── utils/
│   ├── console-manager.ts     # Console output isolation (NEW in v2.3.1)
│   └── logger.ts              # Logging utility with HTTP awareness
├── http-server-single-session.ts  # Single-session HTTP server (NEW in v2.3.1)
├── mcp-engine.ts              # Clean API for service integration (NEW in v2.3.1)
└── index.ts                   # Library exports
```

## Common Development Commands

```bash
# Build and Setup
npm run build          # Build TypeScript (always run after changes)
npm run rebuild        # Rebuild node database from n8n packages
npm run validate       # Validate all node data in database

# Testing
npm test               # Run all tests
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests
npm run test:coverage  # Run tests with coverage report
npm run test:watch     # Run tests in watch mode

# Run a single test file
npm test -- tests/unit/services/property-filter.test.ts

# Linting and Type Checking
npm run lint           # Check TypeScript types (alias for typecheck)
npm run typecheck      # Check TypeScript types

# Running the Server
npm start              # Start MCP server in stdio mode
npm run start:http     # Start MCP server in HTTP mode
npm run dev            # Build, rebuild database, and validate
npm run dev:http       # Run HTTP server with auto-reload

# Update n8n Dependencies
npm run update:n8n:check  # Check for n8n updates (dry run)
npm run update:n8n        # Update n8n packages to latest

# Database Management
npm run db:rebuild     # Rebuild database from scratch
npm run migrate:fts5   # Migrate to FTS5 search (if needed)

# Template Management
npm run fetch:templates  # Fetch latest workflow templates from n8n.io
npm run test:templates   # Test template functionality
```

## High-Level Architecture

### Core Components

1. **MCP Server** (`mcp/server.ts`)
   - Implements Model Context Protocol for AI assistants
   - Provides tools for searching, validating, and managing n8n nodes
   - Supports both stdio (Claude Desktop) and HTTP modes

2. **Database Layer** (`database/`)
   - SQLite database storing all n8n node information
   - Universal adapter pattern supporting both better-sqlite3 and sql.js
   - Full-text search capabilities with FTS5

3. **Node Processing Pipeline**
   - **Loader** (`loaders/node-loader.ts`): Loads nodes from n8n packages
   - **Parser** (`parsers/node-parser.ts`): Extracts node metadata and structure
   - **Property Extractor** (`parsers/property-extractor.ts`): Deep property analysis
   - **Docs Mapper** (`mappers/docs-mapper.ts`): Maps external documentation

4. **Service Layer** (`services/`)
   - **Property Filter**: Reduces node properties to AI-friendly essentials
   - **Config Validator**: Multi-profile validation system
   - **Expression Validator**: Validates n8n expression syntax
   - **Workflow Validator**: Complete workflow structure validation

5. **Template System** (`templates/`)
   - Fetches and stores workflow templates from n8n.io
   - Provides pre-built workflow examples
   - Supports template search and validation

### Key Design Patterns

1. **Repository Pattern**: All database operations go through repository classes
2. **Service Layer**: Business logic separated from data access
3. **Validation Profiles**: Different validation strictness levels (minimal, runtime, ai-friendly, strict)
4. **Diff-Based Updates**: Efficient workflow updates using operation diffs

### MCP Tools Architecture

The MCP server exposes tools in several categories:

1. **Discovery Tools**: Finding and exploring nodes
2. **Configuration Tools**: Getting node details and examples
3. **Validation Tools**: Validating configurations before deployment
4. **Workflow Tools**: Complete workflow validation
5. **Management Tools**: Creating and updating workflows (requires API config)

## Current Session Context (Updated: 2025-09-28)

### MCP Server Configuration Status ✅ RESOLVED
**Problem**: User experienced missing N8N MCP tools in VS Code Claude extension
**Root Cause**: MCP server configuration was missing from VS Code settings
**Solution Applied**: Added complete MCP server configuration to `/Users/Stefan/Library/Application Support/Code/User/settings.json`

**Configured MCP Servers**:
1. **n8n-mcp** - Complete n8n documentation server (42 tools)
   - Command: `npx n8n-mcp`
   - Working Directory: `/Users/Stefan/Documents/N8N-PROJECT/n8n-mcp`
   - API URL: `https://stefan.evofin.de`
   - Status: ✅ Server tested and functional

2. **microsoft365-admin** - Microsoft 365 administration tools
   - Command: `@pnp/cli-microsoft365-mcp-server`
   - Tenant ID configured
   - Status: ✅ Configuration added

3. **azure-infrastructure** - Azure infrastructure management
   - Command: `@azure/mcp`
   - Azure subscription and tenant configured
   - Status: ✅ Configuration added

**Next Action Required**: User must restart VS Code to load the new MCP server configuration.

### Environment Details
- **Platform**: macOS Darwin 25.0.0 (ARM64)
- **Node.js**: v24.9.0
- **Project Version**: n8n-mcp v2.13.2
- **Database**: SQLite with better-sqlite3, FTS5 not available (using LIKE search)
- **Git Status**: Clean working directory on main branch
- **N8N API**: Configured and working at stefan.evofin.de

### SCAN v2.0.3 Enhanced - N8N Integration Status

**✅ COMPLETED:**
- ✅ SCAN v2.0.3 Enhanced Workflow successfully imported to N8N at stefan.evofin.de
- ✅ Workflow ID: `2biV9D8YcWBtkevY`
- ✅ 19 Nodes completely imported with all processing features:
  - PDF File Trigger (File System Monitor)
  - Adobe PDF Services (Extract + OCR APIs)
  - OpenAI Categorization with medical special handling
  - Enhanced Filename Generator with medical document naming logic
  - Dual Feedback Systems (Universal confidence + Bewirtungsbeleg completion)
  - PDF Metadata Embedding (full text in Subject field)
  - Supabase Integration for complete document lifecycle tracking
- ✅ N8N API Key working: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxYWRmMTViMy0yNTA4LTQwZDItOTVkZC1mMGYxMjkyZmM0YzciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU4NzI4MjQxfQ.APyjAO11-36zdv2gRapGFWOpq-yrlcvMruxtKIFrOeQ`

**📋 NEXT STEPS AFTER MAC RESTART:**
1. **Configure N8N Variables** (15 variables - manual via UI, license limitation):
   - ADOBE_CLIENT_ID: `20d5d9e976c94738998950425f1bb743`
   - ADOBE_CLIENT_SECRET: `p8e-MwBTUYlpJ0B0K-Nd7FwCrqU8ekKQtVWu`
   - ADOBE_ACCESS_TOKEN: [User's actual Adobe token]
   - ADOBE_PDF_SERVICES_BASE_URL: `https://pdf-services.adobe.io/api/v1`
   - OPENAI_API_KEY: [User's OpenAI key]
   - OPENAI_PRIMARY_MODEL: `gpt-4o-mini`
   - SUPABASE_URL: [User's Supabase URL]
   - SUPABASE_SERVICE_KEY: [User's Supabase service key]
   - SUPABASE_ANON_KEY: [User's Supabase anon key]
   - SCAN_INPUT_DIRECTORY: `/Users/Stefan/Documents/SCAN/input`
   - SCAN_OUTPUT_DIRECTORY: `/Users/Stefan/Documents/SCAN/output`
   - FEEDBACK_EMAIL_RECIPIENT: [User's email]
   - CONFIDENCE_THRESHOLD: `0.99`
   - DEFAULT_OCR_LANGUAGE: `de-DE`

2. **Set up N8N Credentials** (manual via UI):
   - Adobe PDF Services (HTTP Header Auth)
   - OpenAI API (HTTP Header Auth)
   - Supabase API (HTTP Header Auth)
   - Gmail OAuth2 (for feedback emails)

3. **Activate Workflow for Production**

**📄 IMPORTANT FILES CREATED:**
- `enhanced_scan_workflow_v2_3.json` - Complete 19-node N8N workflow
- `n8n_variables.json` - All required N8N variables
- `import_scan_workflow.py` - Import script for workflow
- `MANUAL_IMPORT_INSTRUCTIONS.md` - Manual setup instructions

**🔧 WORKFLOW FEATURES READY:**
- 99.99% accuracy targeting with dual feedback systems
- Medical document special handling (Apotheke vs Arzt naming logic)
- Multi-language OCR (German, English, French, Italian)
- Enhanced filename format: `YYYY-MM-DD_Kategorie_Unterkategorie_Empfänger_Absender_Belegnummer_Betrag.pdf`
- Full text metadata embedding in PDF Subject field
- Automatic directory monitoring and file processing
- Mobile-optimized feedback emails

**🎯 TO RESUME WORK:**
User should say: "Continue with SCAN v2.0.3 Enhanced N8N setup" and Claude will pick up from credential configuration.

## Memories and Notes for Development

### Development Workflow Reminders
- When you make changes to MCP server, you need to ask the user to reload it before you test
- When the user asks to review issues, you should use GH CLI to get the issue and all the comments
- When the task can be divided into separated subtasks, you should spawn separate sub-agents to handle them in parallel
- Use the best sub-agent for the task as per their descriptions

### Testing Best Practices
- Always run `npm run build` before testing changes
- Use `npm run dev` to rebuild database after package updates
- Check coverage with `npm run test:coverage`
- Integration tests require a clean database state

### Common Pitfalls
- The MCP server needs to be reloaded in Claude Desktop after changes
- HTTP mode requires proper CORS and auth token configuration
- Database rebuilds can take 2-3 minutes due to n8n package size
- Always validate workflows before deployment to n8n

### Performance Considerations
- Use `get_node_essentials()` instead of `get_node_info()` for faster responses
- Batch validation operations when possible
- The diff-based update system saves 80-90% tokens on workflow updates

### Agent Interaction Guidelines
- Sub-agents are not allowed to spawn further sub-agents
- When you use sub-agents, do not allow them to commit and push. That should be done by you

### Development Best Practices
- Run typecheck and lint after every code change

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- When you make changes to MCP server, you need to ask the user to reload it before you test
- When the user asks to review issues, you should use GH CLI to get the issue and all the comments
- When the task can be divided into separated subtasks, you should spawn separate sub-agents to handle them in parallel
- Use the best sub-agent for the task as per their descriptions
- Do not use hyperbolic or dramatic language in comments and documentation