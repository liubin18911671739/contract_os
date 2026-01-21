你是 Claude Code，具备在本地仓库创建/修改文件、运行命令、排查并修复报错、直至项目可运行的能力。请从零生成一个“合同预审系统（多智能体 + 知识库 + 本地大模型 vLLM）”的单仓库（monorepo）项目：前端 React+Tailwind 与后端 Node+Fastify 在同一个项目中，并提供一键启动脚本。项目必须在本地可运行，PoC 阶段允许对 PDF/DOCX 解析做简化，但必须保留可替换的真实实现接口；模型推理必须使用本地 vLLM（OpenAI 兼容 API），并明确区分 chat / embedding / rerank 三类模型服务。GPU 环境为单卡 RTX 4090（24GB）。

======================== 0. 总体目标（必须达成）
========================
A) 前端闭环：
创建知识库集合 -> 导入 KB 文档并完成索引 -> 上传合同 -> 创建预审任务（选择 KB 集合与 kb_mode） -> 查看处理进度 Timeline -> 查看风险结果/证据链/KB 引用 -> 审阅确认或驳回 -> 编辑建议并生成修订 -> 生成并下载报告。
B) 后端架构：
Fastify API + BullMQ 编排 Orchestrator + 多 Agent Worker；阶段化处理；所有阶段写 task_events Timeline；所有模型调用必须走 vLLM（本地推理）。
C) 知识库：
Postgres + pgvector，支持导入、切分、embedding、向量检索、rerank 重排、任务快照冻结版本，保证可回放。
D) 工程交付：
docker-compose 一键启动 postgres/redis/minio/vllm 三服务 + 前后端同时启动脚本 + migrations + 最少 3 个测试 + README 可复制执行。
E) 关键验收：

1.  UI 跑通完整闭环；
2.  curl 能跑通最小链路；
3.  Orchestrator 状态机推进、progress 与 task_events 正确；
4.  QC 能对 KB 引用回链校验（chunk_id 存在、版本匹配快照），不通过则 hallucination_suspect=true。

========================

1. # 技术栈与硬性约束（必须遵守）

1) Monorepo：根目录一个仓库，包含 client/ 与 server/ 子项目；根 package.json 提供 dev/build/test 脚本（推荐 npm workspaces）。
2) 全仓库默认使用 TypeScript（前后端一致）；如需例外必须说明原因但尽量不要。
3) 前端：React + Vite + TailwindCSS；UI 组件用 Tailwind 手写，不引入重 UI 框架。
4) 后端：Node.js + Fastify + pino logger；输入校验用 zod（至少关键接口）。
5) 队列：BullMQ + Redis；所有长任务必须队列化。
6) 数据库：PostgreSQL + pgvector（必须启用扩展）；提供 migrations（推荐 node-pg-migrate）。
7) 对象存储：MinIO（合同原件、KB 原件、解析产物、报告文件）。
8) 本地模型：vLLM OpenAI-Compatible Server 三实例：
   - vllm-chat：Qwen/Qwen2.5-7B-Instruct（8000）
   - vllm-embed：BAAI/bge-m3（8001）
   - vllm-rerank：BAAI/bge-reranker-v2-m3（8002）
     GPU：RTX 4090（24GB）。必须在 docker-compose 中声明 GPU，并通过 OpenAI 兼容端点访问（/v1）。
9) 结构化输出：LLM Agent 输出必须严格 JSON Schema；后端校验失败重试一次；再失败降级 NEEDS_REVIEW，不得阻塞全任务。
10) 证据链：每条风险必须回链合同条款证据（clause_id + quote/offset）与 KB 引用（chunk_id + quote），QC 校验回链有效性；无回链标 hallucination 风险并降级或进入人工复核队列。
11) 任务快照：创建任务时冻结 ruleset_version、model_config_json、prompt_template_version、kb_collection_versions_json，并写 task_kb_snapshots；若 API 传 task_id，则 KB 检索必须按快照过滤。
12) 禁止外网模型：不得调用 OpenAI/外网；所有模型请求只能通过你实现的 ModelGateway 指向 vLLM。

