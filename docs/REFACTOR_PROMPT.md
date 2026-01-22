# 合同预审系统重构超级提示词 - Python简化版

## 项目概述

你是一名资深的全栈工程师，需要将现有的复杂合同预审系统重构为一个**简化但功能完整**的Python后端版本。前端保持不变（React + Vite + TailwindCSS），后端从Node.js迁移到Python，并大幅简化基础设施。

## 重构目标

### 核心变更
1. **前端完全不变** - 保持现有的React前端代码、UI组件、页面逻辑
2. **后端语言** - Node.js → Python (FastAPI)
3. **数据库** - PostgreSQL + pgvector → **SQLite** (单文件数据库)
4. **向量存储** - pgvector → **Faiss** (本地向量索引)
5. **对象存储** - MinIO → **本地文件系统** (按日期分目录)
6. **LLM提供商** - 本地vLLM → **智谱AI** (https://open.bigmodel.cn/)
7. **消息队列** - BullMQ + Redis → **Python asyncio队列** (内存队列)
8. **并发模型** - Worker进程 → **异步任务处理** (asyncio.create_task)

### 保留核心功能
- ✅ 完整的合同预审流程（8阶段处理）
- ✅ 知识库管理（文档导入、向量化、检索）
- ✅ 多智能体协作（简化为异步函数）
- ✅ 风险分析（LLM + 规则引擎）
- ✅ 证据链收集与QC校验
- ✅ 报告生成（HTML/JSON）
- ✅ 所有现有API端点

---

## 技术栈对比

### 原系统（Node.js）
```
Frontend: React + Vite + TailwindCSS
Backend:  Node.js + Fastify + TypeScript
Database: PostgreSQL + pgvector
Queue:    BullMQ + Redis
Storage:  MinIO (S3-compatible)
LLM:      vLLM (local) OR Zhipu API
Embed:    BGE-M3 (local)
Rerank:   BGE-Reranker-v2 (local)
```

### 新系统（Python）
```
Frontend: React + Vite + TailwindCSS (不变)
Backend:  Python 3.11+ + FastAPI
Database: SQLite + Faiss (向量索引)
Queue:    asyncio.Queue (内存)
Storage:  本地文件系统
LLM:      智谱AI GLM-4-Flash (云API)
Embed:    智谱AI Embedding-3 API
Rerank:   智谱AI Rerank-2 API
```

---

## 项目结构

```
contract-precheck-simple/
├── client/                          # 前端（完全复用现有代码）
│   ├── src/
│   │   ├── pages/                   # Dashboard, KBAdmin, NewTaskUpload, etc.
│   │   ├── components/
│   │   ├── api/                     # API客户端（无需修改，保持现有端点）
│   │   └── ...
│   ├── package.json
│   └── ...
├── server/                          # Python后端
│   ├── main.py                      # FastAPI应用入口
│   ├── config.py                    # 配置管理（环境变量）
│   ├── requirements.txt             # Python依赖
│   ├── database/
│   │   ├── __init__.py
│   │   ├── connection.py            # SQLite连接管理
│   │   ├── models.py                # SQLAlchemy模型
│   │   └── migrations.py            # 数据库初始化脚本
│   ├── services/
│   │   ├── __init__.py
│   │   ├── contract_service.py      # 合同管理服务
│   │   ├── task_service.py          # 任务生命周期管理
│   │   ├── kb_service.py            # 知识库服务（Faiss）
│   │   ├── llm_service.py           # 智谱AI统一客户端
│   │   ├── file_service.py          # 文件存储服务
│   │   └── report_service.py        # 报告生成服务
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py                  # Agent基类
│   │   ├── parse_agent.py           # 文件解析
│   │   ├── split_agent.py           # 条款切分
│   │   ├── rules_agent.py           # 规则匹配
│   │   ├── kb_retrieval_agent.py    # 知识库检索（Faiss）
│   │   ├── llm_risk_agent.py        # LLM风险分析
│   │   ├── evidence_agent.py        # 证据收集
│   │   ├── qc_agent.py              # 质量控制
│   │   └── report_agent.py          # 报告生成
│   ├── orchestrator.py              # 任务编排器（替代BullMQ Orchestrator）
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── contracts.py             # 合同CRUD端点
│   │   ├── tasks.py                 # 任务管理端点
│   │   ├── kb.py                    # 知识库端点
│   │   ├── reports.py               # 报告端点
│   │   ├── dashboard.py             # 仪表盘端点
│   │   └── health.py                # 健康检查端点
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── pydantic_models.py       # Pydantic数据模型
│   ├── prompts/
│   │   ├── __init__.py
│   │   └── risk_analysis.py         # LLM提示词模板
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── file_parser.py           # PDF/DOCX/TXT解析
│   │   ├── text_splitter.py         # 文本切分工具
│   │   └── vector_store.py          # Faiss包装器
│   └── tests/
│       ├── test_orchestrator.py
│       ├── test_kb_service.py
│       └── test_qc_agent.py
├── storage/                         # 本地文件存储（替代MinIO）
│   ├── contracts/                   # 原始合同文件
│   ├── kb_documents/                # 知识库文档
│   ├── reports/                     # 生成的报告
│   └── cache/                       # 临时缓存
├── data/                            # 数据文件
│   ├── database.db                  # SQLite数据库
│   └── faiss_indexes/               # Faiss向量索引
├── .env.example
├── README.md
├── docker-compose.yml               # 简化版（可选，仅开发环境）
└── scripts/
    ├── init_db.py                   # 初始化数据库
    └── seed_kb.py                   # 导入示例知识库
```

---

## 数据库设计（SQLite）

### 表结构（对应原PostgreSQL表）

```sql
-- 核心表
CREATE TABLE contracts (
    id TEXT PRIMARY KEY,
    contract_name TEXT NOT NULL,
    counterparty TEXT,
    contract_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contract_versions (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE precheck_tasks (
    id TEXT PRIMARY KEY,
    contract_version_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',  -- QUEUED, PARSING, STRUCTURING, RULE_SCORING, KB_RETRIEVAL, LLM_RISK, EVIDENCING, QCING, DONE, FAILED
    progress INTEGER DEFAULT 0,
    current_stage TEXT,
    kb_mode TEXT DEFAULT 'STRICT',          -- STRICT, RELAXED
    cancel_requested BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_version_id) REFERENCES contract_versions(id)
);

CREATE TABLE task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stage TEXT,
    level TEXT,                             -- INFO, WARNING, ERROR
    message TEXT,
    metadata TEXT,                          -- JSON
    FOREIGN KEY (task_id) REFERENCES precheck_tasks(id)
);

-- 条款与风险
CREATE TABLE clauses (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    clause_id TEXT NOT NULL,
    title TEXT,
    text TEXT NOT NULL,
    page_ref TEXT,
    order_no INTEGER,
    FOREIGN KEY (task_id) REFERENCES precheck_tasks(id)
);

CREATE TABLE risks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    clause_id TEXT NOT NULL,
    risk_level TEXT NOT NULL,               -- HIGH, MEDIUM, LOW, INFO
    risk_type TEXT,
    confidence REAL,
    summary TEXT,
    status TEXT DEFAULT 'PENDING',          -- PENDING, CONFIRMED, DISMISSED
    qc_flags TEXT,                          -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES precheck_tasks(id),
    FOREIGN KEY (clause_id) REFERENCES clauses(id)
);

CREATE TABLE rule_hits (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL,
    rule_id TEXT,
    rule_name TEXT,
    matched_text TEXT,
    metadata TEXT,                          -- JSON
    FOREIGN KEY (risk_id) REFERENCES risks(id)
);

CREATE TABLE evidences (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL,
    source_type TEXT NOT NULL,              -- CONTRACT, KB
    quote_text TEXT,
    chunk_id TEXT,
    file_path TEXT,
    metadata TEXT,                          -- JSON
    FOREIGN KEY (risk_id) REFERENCES risks(id)
);

-- 知识库（简化：使用Faiss + 文件系统）
CREATE TABLE kb_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT DEFAULT 'GLOBAL',            -- GLOBAL, TENANT, PROJECT, DEPT
    version INTEGER DEFAULT 1,
    is_enabled BOOLEAN DEFAULT TRUE,
    faiss_index_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kb_documents (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    doc_type TEXT,
    file_path TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    file_hash TEXT,
    status TEXT DEFAULT 'pending',          -- pending, indexing, ready, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES kb_collections(id)
);

CREATE TABLE kb_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_no INTEGER NOT NULL,
    text TEXT NOT NULL,
    metadata TEXT,                          -- JSON
    FOREIGN KEY (document_id) REFERENCES kb_documents(id)
);

-- 注意：kb_embeddings表不需要，使用Faiss存储向量
-- 但需要chunk_id到向量ID的映射

CREATE TABLE kb_citations (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    score REAL,
    quote_text TEXT,
    doc_version INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (risk_id) REFERENCES risks(id),
    FOREIGN KEY (chunk_id) REFERENCES kb_chunks(id)
);

-- 审阅与报告
CREATE TABLE suggestions (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL,
    suggestion_text TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (risk_id) REFERENCES risks(id)
);

CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    conclusion TEXT,                        -- APPROVE, MODIFY, ESCALATE
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES precheck_tasks(id)
);

CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    format TEXT DEFAULT 'html',             -- html, json
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES precheck_tasks(id)
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT,
    action TEXT,
    object_type TEXT,
    object_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT                           -- JSON
);

-- 配置快照（简化版）
CREATE TABLE config_snapshots (
    id TEXT PRIMARY KEY,
    llm_model TEXT NOT NULL,
    embed_model TEXT NOT NULL,
    rerank_model TEXT NOT NULL,
    prompt_template_version TEXT,
    metadata TEXT,                          -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_kb_snapshots (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    collection_version INTEGER NOT NULL,
    frozen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES precheck_tasks(id),
    FOREIGN KEY (collection_id) REFERENCES kb_collections(id)
);
```

---

## 核心实现指南

### 1. FastAPI应用架构（main.py）

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import contracts, tasks, kb, reports, dashboard, health
from database.connection import init_db

app = FastAPI(title="Contract Pre-check System", version="1.0.0")

# CORS配置（允许前端跨域）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 启动时初始化数据库
@app.on_event("startup")
async def startup():
    init_db()

# 注册路由
app.include_router(contracts.router, prefix="/api/contracts", tags=["contracts"])
app.include_router(tasks.router, prefix="/api/precheck-tasks", tags=["tasks"])
app.include_router(kb.router, prefix="/api/kb", tags=["kb"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(health.router, prefix="/api/health", tags=["health"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
```

### 2. 智谱AI统一客户端（llm_service.py）

```python
import os
from zhipuai import ZhipuAI
from typing import List, Dict, Any

class LLMService:
    def __init__(self):
        self.client = ZhipuAI(api_key=os.getenv("ZHIPU_API_KEY"))
        self.chat_model = os.getenv("ZHIPU_CHAT_MODEL", "glm-4-flash")
        self.embed_model = os.getenv("ZHIPU_EMBED_MODEL", "embedding-3")
        self.rerank_model = os.getenv("ZHIPU_RERANK_MODEL", "rerank-2")

    async def chat(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """调用智谱AI对话接口"""
        response = self.client.chat.completions.create(
            model=self.chat_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """调用智谱AI向量化接口"""
        response = self.client.embeddings.create(
            model=self.embed_model,
            input=texts
        )
        return [item.embedding for item in response.data]

    async def rerank(self, query: str, documents: List[str], top_n: int = 6) -> List[Dict]:
        """调用智谱AI重排序接口"""
        response = self.client.model_api.invoke(
            model=self.rerank_model,
            data={"query": query, "documents": documents, "top_n": top_n}
        )
        return response.get("results", [])
```

### 3. Faiss向量存储（utils/vector_store.py）

```python
import faiss
import numpy as np
import pickle
from typing import List, Tuple, Dict
from pathlib import Path

class FaissVectorStore:
    def __init__(self, index_path: str, dimension: int = 1024):
        self.index_path = Path(index_path)
        self.dimension = dimension
        self.index = None
        self.id_map = {}  # chunk_id -> faiss_index_id
        self.load_or_create()

    def load_or_create(self):
        """加载或创建索引"""
        if self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            with open(self.index_path.with_suffix('.pkl'), 'rb') as f:
                self.id_map = pickle.load(f)
        else:
            self.index = faiss.IndexFlatIP(self.dimension)  # 内积相似度
            self.id_map = {}

    def add_vectors(self, vectors: np.ndarray, chunk_ids: List[str]):
        """添加向量到索引"""
        start_idx = self.index.ntotal
        self.index.add(vectors)
        for i, chunk_id in enumerate(chunk_ids):
            self.id_map[chunk_id] = start_idx + i
        self.save()

    def search(self, query_vector: np.ndarray, top_k: int = 20) -> List[Tuple[str, float]]:
        """搜索最相似的向量"""
        scores, indices = self.index.search(query_vector, top_k)
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:  # faiss返回-1表示无效索引
                continue
            # 反查chunk_id
            chunk_id = next((k for k, v in self.id_map.items() if v == idx), None)
            if chunk_id:
                results.append((chunk_id, float(score)))
        return results

    def save(self):
        """保存索引到磁盘"""
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_path))
        with open(self.index_path.with_suffix('.pkl'), 'wb') as f:
            pickle.dump(self.id_map, f)
```

### 4. 任务编排器（orchestrator.py）

```python
import asyncio
from enum import Enum
from typing import Optional
from agents import (
    ParseAgent, SplitAgent, RulesAgent,
    KBRetrievalAgent, LLMRiskAgent, EvidenceAgent, QCAgent, ReportAgent
)
from services.task_service import TaskService
from database.models import PrecheckTask

class Stage(Enum):
    QUEUED = "QUEUED"
    PARSING = "PARSING"
    STRUCTURING = "STRUCTURING"
    RULE_SCORING = "RULE_SCORING"
    KB_RETRIEVAL = "KB_RETRIEVAL"
    LLM_RISK = "LLM_RISK"
    EVIDENCING = "EVIDENCING"
    QCING = "QCING"
    DONE = "DONE"
    FAILED = "FAILED"

class TaskOrchestrator:
    def __init__(self):
        self.task_service = TaskService()
        self.agents = {
            Stage.PARSING: ParseAgent(),
            Stage.STRUCTURING: SplitAgent(),
            Stage.RULE_SCORING: RulesAgent(),
            Stage.KB_RETRIEVAL: KBRetrievalAgent(),
            Stage.LLM_RISK: LLMRiskAgent(),
            Stage.EVIDENCING: EvidenceAgent(),
            Stage.QCING: QCAgent(),
            Stage.DONE: ReportAgent(),
        }
        self.running_tasks = {}  # task_id -> cancel_event

    async def run_task(self, task_id: str):
        """运行任务的状态机"""
        cancel_event = asyncio.Event()
        self.running_tasks[task_id] = cancel_event

        try:
            task = await self.task_service.get_task(task_id)
            current_stage = Stage.QUEUED

            stages = [
                Stage.PARSING,
                Stage.STRUCTURING,
                Stage.RULE_SCORING,
                Stage.KB_RETRIEVAL,
                Stage.LLM_RISK,
                Stage.EVIDENCING,
                Stage.QCING,
                Stage.DONE,
            ]

            for stage in stages:
                # 检查是否取消
                if cancel_event.is_set():
                    await self.task_service.update_task_status(
                        task_id, Stage.FAILED, "Task cancelled"
                    )
                    return

                # 执行阶段
                await self.task_service.update_task_status(task_id, stage)
                await self.task_service.add_event(
                    task_id, stage.value, "INFO", f"Starting {stage.value}"
                )

                try:
                    agent = self.agents[stage]
                    await agent.execute(task)

                    # 更新进度
                    progress = stages.index(stage) / len(stages) * 100
                    await self.task_service.update_progress(task_id, progress)

                except Exception as e:
                    await self.task_service.add_event(
                        task_id, stage.value, "ERROR", str(e)
                    )
                    # 重试一次（部分Agent）
                    if stage in [Stage.LLM_RISK, Stage.KB_RETRIEVAL]:
                        await agent.execute(task)

            await self.task_service.update_task_status(task_id, Stage.DONE)
            await self.task_service.add_event(
                task_id, "DONE", "INFO", "Task completed successfully"
            )

        except Exception as e:
            await self.task_service.update_task_status(
                task_id, Stage.FAILED, str(e)
            )
        finally:
            self.running_tasks.pop(task_id, None)

    async def cancel_task(self, task_id: str):
        """取消任务"""
        if task_id in self.running_tasks:
            self.running_tasks[task_id].set()
            await self.task_service.mark_cancel_requested(task_id)
```

### 5. Agent基类实现（agents/base.py）

```python
from abc import ABC, abstractmethod
from typing import Dict, Any
from database.models import PrecheckTask

class BaseAgent(ABC):
    def __init__(self):
        self.stage_name = "UNKNOWN"

    @abstractmethod
    async def execute(self, task: PrecheckTask) -> Dict[str, Any]:
        """执行Agent逻辑，返回结果字典"""
        pass

    async def log_event(self, task_id: str, level: str, message: str, metadata: Dict = None):
        """记录任务事件"""
        from services.task_service import TaskService
        task_service = TaskService()
        await task_service.add_event(task_id, self.stage_name, level, message, metadata)
```

### 6. LLM风险分析Agent示例（agents/llm_risk_agent.py）

```python
from typing import Dict, Any, List
from .base import BaseAgent
from services.llm_service import LLMService
from prompts.risk_analysis import RISK_ANALYSIS_PROMPT
from database.models import PrecheckTask, Risk, Clause

class LLMRiskAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.stage_name = "LLM_RISK"
        self.llm = LLMService()

    async def execute(self, task: PrecheckTask) -> Dict[str, Any]:
        """使用智谱AI分析条款风险"""
        # 获取任务的所有条款
        from database.connection import get_db
        async with get_db() as db:
            clauses = await db.execute(
                "SELECT * FROM clauses WHERE task_id = ?", (task.id,)
            )
            clauses = [Clause(**row) for row in clauses]

        risks = []
        for clause in clauses:
            # 构造prompt
            prompt = RISK_ANALYSIS_PROMPT.format(
                clause_text=clause.text,
                rule_hints="",  # 从rule_hits获取
                kb_context="",  # 从kb_hits_temp获取
            )

            messages = [{"role": "user", "content": prompt}]
            response = await self.llm.chat(messages, temperature=0.3)

            # 解析JSON响应（需要处理LLM可能返回非JSON的情况）
            import json
            try:
                risk_data = json.loads(response)
                risk = Risk(
                    id=str(uuid.uuid4()),
                    task_id=task.id,
                    clause_id=clause.id,
                    risk_level=risk_data["risk_level"],
                    risk_type=risk_data["risk_type"],
                    confidence=risk_data["confidence"],
                    summary=risk_data["summary"],
                )
                risks.append(risk)
            except json.JSONDecodeError:
                # 降级为NEEDS_REVIEW
                risk = Risk(
                    id=str(uuid.uuid4()),
                    task_id=task.id,
                    clause_id=clause.id,
                    risk_level="INFO",
                    risk_type="NEEDS_REVIEW",
                    confidence=0.0,
                    summary="LLM输出格式错误，需要人工审核",
                )
                risks.append(risk)

        # 批量插入risks表
        async with get_db() as db:
            for risk in risks:
                await db.execute(
                    """INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (risk.id, risk.task_id, risk.clause_id, risk.risk_level,
                     risk.risk_type, risk.confidence, risk.summary)
                )

        return {"risks_count": len(risks)}
```

### 7. 知识库检索Agent（agents/kb_retrieval_agent.py）

```python
from typing import Dict, Any, List
from .base import BaseAgent
from services.llm_service import LLMService
from utils.vector_store import FaissVectorStore
from database.models import PrecheckTask, Clause

class KBRetrievalAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.stage_name = "KB_RETRIEVAL"
        self.llm = LLMService()

    async def execute(self, task: PrecheckTask) -> Dict[str, Any]:
        """使用Faiss + 智谱Rerank检索知识库"""
        # 获取任务的知识库快照
        from database.connection import get_db
        async with get_db() as db:
            snapshots = await db.execute(
                """SELECT collection_id, collection_version FROM task_kb_snapshots
                WHERE task_id = ?""",
                (task.id,)
            )

        # 加载对应版本的Faiss索引
        all_results = []
        for collection_id, version in snapshots:
            index_path = f"data/faiss_indexes/{collection_id}_v{version}.faiss"
            store = FaissVectorStore(index_path)

            # 获取条款
            clauses = await db.execute(
                "SELECT * FROM clauses WHERE task_id = ?", (task.id,)
            )

            for clause in clauses:
                # 向量化查询
                query_vector = await self.llm.embed([clause.text])
                query_vector_np = np.array(query_vector[0]).reshape(1, -1)

                # Faiss搜索Top-K=20
                faiss_results = store.search(query_vector_np, top_k=20)

                # 获取文档文本
                chunk_ids = [r[0] for r in faiss_results]
                chunks = await db.execute(
                    f"SELECT * FROM kb_chunks WHERE id IN ({','.join(['?']*len(chunk_ids))})",
                    chunk_ids
                )
                documents = [chunk["text"] for chunk in chunks]

                # 智谱Rerank重排序Top-N=6
                rerank_results = await self.llm.rerank(clause.text, documents, top_n=6)

                # 保存到kb_hits_temp（简化：直接写入kb_citations）
                for result in rerank_results:
                    await db.execute(
                        """INSERT INTO kb_citations (id, risk_id, chunk_id, score, quote_text)
                        VALUES (?, ?, ?, ?, ?)""",
                        (str(uuid.uuid4()), None, result["chunk_id"],
                         result["score"], result["text"])
                    )

        return {"kb_hits_count": len(all_results)}
```

---

## API端点实现（保持与原前端兼容）

### contracts.py
```python
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from services.contract_service import ContractService

router = APIRouter()
contract_service = ContractService()

class CreateContractRequest(BaseModel):
    contract_name: str
    counterparty: str = None
    contract_type: str = None

@router.post("/")
async def create_contract(req: CreateContractRequest):
    """创建合同"""
    contract = await contract_service.create_contract(
        contract_name=req.contract_name,
        counterparty=req.counterparty,
        contract_type=req.contract_type
    )
    return contract

@router.post("/{contract_id}/versions")
async def upload_contract_version(contract_id: str, file: UploadFile = File(...)):
    """上传合同文件"""
    version = await contract_service.upload_version(
        contract_id=contract_id,
        file=file.file,
        filename=file.filename,
        mime_type=file.content_type
    )
    return version
```

### tasks.py
```python
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from orchestrator import TaskOrchestrator
from services.task_service import TaskService

router = APIRouter()
task_service = TaskService()
orchestrator = TaskOrchestrator()

class CreateTaskRequest(BaseModel):
    contract_version_id: str
    kb_collection_ids: List[str] = []
    kb_mode: str = "STRICT"

@router.post("/")
async def create_task(req: CreateTaskRequest, background_tasks: BackgroundTasks):
    """创建预审任务"""
    task = await task_service.create_task(
        contract_version_id=req.contract_version_id,
        kb_collection_ids=req.kb_collection_ids,
        kb_mode=req.kb_mode
    )

    # 后台启动任务编排
    background_tasks.add_task(orchestrator.run_task, task.id)

    return task

@router.get("/{task_id}")
async def get_task(task_id: str):
    """获取任务状态"""
    task = await task_service.get_task(task_id)
    return task

@router.get("/{task_id}/events")
async def get_task_events(task_id: str):
    """获取任务事件Timeline"""
    events = await task_service.get_events(task_id)
    return {"events": events}

@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    """取消任务"""
    await orchestrator.cancel_task(task_id)
    return {"message": "Task cancelled"}
```

---

## 环境变量配置（.env.example）

```bash
# Python Backend
PYTHON_ENV=development
API_HOST=0.0.0.0
API_PORT=3000

# 智谱AI配置
ZHIPU_API_KEY=your-zhipu-api-key-here
ZHIPU_CHAT_MODEL=glm-4-flash
ZHIPU_EMBED_MODEL=embedding-3
ZHIPU_RERANK_MODEL=rerank-2

# 文件存储路径
STORAGE_ROOT=./storage
DATABASE_PATH=./data/database.db
FAISS_INDEX_PATH=./data/faiss_indexes

# 日志配置
LOG_LEVEL=INFO
LOG_FILE=./logs/app.log
```

---

## Python依赖（requirements.txt）

```
# FastAPI
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
python-multipart==0.0.6

# 数据库
sqlalchemy==2.0.25
aiosqlite==0.19.0

# 向量搜索
faiss-cpu==1.7.4  # 如有GPU可换faiss-gpu

# 智谱AI SDK
zhipuai==2.1.5.20240731

# 文件处理
PyPDF2==3.0.1
python-docx==1.1.0

# 工具库
python-dotenv==1.0.0
pydantic-settings==2.1.0
httpx==0.26.0
aiofiles==23.2.1

# 测试
pytest==7.4.4
pytest-asyncio==0.23.3
httpx==0.26.0
```

---

## 实施步骤（Claude Code执行指南）

### Phase 1: 项目初始化
1. 创建项目目录结构（参考上方结构）
2. 生成 `requirements.txt` 和 `.env.example`
3. 初始化SQLite数据库（运行 `python scripts/init_db.py`）
4. 创建FastAPI应用骨架（`main.py`）

### Phase 2: 数据库层
1. 定义SQLAlchemy模型（`database/models.py`）
2. 实现数据库连接管理（`database/connection.py`）
3. 编写迁移脚本（`database/migrations.py`）
4. 编写单元测试验证数据库操作

### Phase 3: 核心服务
1. 实现智谱AI客户端（`services/llm_service.py`）
2. 实现Faiss包装器（`utils/vector_store.py`）
3. 实现文件存储服务（`services/file_service.py`）
4. 实现任务服务（`services/task_service.py`）
5. 实现知识库服务（`services/kb_service.py`）

### Phase 4: Agent系统
1. 实现Agent基类（`agents/base.py`）
2. 实现文件解析Agent（`agents/parse_agent.py`）
3. 实现条款切分Agent（`agents/split_agent.py`）
4. 实现规则匹配Agent（`agents/rules_agent.py`）
5. 实现知识库检索Agent（`agents/kb_retrieval_agent.py`）
6. 实现LLM风险分析Agent（`agents/llm_risk_agent.py`）
7. 实现证据收集Agent（`agents/evidence_agent.py`）
8. 实现QC Agent（`agents/qc_agent.py`）
9. 实现报告生成Agent（`agents/report_agent.py`）

### Phase 5: 任务编排
1. 实现任务编排器（`orchestrator.py`）
2. 集成所有Agent到状态机
3. 实现任务取消机制
4. 编写端到端测试（`tests/test_orchestrator.py`）

### Phase 6: API路由
1. 实现合同管理端点（`routes/contracts.py`）
2. 实现任务管理端点（`routes/tasks.py`）
3. 实现知识库端点（`routes/kb.py`）
4. 实现报告端点（`routes/reports.py`）
5. 实现仪表盘端点（`routes/dashboard.py`）
6. 实现健康检查端点（`routes/health.py`）

### Phase 7: 前端集成
1. 复制现有前端代码到 `client/` 目录
2. 验证前端API调用兼容性
3. 测试完整用户流程（KB上传 -> 任务创建 -> 查看结果）
4. 修复任何API不兼容问题

### Phase 8: 测试与优化
1. 编写单元测试（所有Service和Agent）
2. 编写集成测试（完整任务流程）
3. 性能测试（并发任务处理）
4. 错误处理完善
5. 日志记录优化

### Phase 9: 文档与部署
1. 编写README（安装、配置、运行指南）
2. 编写API文档（使用FastAPI自动生成）
3. 创建示例数据（`scripts/seed_kb.py`）
4. 编写Dockerfile（可选，用于容器化部署）

---

## 关键注意事项

### 1. 与前端的兼容性
- **所有API端点路径必须保持一致**：`/api/contracts`, `/api/precheck-tasks`, `/api/kb` 等
- **响应格式必须匹配**：使用Pydantic模型确保JSON结构一致
- **错误处理必须统一**：返回 `{ "error": "message", "code": 500 }` 格式

### 2. 简化但不失功能
- **SQLite替代PostgreSQL**：足够支撑PoC和小规模生产使用
- **Faiss替代pgvector**：性能更好，无需额外服务
- **文件系统替代MinIO**：简化部署，适合单机场景
- **asyncio替代BullMQ**：去掉Redis依赖，降低复杂度

### 3. 智谱AI使用限制
- **API限流**：注意并发请求控制（使用asyncio.Semaphore限制并发数）
- **Token计费**：合理设置max_tokens避免浪费
- **重试机制**：实现指数退避重试（处理网络波动）

### 4. Faiss索引管理
- **版本隔离**：每个知识库版本使用独立的Faiss索引文件
- **索引持久化**：每次添加向量后保存到磁盘
- **索引重建**：提供重建索引的工具函数（处理文档更新）

### 5. 错误降级策略
- **LLM输出解析失败**：标记为NEEDS_REVIEW，不阻塞流程
- **知识库检索失败**：kb_mode=RELAXED时继续执行，STRICT时任务失败
- **文件解析失败**：返回错误，不创建任务

---

## 验收标准

### 功能完整性
- ✅ 用户可以创建知识库并导入文档
- ✅ 用户可以上传合同并创建预审任务
- ✅ 任务可以完成完整的8阶段处理流程
- ✅ 风险结果可以正确显示（包含证据链和KB引用）
- ✅ 报告可以生成并下载
- ✅ 所有前端页面功能正常（Dashboard, KBAdmin, NewTaskUpload, Processing, Results, Review）

### 性能指标
- ✅ 单个任务处理时间 < 5分钟（取决于合同长度和LLM响应速度）
- ✅ 支持至少3个并发任务
- ✅ 知识库检索响应时间 < 2秒

### 代码质量
- ✅ 所有函数有类型注解
- ✅ 关键逻辑有单元测试（测试覆盖率 > 60%）
- ✅ 有完整的README和API文档
- ✅ 错误处理完善（不因异常导致进程崩溃）

---

## 常见问题与解决方案

### Q1: SQLite并发写入限制
**问题**: SQLite不支持高并发写入
**解决**:
- 使用WAL模式（`PRAGMA journal_mode=WAL`）
- 使用连接池（SQLAlchemy默认支持）
- 异步写入排队

### Q2: Faiss索引与数据库同步
**问题**: 删除文档时Faiss索引未更新
**解决**:
- 实现索引重建机制
- 定期清理孤儿向量
- 使用软删除标记文档

### Q3: 智谱AI响应格式不稳定
**问题**: LLM有时返回非JSON格式
**解决**:
- Prompt中强化JSON输出要求
- 实现修复Prompt（重试一次）
- 解析失败时降级为NEEDS_REVIEW

### Q4: 前端API调用不兼容
**问题**: Python后端返回格式与Node.js不一致
**解决**:
- 使用Pydantic严格定义响应格式
- 对比原Node.js代码的响应结构
- 前端添加格式转换层（仅在必要时）

---

## 总结

这个重构方案将复杂的分布式系统（Node.js + PostgreSQL + Redis + MinIO + vLLM）简化为**单机Python应用**（FastAPI + SQLite + Faiss + 智谱API），同时**完全保留前端代码和用户体验**。

核心优势:
1. **部署简单** - 无需Docker，无需GPU，直接运行Python脚本
2. **成本低廉** - 使用智谱API按需付费，无需维护本地模型
3. **开发快速** - Python生态丰富，代码量减少50%+
4. **易于维护** - 单一代码库，依赖少，调试方便

适合场景:
- 中小企业合同审查
- 快速原型开发
- 个人项目或学习使用
- 不需要高并发和分布式部署

---

## 开始实施

现在你已经有了完整的实施指南，请按照以下步骤开始重构：

1. **创建新目录** `contract-precheck-simple/`
2. **复制前端代码** `cp -r client/ contract-precheck-simple/`
3. **生成Python项目骨架**（使用上面的目录结构）
4. **从Phase 1开始逐步实施**

记住：**前端代码完全不动，确保API端点和响应格式100%兼容**！

祝重构顺利！🚀
