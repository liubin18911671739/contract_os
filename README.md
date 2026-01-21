# 合同预审系统（Contract Pre-check System）

一个基于多智能体架构、知识库和本地大语言模型（vLLM）的智能合同预审查系统。

## 系统架构

- **前端**：React + Vite + TailwindCSS
- **后端**：Node.js + Fastify + BullMQ
- **数据库**：PostgreSQL + pgvector（向量检索）
- **队列**：Redis（任务编排）
- **存储**：MinIO（文件对象存储）
- **大模型**：本地 vLLM
  - Chat：Qwen2.5-7B-Instruct（端口 8000）
  - Embed：BGE-M3（端口 8001）
  - Rerank：BGE-Reranker-v2-m3（端口 8002）

## 核心特性

### ✨ 多智能体协作
系统通过 8 个智能体协作完成合同风险分析：

1. **Parse Agent**：解析合同文件（TXT/PDF/DOCX）
2. **Split Agent**：切分合同条款
3. **Rules Agent**：基于规则的关键词匹配
4. **KB Retrieval Agent**：从知识库检索相关法条
5. **LLM Risk Agent**：使用本地大模型分析风险
6. **Evidence Agent**：收集证据链（合同 + KB）
7. **QC Agent**：质量检查（幻觉检测、版本一致性）
8. **Report Agent**：生成审阅报告

### 🎯 任务快照机制
- 创建任务时冻结配置（规则集版本、模型配置、Prompt 版本）
- 冻结 KB 集合版本，确保可回放
- 所有状态变更写入 Timeline 审计日志

### 🔍 证据链追溯
- 每条风险必须包含合同证据（条款引用）
- KB 引用必须回链到具体 Chunk
- QC Agent 自动校验引用有效性
- 无效引用标注 `hallucination_suspect=true`

### 📊 向量检索 + 重排序
- 向量相似度检索（Top-K=20）
- Rerank 模型精排（Top-N=6）
- 支持任务快照版本过滤

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- Docker & Docker Compose
- NVIDIA GPU（建议 RTX 4090 24GB）
- nvidia-container-toolkit（GPU 容器支持）

### 一键启动

#### 1. 启动基础设施服务

```bash
docker compose up -d
```

这会启动：
- PostgreSQL（端口 5432）
- Redis（端口 6379）
- MinIO（端口 9000、9001）
- vLLM Chat（端口 8000）
- vLLM Embed（端口 8001）
- vLLM Rerank（端口 8002）

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

```bash
cp .env.example .env
cp server/.env.example server/.env
```

默认配置即可运行，无需修改。

#### 4. 执行数据库迁移

```bash
npm run db:migrate
```

#### 5. 启动开发服务器

```bash
npm run dev
```

这会同时启动前端和后端服务。

#### 6. 访问应用

- **前端**：http://localhost:5173
- **后端 API**：http://localhost:3000/api
- **MinIO 控制台**：http://localhost:9001（账号：minioadmin/minioadmin）

## 使用流程

### 1. 创建知识库

进入 **Knowledge Base** 页面：
- 创建知识库集合（如"合同法知识库"）
- 上传文档（TXT/PDF/DOCX）
- 系统自动分块、向量化、索引

### 2. 创建预审任务

进入 **New Task** 页面：
- 填写合同基本信息（名称、对方、类型）
- 上传合同文件
- 选择 KB 集合（可多选）
- 选择 KB 模式（STRICT 严格 / RELAXED 宽松）
- 点击创建

### 3. 监控处理进度

系统自动处理，可实时查看：
- 当前处理阶段
- 总体进度条
- Timeline 日志
- 自动跳转至结果页

### 4. 查看分析结果

**Results 页面**展示：
- 风险统计（高/中/低/信息级）
- 条款级风险列表
- 筛选功能

### 5. 人工审核

**Review 页面**支持：
- 左侧：条款/风险列表
- 右侧：详情 Tab（Overview/Evidence/Actions）
- 确认/驳回风险
- 添加审阅建议
- 生成最终结论

## 项目结构

```
contract-precheck/
├── package.json              # Monorepo 根配置
├── docker-compose.yml        # 基础设施服务
├── .env.example             # 环境变量模板
├── README.md                # 项目文档
├── TODO.md                  # 开发进度清单
├── scripts/                 # 工具脚本
│   ├── wait-for.ts         # 等待服务就绪
│   └── seed-demo.ts        # Demo 数据导入
├── client/                  # 前端（React）
│   ├── src/
│   │   ├── api/            # API 客户端
│   │   ├── components/     # UI 组件
│   │   ├── pages/          # 页面组件
│   │   └── styles/         # 全局样式
│   └── package.json
└── server/                  # 后端（Node.js）
    ├── src/
    │   ├── agents/         # Agent 逻辑
    │   ├── config/         # 配置管理
    │   ├── db/             # 数据库（Migrations）
    │   ├── llm/            # LLM 集成
    │   ├── queues/         # BullMQ 队列
    │   ├── routes/         # API 路由
    │   ├── schemas/        # Zod 校验
    │   ├── services/       # 业务逻辑
    │   ├── utils/          # 工具函数
    │   ├── workers/        # 队列 Workers
    │   └── tests/          # 测试套件
    └── package.json
```