======================== 2. 仓库结构（必须生成）
========================
repo-root/
package.json
docker-compose.yml
.env.example
README.md
scripts/
wait-for.ts # 等待依赖就绪（DB/Redis/MinIO/vLLM）
seed-demo.ts # 可选：插入 demo KB/合同（PoC）
client/
package.json
vite.config.ts
tailwind.config.ts
postcss.config.cjs
src/
main.tsx
App.tsx
routes.tsx
api/
http.ts
contracts.ts
tasks.ts
risks.ts
reports.ts
kb.ts
components/
ui/
Button.tsx
Input.tsx
Select.tsx
Badge.tsx
Alert.tsx
Table.tsx
Tabs.tsx
Modal.tsx
Stepper.tsx
Timeline.tsx
Progress.tsx
Skeleton.tsx
pages/
Dashboard.tsx
NewTaskUpload.tsx
Processing.tsx
Results.tsx
Review.tsx
Report.tsx
KBAdmin.tsx
styles/
index.css
server/
package.json
.env.example
src/
server.ts
app.ts
config/
env.ts
logger.ts
db.ts
redis.ts
minio.ts
model.ts # vLLM 配置与模型路由
llm/
modelGateway.ts # chat/embed/rerank 统一客户端（OpenAI 兼容）
schemas.ts # LLM 输出 JSON schemas（zod）
prompts/
risk.ts # 风险分析 prompt（严格 JSON）
repair.ts # schema 修复 prompt（重试）
db/
migrations/
001_init.sql # 或 ts migration（需含 pgvector）
migrate.ts
routes/
health.ts
contracts.ts
tasks.ts
risks.ts
reports.ts
kb.ts
schemas/
http.ts # 统一错误响应 schema
task.ts
clause.ts
risk.ts
evidence.ts
kb.ts
report.ts
services/
contractService.ts
taskService.ts
kbService.ts
retrievalService.ts
reportService.ts
auditService.ts
queues/
index.ts
orchestrator.queue.ts
agents/
parse.queue.ts
split.queue.ts
rules.queue.ts
kbRetrieval.queue.ts
llmRisk.queue.ts
evidence.queue.ts
qc.queue.ts
report.queue.ts
kb/
ingest.queue.ts
index.queue.ts
workers/
orchestrator.worker.ts
agents/
parse.worker.ts
split.worker.ts
rules.worker.ts
kbRetrieval.worker.ts
llmRisk.worker.ts
evidence.worker.ts
qc.worker.ts
report.worker.ts
kb/
ingest.worker.ts
index.worker.ts
agents/
baseAgent.ts
parseAgent.ts
splitAgent.ts
rulesAgent.ts
kbRetrievalAgent.ts
llmRiskAgent.ts
evidenceAgent.ts
qcAgent.ts
reportAgent.ts
utils/
retry.ts
time.ts
hash.ts
pagination.ts
promptGuard.ts
sanitize.ts
tests/
orchestrator.test.ts
kbSnapshotFilter.test.ts
citationBacklink.test.ts

======================== 3. docker-compose（必须包含并可一键启动）
========================
必须包含：

- postgres（启用 pgvector 扩展；初始化脚本确保 CREATE EXTENSION vector）
- redis
- minio（含 console）
- vllm-chat（Qwen/Qwen2.5-7B-Instruct）端口 8000
- vllm-embed（BAAI/bge-m3）端口 8001
- vllm-rerank（BAAI/bge-reranker-v2-m3）端口 8002

vLLM 参数（4090 24GB 保守稳态基线）：

- chat：
  --gpu-memory-utilization=0.90
  --max-model-len=8192
  --max-num-seqs=8
  --max-num-batched-tokens=8192
- embed / rerank：
  --gpu-memory-utilization=0.60
  --max-num-seqs=32

要求：

- compose 中为 vLLM 服务声明 GPU（NVIDIA runtime/设备），README 说明需要 nvidia-container-toolkit。
- server 通过容器网络调用 vLLM 的 /v1 端点（http://vllm-chat:8000/v1），不走宿主机端口。
- postgres 初始化要自动启用 vector 扩展（可用 docker-entrypoint-initdb.d）。

======================== 4. 环境变量（必须提供 .env.example）
========================
根 .env.example 与 server/.env.example 至少包含：

- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_precheck
- REDIS_URL=redis://localhost:6379
- MINIO_ENDPOINT=localhost
- MINIO_PORT=9000
- MINIO_ACCESS_KEY=minioadmin
- MINIO_SECRET_KEY=minioadmin
- MINIO_BUCKET=contract-precheck
- VLLM_API_KEY=token-local
- VLLM_CHAT_BASE_URL=http://vllm-chat:8000/v1
- VLLM_EMBED_BASE_URL=http://vllm-embed:8001/v1
- VLLM_RERANK_BASE_URL=http://vllm-rerank:8002/v1
- RISK_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
- EMBED_MODEL=BAAI/bge-m3
- RERANK_MODEL=BAAI/bge-reranker-v2-m3

