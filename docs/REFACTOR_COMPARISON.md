# 系统重构对比表

## 技术栈对比

| 层级 | 原系统 (Node.js) | 新系统 (Python) | 变化原因 |
|------|-----------------|----------------|---------|
| **前端** | React + Vite + TailwindCSS | React + Vite + TailwindCSS | ✅ 保持不变 |
| **后端框架** | Node.js + Fastify | Python + FastAPI | 更简洁的异步模型 |
| **数据库** | PostgreSQL + pgvector | SQLite + Faiss | 去除服务器依赖 |
| **消息队列** | BullMQ + Redis | asyncio.Queue | 单机够用，简化架构 |
| **对象存储** | MinIO (S3-compatible) | 本地文件系统 | 小规模无需分布式存储 |
| **LLM推理** | vLLM (本地3个容器) | 智谱AI API | 无需GPU，按需付费 |
| **向量化** | BGE-M3 (本地) | 智谱Embedding-3 API | 统一API调用 |
| **重排序** | BGE-Reranker-v2 (本地) | 智谱Rerank-2 API | 统一API调用 |
| **并发模型** | Worker进程池 | asyncio协程 | 更轻量级 |

## 依赖服务对比

### 原系统 - 需要6个Docker容器

```yaml
services:
  - postgres:        数据库
  - redis:          消息队列
  - minio:          对象存储
  - vllm-chat:      对话模型 (7GB VRAM)
  - vllm-embed:     向量化模型 (2GB VRAM)
  - vllm-rerank:    重排序模型 (2GB VRAM)

总GPU需求: 11GB+ VRAM (需RTX 4090)
总内存需求: 32GB+ RAM
部署时间: 10-15分钟 (首次下载模型)
```

### 新系统 - 零依赖容器

```bash
requirements:
  - Python 3.11+    # 运行时
  - 智谱API密钥     # 云API调用

总GPU需求: 0 (可选)
总内存需求: 4GB RAM
启动时间: < 10秒
```

## 部署复杂度对比

### 原系统部署步骤

```bash
# 1. 安装Docker和nvidia-container-toolkit
sudo apt install docker.io docker-compose nvidia-container-toolkit

# 2. 克隆代码
git clone repo
cd repo

# 3. 启动6个容器
docker compose up -d

# 4. 等待vLLM模型下载（首次约10分钟）
docker compose logs -f vllm-chat

# 5. 初始化数据库
npm run db:migrate

# 6. 启动后端（Node.js）
cd server && npm run dev

# 7. 启动前端（React）
cd client && npm run dev

# 8. 访问系统
open http://localhost:5173

总耗时: 15-30分钟（首次）
```

### 新系统部署步骤

```bash
# 1. 安装Python 3.11+
sudo apt install python3.11 python3.11-venv

# 2. 克隆代码
git clone repo
cd repo

# 3. 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 4. 安装依赖
pip install -r server/requirements.txt

# 5. 配置环境变量
cp .env.example .env
# 编辑.env，填入智谱API密钥

# 6. 初始化数据库
python server/scripts/init_db.py

# 7. 启动后端（Python）
python server/main.py &

# 8. 启动前端（React）
cd client && npm run dev

# 9. 访问系统
open http://localhost:5173

总耗时: 2-3分钟（首次）
```

## 代码量对比

### 原系统 (Node.js + TypeScript)

```
server/
├── config/           500行   (环境、数据库、Redis、MinIO、vLLM配置)
├── database/         800行   (SQL定义、迁移脚本、连接管理)
├── queues/           1200行  (BullMQ队列定义、Worker工厂)
├── workers/          2000行  (Orchestrator + 8个Agent Worker)
├── services/         1500行  (业务逻辑 + 检索服务)
├── routes/           800行   (API端点)
└── utils/            500行   (工具函数)

总代码量: ~7300行
```

### 新系统 (Python)

```
server/
├── database/         400行   (SQLAlchemy模型，SQLite简化)
├── services/         800行   (业务逻辑，智谱API统一)
├── agents/           1000行  (8个Agent，异步函数简化)
├── orchestrator.py   300行   (asyncio状态机，替代BullMQ)
├── routes/           600行   (FastAPI路由，更简洁)
└── utils/            300行   (Faiss包装器等)

总代码量: ~3400行
代码减少: 53% ⬇️
```

## 成本对比

### 原系统 (自建本地vLLM)

| 项目 | 成本 | 说明 |
|------|------|------|
| **GPU服务器** | ¥5000-15000/月 | 需要RTX 4090云服务器 |
| **带宽** | ¥200-500/月 | 模型下载和API调用 |
| **运维** | ¥1000-3000/月 | Docker维护、监控、备份 |
| **电费** | ¥200-500/月 | RTX 4090功耗300W+ |
| **合计** | **¥6400-19000/月** | 仅适合企业用户 |

### 新系统 (智谱API)

| 项目 | 成本 | 说明 |
|------|------|------|
| **普通服务器** | ¥100-500/月 | 4核8G即可，无需GPU |
| **智谱API** | ¥50-200/月 | 按token计费（小规模） |
| **运维** | ¥0/月 | 单机应用，维护简单 |
| **合计** | **¥150-700/月** | 个人/中小企业均可承受 |

