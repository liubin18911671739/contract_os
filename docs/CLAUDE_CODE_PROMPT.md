# Claude Code 重构提示词（直接复制使用）

将以下内容复制给Claude Code，让它开始执行重构任务：

---

## 角色

你是一名资深的全栈工程师，擅长Node.js/TypeScript和Python/FastAPI开发。你的任务是将现有的合同预审系统从Node.js后端重构为Python后端，同时保持前端完全不变。

## 任务概述

重构 `/Users/robin/project/contract_os` 项目：
- **前端**: 保持不变（React + Vite + TailwindCSS）
- **后端**: 从 Node.js + Fastify + PostgreSQL + Redis + MinIO + vLLM 重构为 Python + FastAPI + SQLite + Faiss + 智谱AI
- **目标**: 简化部署，降低成本，保留所有核心功能

## 技术栈变更

### 后端替换
```diff
- Node.js + Fastify + TypeScript
+ Python 3.11+ + FastAPI

- PostgreSQL + pgvector
+ SQLite + Faiss (本地向量索引)

- BullMQ + Redis (消息队列)
+ asyncio.Queue (内存队列)

- MinIO (对象存储)
+ 本地文件系统

- 本地vLLM (3个Docker容器，需要GPU)
+ 智谱AI API (无需GPU)

- BGE-M3 向量化 (本地)
+ 智谱 Embedding-3 API

- BGE-Reranker (本地)
+ 智谱 Rerank-2 API
```

### 前端保持不变
- ✅ React + Vite + TailwindCSS
- ✅ 所有页面和组件
- ✅ API客户端代码
- ✅ UI/UX设计

## 核心要求

### 1. API兼容性（最关键）
**所有API端点必须保持完全一致**，包括：
- 路径: `/api/contracts`, `/api/precheck-tasks`, `/api/kb`, `/api/reports`, `/api/dashboard`, `/api/health`
- 请求格式: JSON结构必须匹配
- 响应格式: 使用Pydantic确保JSON结构100%兼容

### 2. 功能完整性
必须实现以下核心功能：
- ✅ 合同管理（上传、版本控制）
- ✅ 知识库管理（文档导入、切分、向量化、检索）
- ✅ 8阶段任务处理（PARSING → STRUCTURING → RULE_SCORING → KB_RETRIEVAL → LLM_RISK → EVIDENCING → QCING → DONE）
- ✅ 风险分析（LLM + 规则引擎）
- ✅ 证据链收集与QC校验
- ✅ 报告生成与下载

### 3. 简化但不失功能
- SQLite足够支撑百万级记录
- Faiss性能优于pgvector
- 文件系统适合单机部署
- 智谱API提供企业级LLM能力

## 项目结构

创建新目录 `/Users/robin/project/contract_os_simple/`：

```
contract_os_simple/
├── client/                          # 复制现有前端（完全不变）
│   └── (所有前端文件)
│
├── server/                          # Python后端（新增）
│   ├── main.py                      # FastAPI应用入口
│   ├── config.py                    # 配置管理
│   ├── requirements.txt             # Python依赖
│   │
│   ├── database/
│   │   ├── connection.py            # SQLite连接
│   │   └── models.py                # SQLAlchemy模型（18个表）
│   │
│   ├── services/
│   │   ├── llm_service.py           # 智谱AI统一客户端
│   │   ├── kb_service.py            # 知识库服务（Faiss）
│   │   ├── task_service.py          # 任务管理
│   │   ├── contract_service.py      # 合同管理
│   │   └── file_service.py          # 文件存储
│   │
│   ├── agents/
│   │   ├── base.py                  # Agent基类
│   │   ├── parse_agent.py           # 文件解析
│   │   ├── split_agent.py           # 条款切分
│   │   ├── rules_agent.py           # 规则匹配
│   │   ├── kb_retrieval_agent.py    # KB检索（Faiss）
│   │   ├── llm_risk_agent.py        # LLM风险分析
│   │   ├── evidence_agent.py        # 证据收集
│   │   ├── qc_agent.py              # QC
│   │   └── report_agent.py          # 报告生成
│   │
│   ├── orchestrator.py              # 任务编排器（替代BullMQ）
│   │
│   ├── routes/
│   │   ├── contracts.py
│   │   ├── tasks.py
│   │   ├── kb.py
│   │   ├── reports.py
│   │   ├── dashboard.py
│   │   └── health.py
│   │
│   ├── schemas/
│   │   └── pydantic_models.py       # Pydantic模型（确保API兼容）
│   │
│   ├── prompts/
│   │   └── risk_analysis.py         # LLM提示词
│   │
│   └── utils/
│       ├── file_parser.py           # PDF/DOCX解析
│       └── vector_store.py          # Faiss包装器
│
├── storage/                         # 本地文件存储
│   ├── contracts/
│   ├── kb_documents/
│   └── reports/
│
├── data/
│   ├── database.db                  # SQLite数据库
│   └── faiss_indexes/               # Faiss索引
│
├── .env.example
├── README.md
└── scripts/
    ├── init_db.py
    └── seed_kb.py
```