======================== 5. 后端功能（必须实现：API + 多智能体 + KB + vLLM）
========================
5.1 健康检查

- GET /api/health：检查 DB/Redis/MinIO/vLLM（简单 ping）连通性，返回 ok/latency。

  5.2 合同与版本

- POST /api/contracts：创建合同（contract_name, counterparty?, contract_type?）
- POST /api/contracts/:id/versions：multipart 上传合同文件 -> 存 MinIO -> 写 contract_versions（sha256,mime,object_key,version_no）
  PoC：至少支持 txt；pdf/docx 可 stub（写明扩展点），但接口与数据流必须贯通。

  5.3 预审任务（任务快照 + 队列编排）

- POST /api/precheck-tasks
  body: { contract_version_id, template_id?, kb_collection_ids: string[], kb_mode:"STRICT"|"RELAXED" }
  必须：
  1. 创建 precheck_tasks（status=QUEUED, progress=0, current_stage=QUEUED, kb_mode）
  2. 创建 config_snapshots：冻结 ruleset_version、model_config_json（含三模型名/关键参数）、prompt_template_version、kb_collection_versions_json
  3. 写 task_kb_snapshots：对每个 collection 冻结 collection_version（当时最新）
  4. 入队 precheck.orchestrator（job.data 统一协议）
- GET /api/precheck-tasks/:id：返回 status/progress/current_stage/error
- GET /api/precheck-tasks/:id/events：Timeline（task_events）
- POST /api/precheck-tasks/:id/cancel：设置 cancel_requested=true；Orchestrator/Agents 必须检查并尽快退出
- GET /api/precheck-tasks/:id/summary
- GET /api/precheck-tasks/:id/clauses?risk_level=&q=&page=

  5.4 风险与审阅

- GET /api/risks/:riskId：包含 rule_hits、evidences（合同/KB）、kb_citations、suggestion、confidence、qc_flags
- POST /api/risks/:riskId/decision：{ action:"confirm"|"dismiss", notes? }（写 audit_logs）
- POST /api/risks/:riskId/suggestion：{ suggestion_text }（写 suggestions 与 suggestion_revisions）
- POST /api/precheck-tasks/:id/conclusion：{ conclusion:"APPROVE"|"MODIFY"|"ESCALATE", notes? }

  5.5 报告

- POST /api/precheck-tasks/:id/report：{ template_id?, include_evidence?, include_kb?, include_audit? } -> 入队 report agent
- GET /api/reports/:reportId/download：鉴权后 stream MinIO（PoC 可简化鉴权，但需预留）

  5.6 知识库（KB）

- POST /api/kb/collections：{ name, scope:"GLOBAL"|"TENANT"|"PROJECT"|"DEPT" }
- GET /api/kb/collections
- POST /api/kb/documents：multipart 上传 KB 文档 -> MinIO -> 写 kb_documents（版本递增）-> 入队 kb.ingest 与 kb.index
- GET /api/kb/documents?collection_id=
- POST /api/kb/search：{ query, collection_ids, top_k, task_id? }
  - 若提供 task_id：必须按 task_kb_snapshots 冻结版本过滤
  - 实现：embed(query) -> pgvector topK(默认20) -> rerank -> topN(默认6-8)
- GET /api/kb/chunks/:id：返回 chunk 文本与元数据（供前端查看引用上下文）

======================== 6. 数据库与 migrations（必须提供并可运行）
========================
6.1 必需表（字段最小集但必须支撑功能）
合同与任务：

- contracts(id, contract_name, counterparty, contract_type, created_at)
- contract_versions(id, contract_id, version_no, object_key, sha256, mime, created_at)
- precheck_tasks(id, contract_version_id, status, progress, current_stage, config_snapshot_id, cancel_requested, kb_mode, error_message, created_at, updated_at)
- task_events(id, task_id, ts, stage, level, message, meta_json)

条款与风险：

- clauses(id, task_id, clause_id, title, text, page_ref, order_no)
- risks(id, task_id, clause_id, risk_level, risk_type, confidence, summary, status, qc_flags_json)
- rule_hits(id, risk_id, rule_id, rule_name, matched_text, meta_json)
- evidences(id, risk_id, source_type="CONTRACT"|"KB", quote_text, start_offset, end_offset, page_ref, chunk_id)

审阅与报告与审计：