### 成本详细计算（智谱API）

假设每月处理1000份合同，平均每份合同5000字：

```python
# Token消耗估算
contract_tokens = 5000 * 1.5  # 中文约1.5字符/token
kb_retrieval_tokens = 2000 * 6  # 检索6个KB片段
risk_analysis_tokens = 3000  # LLM分析输出

total_tokens_per_contract = contract_tokens + kb_retrieval_tokens + risk_analysis_tokens
# ≈ 9500 tokens/合同

# API费用（智谱定价）
chat_cost = 9500 * 0.0001  # GLM-4-Flash: ¥0.1/1M tokens
embed_cost = 5000 * 0.00002  # Embedding-3: ¥0.02/1M tokens
rerank_cost = 6 * 0.0001  # Rerank-2: 按次计费

total_cost_per_contract = chat_cost + embed_cost + rerank_cost
# ≈ ¥0.001/合同

# 月度成本
monthly_cost = 1000 * 0.001
# ≈ ¥1/月（基础API费用）
# 加上服务器租用：¥100-500/月
# 总计：¥100-500/月
```

## 性能对比

### 原系统 (本地vLLM)

| 指标 | 数值 | 说明 |
|------|------|------|
| **LLM推理延迟** | 2-5秒/请求 | RTX 4090本地推理 |
| **向量化速度** | 1000 docs/s | 批处理优化 |
| **检索延迟** | 100-200ms | pgvector内存索引 |
| **并发任务** | 3-5个 | GPU内存限制 |
| **GPU利用率** | 80-95% | 3个模型共享GPU |

### 新系统 (智谱API)

| 指标 | 数值 | 说明 |
|------|------|------|
| **LLM推理延迟** | 1-3秒/请求 | 云端API，网络延迟 |
| **向量化速度** | 无限制 | API调用 |
| **检索延迟** | 200-500ms | Faiss本地 + API重排 |
| **并发任务** | 10-50个 | 仅受API限流 |
| **GPU利用率** | 0% | 无需GPU |

**结论**: 新系统在延迟上略慢(网络传输),但并发能力更强。

## 可扩展性对比

### 原系统 (分布式)

```
优点:
✅ 真正的分布式架构
✅ 可水平扩展（增加Worker）
✅ 适合企业级大规模部署

缺点:
❌ 运维复杂度高
❌ 需要专业团队维护
❌ 成本高昂
```

### 新系统 (单机)

```
优点:
✅ 部署简单，开箱即用
✅ 成本低廉
✅ 适合中小规模

缺点:
❌ 单点故障风险
❌ 并发能力有限（API限流）
❌ 不适合大规模部署
```

## 适用场景

### 原系统适合:
- ✅ 大型企业法务部门（月审查量>10000份）
- ✅ 对数据隐私要求极高（不能上云）
- ✅ 有专业运维团队
- ✅ 预算充足（>¥10K/月）

### 新系统适合:
- ✅ 中小企业法务部门（月审查量<1000份）
- ✅ 初创公司MVP开发
- ✅ 个人学习/研究项目
- ✅ 预算有限（<¥500/月）
- ✅ 快速原型验证

## 迁移难度

### 从原系统迁移到新系统

```
1. 前端: 无需修改（API端点100%兼容）
2. 数据库: PostgreSQL → SQLite（迁移脚本）
3. 文件: MinIO → 本地文件（直接复制）
4. 向量: pgvector → Faiss（重建索引）
5. 配置: 环境变量简化（仅智谱API密钥）

预计迁移时间: 1-2天
```

### 从新系统迁移到原系统

```
1. 前端: 无需修改
2. 数据库: SQLite → PostgreSQL（标准SQL）
3. 文件: 本地文件 → MinIO（上传脚本）
4. 向量: Faiss → pgvector（导出向量）
5. 配置: 添加Docker服务

预计迁移时间: 2-3天
```

## 总结

| 维度 | 原系统 | 新系统 | 推荐 |
|------|--------|--------|------|
| **部署复杂度** | ⭐⭐⭐⭐⭐ | ⭐ | 新系统 ✅ |
| **成本** | ⭐ | ⭐⭐⭐⭐⭐ | 新系统 ✅ |
| **开发效率** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 新系统 ✅ |
| **性能** | ⭐⭐⭐⭐ | ⭐⭐⭐ | 原系统 ✅ |
| **可扩展性** | ⭐⭐⭐⭐⭐ | ⭐⭐ | 原系统 ✅ |
| **数据隐私** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 原系统 ✅ |
| **维护成本** | ⭐⭐ | ⭐⭐⭐⭐⭐ | 新系统 ✅ |

### 最终建议

**选择新系统（Python + 智谱API）如果:**
- 预算有限（<¥500/月）
- 团队规模小（<5人）
- 月审查量<1000份
- 需要快速上线（<1个月）
- 无GPU服务器

**选择原系统（Node.js + vLLM）如果:**
- 预算充足（>¥10K/月）
- 有专业运维团队
- 月审查量>10000份
- 对数据隐私要求极高
- 已有GPU基础设施

---

**相关文档**:
- [完整重构指南](./REFACTOR_PROMPT.md)
- [快速开始指南](./REFACTOR_SUMMARY.md)
