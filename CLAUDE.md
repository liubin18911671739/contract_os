# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Contract Pre-check System** - A multi-agent contract review system using LLMs (local vLLM or Zhipu Qingyan), knowledge base (PostgreSQL + pgvector), and job queues (BullMQ + Redis).

**Tech Stack**:

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Fastify + TypeScript
- Database: PostgreSQL with pgvector extension
- Queues: BullMQ + Redis
- Storage: MinIO (S3-compatible)
- LLM: Local vLLM (3 instances) OR Zhipu Qingyan (cloud API)
- GPU: RTX 4090 24GB (when using local vLLM)

**Current Version**: v0.3.1 (Production-ready PoC with Zhipu support)

## Essential Commands

### Development

```bash
# Start all services (infrastructure + dev servers)
npm run dev

# Start only backend
npm run dev:server

# Start only frontend
npm run dev:client

# Build for production
npm run build
```

### Infrastructure

```bash
# Start Docker services (Postgres, Redis, MinIO, vLLM instances)
npm run docker:up

# Stop Docker services
npm run docker:down

# View Docker logs
npm run docker:logs

# Wait for all services to be ready
npm run wait
```

### Database

```bash
# Run database migrations
npm run db:migrate

# Import demo data
npm run seed
```

### Testing & Quality