- suggestions(id, risk_id, suggestion_text, created_by, created_at)
- suggestion_revisions(id, suggestion_id, revision_no, suggestion_text, created_by, created_at)
- reviews(id, task_id, conclusion, notes, created_by, created_at)
- reports(id, task_id, object_key, template_id, created_at)
- audit_logs(id, actor, action, object_type, object_id, ts, meta_json)

KB：

- kb_collections(id, name, scope, version, is_enabled, created_at)
- kb_documents(id, collection_id, title, doc_type, object_key, version, hash, created_at)
- kb_chunks(id, document_id, chunk_no, text, meta_json)
- kb_embeddings(chunk_id, embedding vector) # pgvector
- kb_citations(id, risk_id, chunk_id, score, quote_text, doc_version, created_at)

快照：

- config_snapshots(id, ruleset_version, model_config_json, prompt_template_version, kb_collection_versions_json, created_at)
- task_kb_snapshots(id, task_id, collection_id, collection_version, frozen_at)

  6.2 必须启用 pgvector

- migrations 中确保 CREATE EXTENSION IF NOT EXISTS vector;

======================== 7. 多智能体（必须可运行且可观测）
========================
7.1 队列（BullMQ）必须包含：

- precheck.orchestrator
- precheck.agent.parse
- precheck.agent.split
- precheck.agent.rules
- precheck.agent.kbRetrieval
- precheck.agent.llmRisk
- precheck.agent.evidence
- precheck.agent.qc
- precheck.agent.report
- kb.ingest
- kb.index

  7.2 Orchestrator 状态机（必须实现）
  QUEUED -> PARSING -> STRUCTURING -> RULE_SCORING -> KB_RETRIEVAL -> LLM_RISK -> EVIDENCING -> QCING -> DONE
  任意阶段失败 -> FAILED
  要求：

- 每阶段开始/结束/错误写入 task_events
- 更新 precheck_tasks.progress（0-100）与 current_stage
- 检查 cancel_requested 及时终止
- LLM 风险分析按 clause fan-out（按条款并行），并发受队列控制

  7.3 Agent 统一协议（强制）
  job.data：{ taskId, traceId, stage, payload }
  agent 返回：{ ok, taskId, traceId, stage, metrics:{elapsedMs}, result }
  失败：{ ok:false, error:{code,message,retryable} }
  Orchestrator：按 retryable 做 1 次重试；kb_mode=RELAXED 时允许 KB_RETRIEVAL 失败继续，但 QC 标注“缺失 KB 依据”。

  7.4 关键：必须保证 risk 与 citations 可关联（禁止“引用丢链”）
  必须实现以下推荐方案（强制，不得省略）：

- 新增临时表：kb_hits_temp(id, task_id, clause_id, chunk_id, score, quote_text, doc_title, doc_version, created_at)
- KB Retrieval Agent 对每个 clause 写入 kb_hits_temp（topN=6-8 或 topK=20 同时保留都可）
- LLM Risk Agent 生成 risks 落库后：
  - 对每条 risk，按其 clause_id 查询 kb_hits_temp，写入 kb_citations(risk_id, chunk_id, score, quote_text, doc_version)
  - 然后 Evidence Agent 再把 kb_citations 中的 quote_text 也落入 evidences(source_type="KB", chunk_id=...) 或直接在 Evidence Agent 读取 kb_hits_temp/kb_citations 落 evidences
    最终 Review 页面必须能通过 risk_id -> kb_citations -> kb_chunks 查看上下文。

  7.5 PoC 行为要求（必须贯通，但接口可替换）

- Parse Agent：txt 真实读取；pdf/docx stub（以占位文本模拟解析结果），README 写扩展点。
- Split Agent：按简单编号/换行切 clauses；写 clauses 表。
- Rules Agent：内置少量关键词/正则规则（付款期限过长/违约责任缺失/管辖不利等），写 rule hits 或 rule hints（最终需关联到 risks）。
- KB Ingest：解析 KB 文档为文本 -> chunk（800-1200 tokens overlap 100-200）-> 写 kb_chunks。
- KB Index：调用 vllm-embed /v1/embeddings 生成向量 -> 写 kb_embeddings（不得随机向量）。
- KB Retrieval：对每个 clause 构造 query（clause_text + rule_hint，需限长）-> embed -> pgvector topK=20 -> rerank -> topN=6-8 -> 写 kb_hits_temp。
- LLM Risk Agent（必须调用 vllm-chat /v1/chat/completions）：
  输入：clause + rule_hits/hints + kb_hits_temp(topN)
  输出：严格 JSON（只输出 JSON，不含解释文本）。输出 schema：
  {
  "risks": [
  {
  "clause_id": "string",
  "risk_level": "HIGH|MEDIUM|LOW|INFO",
  "risk_type": "string",
  "confidence": number(0-1),
  "summary": "string",
  "suggestion": "string",
  "contract_evidence": { "clause_id":"string", "quote_text":"string", "start_offset"?:number, "end_offset"?:number },
  "kb_evidence": [
  { "chunk_id":"string", "quote_text":"string", "doc_title":"string", "doc_version":"string" }
  ]
  }
  ]
  }
  约束：后端 zod 校验；失败重试一次（用 repair prompt 强制只输出 JSON）；再失败写 NEEDS_REVIEW（风险记录仍要落库，便于人工复核），并继续流程。