## API 接口文档

### 健康检查
- `GET /api/health` - 检查所有服务健康状态

### 合同管理
- `POST /api/contracts` - 创建合同
- `POST /api/contracts/:id/versions` - 上传合同文件
- `GET /api/contracts/:id` - 获取合同详情

### 任务管理
- `POST /api/precheck-tasks` - 创建预审任务
- `GET /api/precheck-tasks/:id` - 获取任务状态
- `GET /api/precheck-tasks/:id/events` - 获取任务时间线
- `POST /api/precheck-tasks/:id/cancel` - 取消任务
- `GET /api/precheck-tasks/:id/summary` - 获取统计摘要
- `GET /api/precheck-tasks/:id/clauses` - 获取条款和风险
- `POST /api/precheck-tasks/:id/conclusion` - 提交审阅结论

### 知识库
- `POST /api/kb/collections` - 创建 KB 集合
- `GET /api/kb/collections` - 列出 KB 集合
- `POST /api/kb/documents` - 上传 KB 文档
- `GET /api/kb/documents` - 列出 KB 文档
- `POST /api/kb/search` - 检索知识库（支持快照过滤）
- `GET /api/kb/chunks/:id` - 获取 Chunk 详情

## 环境变量说明

### 数据库
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_precheck
```

### Redis
```bash
REDIS_URL=redis://localhost:6379
```

### MinIO
```bash
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=contract-precheck
```

### vLLM
```bash
VLLM_CHAT_BASE_URL=http://vllm-chat:8000/v1
VLLM_EMBED_BASE_URL=http://vllm-embed:8001/v1
VLLM_RERANK_BASE_URL=http://vllm-rerank:8002/v1

RISK_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
EMBED_MODEL=BAAI/bge-m3
RERANK_MODEL=BAAI/bge-reranker-v2-m3
```

### 并发配置
```bash
ORCHESTRATOR_CONCURRENCY=1
LLM_RISK_CONCURRENCY=3
EVIDENCE_CONCURRENCY=3
KB_INDEX_CONCURRENCY=2
```

## 测试

```bash
# 运行所有测试
npm test

# 测试文件位于 server/src/tests/
# - kbSnapshotFilter.test.ts
# - citationBacklink.test.ts
# - orchestrator.test.ts
```

## GPU 配置说明

### 当前配置（RTX 4090 24GB）

**Chat 模型**：
- `--gpu-memory-utilization=0.90`
- `--max-model-len=8192`
- `--max-num-seqs=8`

**Embed/Rerank 模型**：
- `--gpu-memory-utilization=0.60`
- `--max-num-seqs=32`

### 调优建议

如遇 OOM（显存不足），可降低 `gpu-memory-utilization` 或 `max-model-len`。

## 故障排查

### vLLM 启动失败
```bash
# 检查 GPU
nvidia-smi

# 查看 vLLM 日志
docker compose logs vllm-chat

# 确认 nvidia-container-toolkit 已安装
sudo apt install nvidia-container-toolkit
```

### 数据库连接失败
```bash
# 检查 Postgres 容器
docker compose ps

# 重新执行迁移
npm run db:migrate
```

### KB 检索无结果
- 确认 KB 文档已上传并完成索引
- 检查 Worker 日志是否有报错
- 验证 Embeddings 是否生成（查询 `kb_embeddings` 表）

## 开发命令

```bash
# 仅启动后端
npm run dev:server

# 仅启动前端
npm run dev:client

# 构建生产版本
npm run build

# 停止基础设施
npm run docker:down

# 查看 Docker 日志
npm run docker:logs
```

## PoC 阶段说明

当前版本为 **PoC（概念验证）**，以下功能做了简化：

### 文件解析
- ✅ TXT：完整实现
- ⚠️ PDF/DOCX：占位实现（返回提示文本）
  - 扩展点：`server/src/workers/agents/parse.worker.ts`

### KB Retrieval
- 当前为简化版（占位数据）
- 生产环境需调用 `retrievalService.retrieveForClause()`

### Report Agent
- 占位实现，未生成真实报告
- 扩展点：`server/src/workers/agents/stubWorkers.ts`

完整扩展指南请查看 [TODO.md](./TODO.md)。

## 性能指标（参考值）

| 操作 | 耗时 |
|------|------|
| 文件上传 | < 5s |
| KB 索引（1000 chunks） | ~ 30s |
| 单合同分析（10 条款） | ~ 2-3 分钟 |
| LLM 风险分析（单条款） | ~ 10s |

## 许可证

MIT

## 贡献指南

欢迎提交 Issue 和 Pull Request！

---

**版本**：v0.1.0 PoC
**更新时间**：2025-01-21
# contract_os