```bash
# Run all unit tests
npm test

# Run performance/load tests
npm run test:load

# Run benchmarks
npm run benchmark

# Lint code
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Architecture

- Monorepo with npm workspaces: `client/` and `server/`
- Root package.json manages workspace-level scripts

## Architecture Overview

### Multi-Agent Pipeline (8 Stages)

The system uses an orchestrator-based multi-agent architecture:

1. **PARSING** (`parse.worker.ts`): Extracts text from contract files (TXT/PDF/DOCX)
2. **STRUCTURING** (`split.worker.ts`): Splits contract into clauses
3. **RULE_SCORING** (`rules.worker.ts`): Keyword/regex pattern matching
4. **KB_RETRIEVAL** (`kbRetrieval.worker.ts`): Vector search + rerank from knowledge base
5. **LLM_RISK** (`llmRisk.worker.ts`): Analyzes risks using local vLLM
6. **EVIDENCING** (`evidence.worker.ts`): Collects evidence chain
7. **QCING** (`qc.worker.ts`): Quality control (hallucination detection, backlink validation)
8. **DONE**: Report generation

**Key Files**:

- `server/src/agents/baseAgent.ts` - Base agent class with common functionality
- `server/src/workers/orchestrator.worker.ts` - State machine managing stage progression
- `server/src/workers/agents/*` - Individual agent implementations
- `server/src/queues/index.ts` - BullMQ queue definitions and worker factory

**Orchestrator Pattern**:

- Sequential stage execution with retry logic (max 1 retry per stage)
- Progress tracking: 0-100% based on completed stages
- Cancellation detection: checks `task.cancel_requested` before each stage
- Job completion waiting uses `job.waitUntilFinished(queueEvents, timeout)`
- All state changes written to `task_events` table for audit trail

### Task Snapshot Mechanism

Critical for reproducibility: When a task is created, the system freezes:

- **Config Snapshot**: Ruleset version, model config, prompt template version (`config_snapshots` table)
- **KB Snapshot**: KB collection versions at task creation time (`task_kb_snapshots` table)

All KB searches filter by these frozen versions to ensure consistent results.

### Evidence Chain & Quality Control

- Each risk MUST have contract evidence (clause citation)
- KB citations MUST link to specific chunks with backlink validation
- QC Agent validates chunk IDs and version consistency
- Invalid references marked `hallucination_suspect=true`

**Key Files**:

- `server/src/services/taskService.ts` - Task lifecycle management
- `server/src/services/kbService.ts` - KB operations with version filtering
- `server/src/services/retrievalService.ts` - Vector search + rerank pipeline

### Vector Retrieval Pipeline

1. **Vector Search** (pgvector): Top-K=20 chunks by cosine similarity
2. **Rerank** (BGE-Reranker-v2-m3): Re-scores to Top-N=6
3. **Snapshot Filter**: Only chunks from frozen KB versions

**Key Files**:

- `server/src/services/retrievalService.ts` - Main retrieval logic
- `server/src/llm/modelGateway.ts` - Unified LLM client (Chat/Embed/Rerank)

## Database Schema Highlights

18+ tables organized into:

- **Core**: `contracts`, `contract_versions`, `precheck_tasks`, `task_events`
- **Analysis**: `clauses`, `risks`, `rule_hits`, `evidences`
- **Knowledge Base**: `kb_collections`, `kb_documents`, `kb_chunks`, `kb_embeddings`, `kb_citations`
- **Snapshots**: `config_snapshots`, `task_kb_snapshots`
- **Temporary**: `kb_hits_temp` (intermediate retrieval results)
- **Review**: `suggestions`, `reviews`, `reports`, `audit_logs`

**Migrations**: `server/src/db/migrations/001_init.sql`

## LLM Integration

### ModelGateway Pattern

All LLM calls go through `ModelGateway` (`server/src/llm/modelGateway.ts`):

```typescript
// Chat completion
await modelGateway.chat(messages, { temperature: 0.7, maxTokens: 1000 });

// Embeddings
await modelGateway.embed(['text1', 'text2']);

// Reranking
await modelGateway.rerank({ query, documents, top_n: 5 });
```

### JSON Schema Validation

LLM outputs validated using Zod schemas (`server/src/llm/schemas.ts`):

- `RiskAnalysisSchema` - Structured risk analysis output
- Fallback to `NEEDS_REVIEW` status on validation failure

### Prompt Templates

Located in `server/src/llm/prompts/`:

- `risk.ts` - Risk analysis and repair prompts

## File Parsing

**Implementation**: `server/src/utils/fileParser.ts`

Supports:

- **TXT**: Native text extraction
- **PDF**: Uses `pdf-parse` library (extracts text + page count)
- **DOCX**: Uses `mammoth` library (extracts raw text + metadata)

Returns `{ text: string, metadata: object }`

## Report Generation

**Implementation**: `server/src/services/reportService.ts`

Generates:

- **HTML reports**: Styled with embedded CSS, stored in MinIO
- **JSON reports**: Structured data for programmatic access

API:

- `POST /api/precheck-tasks/:taskId/report?format=html|json` - Generate report
- `GET /api/reports/:reportId/download` - Download (redirects to MinIO presigned URL)

## Queue System

11 BullMQ queues defined in `server/src/queues/index.ts`:

**Precheck Pipeline**:

- `precheck.orchestrator` (concurrency: 1)
- `precheck.agent.parse` (concurrency: 2)
- `precheck.agent.split` (concurrency: 2)
- `precheck.agent.rules` (concurrency: 1)
- `precheck.agent.kbRetrieval` (concurrency: 1)
- `precheck.agent.llmRisk` (concurrency: 3)
- `precheck.agent.evidence` (concurrency: 3)
- `precheck.agent.qc` (concurrency: 1)
- `precheck.agent.report` (concurrency: 1)

**Knowledge Base**:

- `kb.ingest` (document parsing + chunking)
- `kb.index` (batch embedding)

**Important Implementation Notes**:

- Redis connection uses type assertion (`redis as any`) to fix ioredis version mismatch with BullMQ
- Each queue has a corresponding `QueueEvents` instance for job completion waiting
- When using `job.waitUntilFinished()`, always pass the QueueEvents object first:
  ```typescript
  const result = await job.waitUntilFinished(queueEvents, timeoutMs);
  ```
- Queue events are exported from `server/src/queues/index.ts` as `queueEvents` object
- All queue events must be closed during shutdown (handled in `closeQueues()`)

## API Routes

**Routes organized by domain** in `server/src/routes/`:

- `health.ts` - Health checks
- `contracts.ts` - Contract CRUD
- `tasks.ts` - Task lifecycle
- `kb.ts` - Knowledge base operations
- `reports.ts` - Report generation/download

All routes use Zod schemas for request validation (`server/src/schemas/`).

## Frontend Architecture

**Pages**: `client/src/pages/`

- `Dashboard.tsx` - Task list with status filtering
- `KBAdmin.tsx` - KB collection management
- `NewTaskUpload.tsx` - Contract upload + task creation
- `Processing.tsx` - Real-time progress monitoring
- `Results.tsx` - Risk display with filtering
- `Review.tsx` - Manual review interface

**UI Components**: `client/src/components/ui/`

- Atomic components with TailwindCSS styling
- `Table` component supports `colSpan` and `className` props

**State Management**: React hooks (useState, useEffect) - no external state library

## Type System Notes

- Uses `any` type extensively in agent system (acceptable for PoC)
- ESLint configured to warn (not error) on `any` and non-null assertions
- When `Promise.all` returns `unknown` tuples, use type assertions: `as any[]`
- Response.json() returns `unknown`, cast with `as ExpectedType`
- Import `sql` from `server/src/config/db.js` for database queries (NOT `request.server.sql`)
- Test files must import `it` from `node:test`: `import { describe, it } from 'node:test';`
- Function return types must match actual returns (e.g., `buildRiskAnalysisPrompt` returns object, not string)

## Common Patterns

### Creating a New Agent

1. Extend `BaseAgent` in `server/src/workers/agents/myAgent.worker.ts`
2. Implement `execute(jobData: AgentJobData)` method
3. Define `readonly stageName = 'MY_STAGE'`
4. Add queue in `server/src/queues/index.ts`
5. Add stage to orchestrator's `STAGES` array

### Adding Database Fields

1. Create migration SQL in `server/src/db/migrations/`
2. Run `npm run db:migrate`
3. Update TypeScript types in `server/src/schemas/`

### Adding API Endpoints

1. Define Zod schema in `server/src/schemas/`
2. Create route handler in `server/src/routes/`
3. Register in `server/src/app.ts`
4. Add API client function in `client/src/api/`

## Environment Variables

**Critical Variables** (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `MINIO_*` - Object storage config

### LLM Provider Configuration

The system supports two LLM providers via `LLM_PROVIDER` environment variable:

#### Option 1: Local vLLM (default)
Set `LLM_PROVIDER=local` (or omit the variable)

```bash
LLM_PROVIDER=local
VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_EMBED_BASE_URL=http://localhost:8001/v1
VLLM_RERANK_BASE_URL=http://localhost:8002/v1
RISK_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
EMBED_MODEL=BAAI/bge-m3
RERANK_MODEL=BAAI/bge-reranker-v2-m3
```

#### Option 2: Zhipu Qingyan (cloud API)
Set `LLM_PROVIDER=zhipu`

```bash
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=your-zhipu-api-key-here
ZHIPU_CHAT_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_EMBED_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_RERANK_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_CHAT_MODEL=glm-4-flash
ZHIPU_EMBED_MODEL=embedding-3
ZHIPU_RERANK_MODEL=rerank-2
```

**Key Files**:
- `server/src/config/env.ts` - Environment validation
- `server/src/config/model.ts` - Provider selection logic
- `server/src/llm/modelGateway.ts` - Unified API client for both providers

**Concurrency Settings**:

- `LLM_RISK_CONCURRENCY=3` - Parallel LLM calls (max: 3)
- `EVIDENCE_CONCURRENCY=3` - Evidence collection
- `KB_INDEX_CONCURRENCY=2` - Batch embedding

## Testing Strategy

**Unit Tests**: `server/src/tests/`

- `*.test.ts` files use Node.js built-in test runner
- Run with `npm test` (uses `--experimental-test-module` flag)
- Tests validate core business logic (snapshot filtering, backlink validation, orchestrator flow)

**E2E Tests**: See `E2E.md` for Playwright setup

**Performance Tests**:

- `npm run test:load` - Load testing framework
- `npm run benchmark` - Performance benchmarks (DB, LLM)

## Troubleshooting

### vLLM Issues

```bash
# Check GPU availability
nvidia-smi

# View vLLM logs
docker compose logs vllm-chat
docker compose logs vllm-embed
docker compose logs vllm-rerank

# Restart vLLM services
docker compose restart vllm-chat
```

### Database Connection

```bash
# Check Postgres is running
docker compose ps

# Re-run migrations
npm run db:migrate

# Connect to database
psql $DATABASE_URL
```

### KB Search Returns No Results

1. Verify KB documents are uploaded and indexed
2. Check `kb_embeddings` table has data: `SELECT COUNT(*) FROM kb_embeddings;`
3. Check worker logs for errors
4. Verify pgvector extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'vector';`

### Build Errors

```bash
# Clean and rebuild
rm -rf node_modules client/node_modules server/node_modules
npm install
npm run build
```

## Known Limitations (PoC)

1. **User Authentication**: Not implemented (open API)
2. **WebSocket**: No real-time updates (polling-based)
3. **Batch Operations**: Single contract upload only
4. **Report Customization**: Fixed templates only
5. **Multi-tenancy**: Single-user design

## Version History

- **v0.1.0 PoC** (2025-01-21): Initial PoC
- **v0.2.0** (2025-01-21): PDF/DOCX parsing, KB Retrieval, Report Agent, enhanced tests
- **v0.3.0** (2025-01-21): Report download API, frontend report buttons, performance testing, E2E framework

## GPU Configuration (RTX 4090 24GB)

**Chat Model** (Qwen2.5-7B):

- `--gpu-memory-utilization=0.90`
- `--max-model-len=8192`
- `--max-num-seqs=8`

**Embed/Rerank Models**:

- `--gpu-memory-utilization=0.60`
- `--max-num-seqs=32`

If OOM occurs, reduce `gpu-memory-utilization` or `max-model-len` in `docker-compose.yml`.