- Evidence Agent：将 contract_evidence 与 kb_evidence 落 evidences 表（CONTRACT/KB），KB 必须 chunk_id。
- QC Agent：
  - 校验 kb_evidence.chunk_id 是否存在；
  - 若 task 有快照：校验该 chunk 所属 document.version 与 task_kb_snapshots 冻结版本一致；
  - 不一致或不存在：qc_flags_json.hallucination_suspect=true；
  - HIGH 风险若无合同证据与 KB 依据：降级为 MEDIUM/INFO 或标记 NEEDS_REVIEW（策略必须实现并写入 qc_flags_json）。
- Report Agent：生成 JSON 或 HTML 报告（包含风险列表、证据链、KB 引用、审阅结论、审计摘要、任务快照摘要）-> 上传 MinIO -> 写 reports 表 -> 前端可下载。

并发基线（写在 worker 配置中，可调）：

- llmRisk concurrency=3
- evidence concurrency=3
- kb.index concurrency=2

======================== 8. 前端（React+Tailwind）必须可用
========================
页面：

- Dashboard：任务列表（status/progress/current_stage）、进入详情
- KBAdmin：创建集合、上传 KB 文档、查看文档列表与索引状态、检索试用（/api/kb/search）
- NewTaskUpload：上传合同文件、选择 KB 集合（多选）、选择 kb_mode（STRICT/RELAXED）、创建任务
- Processing：轮询 /api/precheck-tasks/:id 与 /events，展示 Stepper + Timeline
- Results：风险统计、风险表格（筛选 risk_level）、进入 Review
- Review：左侧条款/风险列表；右侧 Tabs：
  - Overview（summary/suggestion/confidence）
  - Evidence（合同证据 + KB 引用列表；KB 引用可点击查看 chunks/:id）
  - Actions（confirm/dismiss、编辑 suggestion 并保存 revision）
- Report：生成报告按钮 + 报告列表 + 下载链接

UI 组件必须实现：Button/Input/Select/Badge/Alert/Table/Tabs/Modal/Stepper/Timeline/Progress/Skeleton
风险 Badge 映射（Tailwind）：

- HIGH: red
- MEDIUM: amber
- LOW: emerald
- INFO: blue

======================== 9. 测试（必须最少 3 个）
========================
使用 vitest 或 node:test（后端）：

1. kbSnapshotFilter.test：给定 task_kb_snapshots，kb/search 在传 task_id 时必须只返回冻结版本文档的 chunks
2. citationBacklink.test：给定不存在 chunk_id 或版本不匹配的 kb_evidence，QC 必须标注 hallucination_suspect=true
3. orchestrator.test：模拟完整成功路径（可用 stub parse/llm），验证任务状态推进、progress 更新、task_events 写入完整

======================== 10. 根目录脚本（必须实现）
========================
根 package.json scripts 至少包含：

- dev：并行启动 server 与 client（concurrently）
- build：分别 build client/server
- test：运行 server tests
- docker:up：docker compose up -d
- docker:down：docker compose down
- db:migrate：执行 migrations（并可在 CI/本地重复执行）
- wait：等待 DB/Redis/MinIO/vLLM 就绪（调用 scripts/wait-for.ts）

======================== 11. README（必须可复制执行）
========================
README 必须包含：

- 环境要求：Node 版本、Docker、nvidia-container-toolkit（GPU）
- 一键启动（最短路径）：
  1. docker compose up -d
  2. npm install
  3. npm run db:migrate
  4. npm run dev
- 访问地址：
  - 前端：http://localhost:5173（或 Vite 默认）
  - 后端：http://localhost:3000/api
  - MinIO Console：http://localhost:9001
- UI 操作步骤：KBAdmin 导入 -> NewTaskUpload 创建任务 -> Processing -> Review -> Report 下载