## 实施步骤

### Phase 1: 项目初始化（第1天）
1. 创建项目目录结构
2. 生成 `requirements.txt`:
   ```txt
   fastapi==0.109.0
   uvicorn[standard]==0.27.0
   sqlalchemy==2.0.25
   aiosqlite==0.19.0
   faiss-cpu==1.7.4
   zhipuai==2.1.5.20240731
   PyPDF2==3.0.1
   python-docx==1.1.0
   python-dotenv==1.0.0
   ```
3. 创建 `.env.example`:
   ```bash
   ZHIPU_API_KEY=your-key-here
   ZHIPU_CHAT_MODEL=glm-4-flash
   ZHIPU_EMBED_MODEL=embedding-3
   ZHIPU_RERANK_MODEL=rerank-2
   DATABASE_PATH=./data/database.db
   STORAGE_ROOT=./storage
   ```
4. 复制前端代码到 `client/` 目录

### Phase 2: 数据库层（第2-3天）
1. 在 `server/database/models.py` 中定义18个表（参考原项目的 `server/src/db/migrations/001_init.sql`）
2. 在 `server/database/connection.py` 中实现SQLite连接管理
3. 创建 `server/scripts/init_db.py` 初始化数据库

**关键**: 表结构必须与原PostgreSQL一致，确保数据可迁移。

### Phase 3: 核心服务（第4-6天）
1. **`llm_service.py`**: 智谱AI统一客户端
   ```python
   class LLMService:
       async def chat(messages, temperature) -> str
       async def embed(texts) -> List[List[float]]
       async def rerank(query, documents, top_n) -> List[Dict]
   ```

2. **`vector_store.py`**: Faiss包装器
   ```python
   class FaissVectorStore:
       add_vectors(vectors, chunk_ids)
       search(query_vector, top_k) -> List[(chunk_id, score)]
       save()  # 持久化到磁盘
   ```

3. **`kb_service.py`**: 知识库服务
   - 文档导入和切分
   - 调用智谱API向量化
   - 存储到Faiss索引

4. **`task_service.py`**: 任务管理
   - 创建任务
   - 更新状态和进度
   - 写入task_events

### Phase 4: Agent系统（第7-11天）
1. **`base.py`**: Agent基类
   ```python
   class BaseAgent:
       stage_name: str
       async def execute(task) -> Dict
       async def log_event(task_id, level, message)
   ```

2. 实现8个Agent（参考原项目的 `server/src/workers/agents/*.ts`）:
   - `parse_agent.py`: 文件解析（TXT/PDF/DOCX）
   - `split_agent.py`: 条款切分
   - `rules_agent.py`: 关键词/正则匹配
   - `kb_retrieval_agent.py`: Faiss检索 + 智谱Rerank
   - `llm_risk_agent.py`: LLM风险分析（关键）
   - `evidence_agent.py`: 证据链收集
   - `qc_agent.py`: QC校验
   - `report_agent.py`: 报告生成

**关键**: LLM输出必须解析JSON，失败时标记为NEEDS_REVIEW。

### Phase 5: 任务编排器（第12-13天）
在 `server/orchestrator.py` 中实现：
```python
class TaskOrchestrator:
    async def run_task(task_id):
        # 8阶段状态机
        for stage in [PARSING, STRUCTURING, RULE_SCORING, KB_RETRIEVAL, LLM_RISK, EVIDENCING, QCING, DONE]:
            agent = self.agents[stage]
            await agent.execute(task)
            await self.update_progress(task_id)

    async def cancel_task(task_id):
        # 设置取消标志
```

使用 `asyncio.create_task()` 在后台运行任务。

### Phase 6: API路由（第14-16天）
在 `server/routes/` 中实现6个路由模块（参考原项目的 `server/src/routes/*.ts`）:
- `contracts.py`: 合同CRUD
- `tasks.py`: 任务管理（POST创建任务时后台启动orchestrator）
- `kb.py`: 知识库管理
- `reports.py`: 报告生成和下载
- `dashboard.py`: 仪表盘统计
- `health.py`: 健康检查

**关键**: 使用Pydantic定义请求/响应模型，确保JSON结构与原Node.js版本一致。

### Phase 7: 前端集成（第17天）
1. 复制现有前端代码到 `client/`
2. 测试所有页面功能:
   - Dashboard（任务列表）
   - KBAdmin（知识库管理）
   - NewTaskUpload（创建任务）
   - Processing（查看进度）
   - Results（风险结果）
   - Review（审阅）
3. 修复任何API不兼容问题

### Phase 8: 测试（第18-20天）
1. 单元测试: `server/tests/`
   - `test_llm_service.py`
   - `test_kb_service.py`
   - `test_orchestrator.py`
2. 集成测试: 完整任务流程
3. 性能测试: 并发任务处理

### Phase 9: 文档和部署（第21天）
1. 编写 `README.md`:
   - 安装步骤
   - 配置说明
   - 运行指南
2. 创建示例数据脚本 `scripts/seed_kb.py`

## 关键实现细节

### 1. 智谱API调用
```python
from zhipuai import ZhipuAI

client = ZhipuAI(api_key=os.getenv("ZHIPU_API_KEY"))

# Chat
response = client.chat.completions.create(
    model="glm-4-flash",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.3
)

# Embedding
response = client.embeddings.create(
    model="embedding-3",
    input=["文本1", "文本2"]
)

# Rerank
response = client.model_api.invoke(
    model="rerank-2",
    data={"query": query, "documents": docs, "top_n": 6}
)
```

### 2. Faiss向量检索
```python
import faiss
import numpy as np

# 创建索引
index = faiss.IndexFlatIP(1024)  # 1024维向量
index.add(vectors)

# 搜索
scores, indices = index.search(query_vector, k=20)
```

### 3. 任务编排（asyncio替代BullMQ）
```python
async def create_task(req):
    task = await task_service.create_task(...)
    # 后台运行任务
    asyncio.create_task(orchestrator.run_task(task.id))
    return task
```

### 4. 确保API兼容性
```python
from pydantic import BaseModel

class TaskResponse(BaseModel):
    id: str
    status: str
    progress: int
    current_stage: str
    created_at: datetime

@router.get("/api/precheck-tasks/{task_id}")
async def get_task(task_id: str):
    task = await task_service.get_task(task_id)
    return TaskResponse(**task)  # 自动序列化为JSON
```

## 验收标准

### 功能测试
```bash
# 1. 启动后端
cd server
python main.py

# 2. 启动前端
cd client
npm run dev

# 3. 测试流程
# a) 访问 http://localhost:5173
# b) 创建知识库集合
# c) 上传KB文档（检查Faiss索引生成）
# d) 上传合同文件
# e) 创建预审任务（选择KB集合）
# f) 查看处理进度（8阶段）
# g) 查看风险结果（包含证据链和KB引用）
# h) 生成并下载报告
```

### 性能指标
- 单任务处理时间 < 5分钟
- 支持3个并发任务
- 知识库检索 < 2秒

### 代码质量
- 所有函数有类型注解
- 单元测试覆盖率 > 60%
- 完整的README

## 常见问题处理

### Q: SQLite并发写入限制
**A**: 使用WAL模式：
```python
conn = await aiosqlite.connect(db_path)
await conn.execute("PRAGMA journal_mode=WAL")
```

### Q: LLM输出非JSON格式
**A**: 重试一次，仍失败则标记NEEDS_REVIEW：
```python
try:
    risk_data = json.loads(response)
except JSONDecodeError:
    # 降级
    risk = Risk(risk_level="INFO", risk_type="NEEDS_REVIEW", ...)
```

### Q: 智谱API限流
**A**: 使用Semaphore控制并发：
```python
semaphore = asyncio.Semaphore(3)  # 最多3个并发请求

async def call_api():
    async with semaphore:
        return await llm_service.chat(...)
```

## 现有项目参考

在实现过程中，参考以下现有文件：
- `server/src/db/migrations/001_init.sql` - 数据库表结构
- `server/src/llm/modelGateway.ts` - LLM调用模式
- `server/src/workers/agents/*.ts` - Agent实现逻辑
- `server/src/routes/*.ts` - API端点定义
- `server/src/services/*.ts` - 业务逻辑

## 开始执行

现在开始执行重构，按照以下顺序：

1. **先创建项目骨架**（Phase 1）
2. **实现数据库层**（Phase 2）
3. **实现核心服务**（Phase 3）
4. **逐步实现Agent**（Phase 4）
5. **集成任务编排**（Phase 5）
6. **实现API路由**（Phase 6）
7. **前端集成测试**（Phase 7）

**重要**: 每完成一个Phase，都要进行测试验证，确保功能正确后再进入下一阶段。

遇到问题时:
1. 查看原项目的对应实现
2. 对比API响应格式
3. 确保前端调用不受影响

祝重构顺利！🚀

---

## 参考文档

完整的技术指南和架构说明请参考：
- [完整重构指南](./REFACTOR_PROMPT.md)
- [快速开始指南](./REFACTOR_SUMMARY.md)
- [系统对比分析](./REFACTOR_COMPARISON.md)
