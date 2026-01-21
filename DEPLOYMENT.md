# 合同预审系统 - 开发与部署指南

> **版本**: v0.3.1
> **更新时间**: 2025-01-22
> **环境**: 本地开发环境 / 生产部署

---

## 目录

- [1. 系统架构概览](#1-系统架构概览)
- [2. 开发环境搭建](#2-开发环境搭建)
- [3. 本地开发指南](#3-本地开发指南)
- [4. 生产环境部署](#4-生产环境部署)
- [5. 配置优化](#5-配置优化)
- [6. 监控与运维](#6-监控与运维)
- [7. 故障排查](#7-故障排查)
- [8] 常见问题](#8-常见问题)

---

## 1. 系统架构概览

### 1.1 技术栈

**前端**:
- React 18+ + TypeScript
- Vite 5+ (构建工具)
- TailwindCSS 3+ (UI 样式)
- React Router v6+ (路由)

**后端**:
- Node.js 18+
- Fastify 4+ (Web 框架)
- TypeScript 5+
- BullMQ 4+ (任务队列)
- Redis 7+ (队列存储)

**数据层**:
- PostgreSQL 16+ + pgvector (向量检索)
- MinIO (S3 兼容对象存储)

**AI/ML**:
- **选项 1**: 本地 vLLM (需要 GPU)
- **选项 2**: 智谱清言云 API (无需 GPU)

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                         用户界面                         │
│                    (React + Vite + Tailwind)              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST API
                       ↓
┌─────────────────────────────────────────────────────────┐
│                      API Gateway                         │
│                    (Fastify + Zod 验证)                   │
└──┬──────────────────────┬────────────────────────┬──────────┘
   │                      │                        │
   ↓                      ↓                        ↓
┌─────────────┐   ┌──────────┐   ┌──────────────────────┐
│  队列系统    │   │  多智能体 │   │    知识库服务        │
│  (BullMQ)    │   │  编排器   │   │ (PostgreSQL+pgvector)│
│             │   │          │   │                       │
│ ┌─────────┐ │   │ ┌──────┐ │   │  ┌──────────────┐  │
│ │Orchestrator│ │   │Agent1│ │   │  │ 向量检索     │  │
│ │  Queue  │ │   │Agent2│ │   │  │ (Embed+Rerank)│ │
│ └─────────┘ │   │ ...  │ │   │  └──────────────┘  │
│ ┌─────────┐ │   └──────┘ │   │  ┌──────────────┐  │
│ │ Workers │ │            │   │  │ 文档处理     │  │
│ └─────────┘ │            │   │  └──────────────┘  │
└─────────────┘            └───┴──────────────────────┘
                                │
                                ↓
                    ┌──────────────────────────┐
                    │     LLM 服务层          │
                    │  (vLLM OR 智谱清言)     │
                    └──────────────────────────┘
```

### 1.3 多智能体 Pipeline

```
QUEUED → PARSING → STRUCTURING → RULE_SCORING → KB_RETRIEVAL
     ↓
  LLM_RISK → EVIDENCING → QCING → DONE
```

**8 个阶段详解**:

1. **PARSING**: 文本提取 (TXT/PDF/DOCX)
2. **STRUCTURING**: 条款切分
3. **RULE_SCORING**: 关键词/规则匹配
4. **KB_RETRIEVAL**: 知识库向量检索 + 重排
5. **LLM_RISK**: LLM 风险分析 (JSON 输出)
6. **EVIDENCING**: 证据链整理
7. **QCING**: 质量检查 (幻觉检测)
8. **DONE**: 报告生成

---

## 2. 开发环境搭建

### 2.1 前置要求

#### 选项 A: 本地 vLLM 模式 (需要 GPU)
```bash
# 硬件要求
- CPU: 8 核心以上推荐
- GPU: NVIDIA RTX 4090 (24GB VRAM) 或同等
- 内存: 32GB+ 推荐
- 磁盘: 100GB+ SSD

# 软件要求
- OS: Linux (Ubuntu 22.04 推荐) / Windows 11+ / macOS 12+
- Node.js: >= 18.0.0
- Docker: >= 24.0.0
- Docker Compose: >= 2.20.0
- nvidia-container-toolkit (GPU 支持)
```

#### 选项 B: 智谱清言模式 (无需 GPU)
```bash
# 硬件要求
- CPU: 4 核心以上
- 内存: 16GB+
- 磁盘: 50GB+ SSD

# 软件要求
- OS: Linux / Windows / macOS
- Node.js: >= 18.0.0
- Docker: >= 24.0.0
- Docker Compose: >= 2.20.0
- 智谱清言 API Key
```

### 2.2 环境安装

#### 2.2.1 Node.js 安装

**使用 nvm (推荐)**:
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js 18 LTS
nvm install 18
nvm use 18

# 验证
node --version  # 应显示 v18.x.x
npm --version
```

#### 2.2.2 Docker 安装

**Ubuntu/Debian**:
```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y ca-certificates curl gnupg

# 添加 Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 设置 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 验证
sudo docker run hello-world
```

**macOS**:
```bash
# 使用 Homebrew
brew install --cask docker

# 启动 Docker
open /Applications/Docker.app
```

#### 2.2.3 NVIDIA Container Toolkit (仅 vLLM 模式需要)

**Ubuntu**:
```bash
# 添加 NVIDIA 包仓库
distribution=$(. /etc/os-release;echo $VERSION_CODENAME)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-container-toolkit.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 更新并安装
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# 重启 Docker
sudo systemctl restart docker

# 验证
docker run --rm --gpus all nvidia/cuda:11.8.3-base-ubuntu22.04 nvidia-smi
```

**验证 GPU**:
```bash
nvidia-smi
# 应显示 GPU 信息,包括显存使用情况
```

### 2.3 克隆项目

```bash
# 克隆仓库 (替换为实际仓库地址)
git clone https://github.com/your-org/contract-precheck.git
cd contract-precheck

# 检查分支
git branch
git checkout main
```

### 2.4 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env  # 或使用其他编辑器
```

> **提示**: 系统已自动集成 dotenv 加载，创建 `.env` 文件后无需手动 source，重启服务即可生效。

**关键配置项**:

```bash
# LLM Provider 选择
LLM_PROVIDER=local          # 本地 vLLM (需 GPU)
# LLM_PROVIDER=zhipu        # 智谱清言 (无需 GPU)

# 本地 vLLM 配置 (LLM_PROVIDER=local)
VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_EMBED_BASE_URL=http://localhost:8001/v1
VLLM_RERANK_BASE_URL=http://localhost:8002/v1

# 智谱清言配置 (LLM_PROVIDER=zhipu)
ZHIPU_API_KEY=your-api-key-here
ZHIPU_CHAT_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_EMBED_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_RERANK_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_precheck

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=contract-precheck
```

### 2.5 启动基础设施服务

#### 本地 vLLM 模式:
```bash
# 启动所有服务 (包括 vLLM)
npm run docker:up

# 等待服务就绪
npm run wait

# 验证服务状态
docker compose ps
```

#### 智谱清言模式:
```bash
# 启动服务 (不含 vLLM)
npm run docker:up:zhipu

# 验证服务状态
docker compose -f docker-compose.zhipu.yml ps
```

### 2.6 数据库初始化

```bash
# 执行数据库迁移
npm run db:migrate

# (可选) 导入演示数据
npm run seed
```

### 2.7 安装依赖

```bash
# 安装所有依赖
npm install

# 验证安装
npm run build
```

### 2.8 启动开发服务器

```bash
# 启动前后端开发服务器
npm run dev

# 或分别启动
npm run dev:server  # 仅后端
npm run dev:client   # 仅前端
```

### 2.9 验证安装

访问以下地址验证服务是否正常运行:

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3000/api
- **健康检查**: http://localhost:3000/api/health
- **MinIO 控制台**: http://localhost:9001

```bash
# 测试 API
curl http://localhost:3000/api/health

# 应返回类似:
# {
#   "status": "ok",
#   "services": {
#     "database": true,
#     "redis": true,
#     "minio": true,
#     "vllm": true  // zhipu 模式为 false
#   }
# }
```

---

## 3. 本地开发指南

### 3.1 项目结构

```
contract-precheck/
├── client/                    # 前端 (React + Vite)
│   ├── src/
│   │   ├── api/             # API 客户端
│   │   ├── components/      # UI 组件
│   │   │   └── ui/          # 原子组件
│   │   ├── pages/           # 页面组件
│   │   └── styles/          # 全局样式
│   ├── package.json
│   └── vite.config.ts
├── server/                   # 后端 (Node.js + Fastify)
│   ├── src/
│   │   ├── agents/          # Agent 逻辑
│   │   ├── config/          # 配置管理
│   │   ├── db/              # 数据库 (Migrations)
│   │   ├── llm/             # LLM 集成
│   │   ├── queues/          # BullMQ 队列
│   │   ├── routes/          # API 路由
│   │   ├── schemas/         # Zod 校验
│   │   ├── services/        # 业务逻辑
│   │   ├── utils/           # 工具函数
│   │   ├── workers/         # 队列 Workers
│   │   └── tests/           # 测试套件
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml       # Docker 编排 (本地 vLLM)
├── docker-compose.zhipu.yml # Docker 编排 (智谱清言)
├── package.json             # Monorepo 根配置
├── .env.example             # 环境变量模板
└── README.md               # 项目文档
```

### 3.2 开发工作流

#### 3.2.1 修改代码

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装新依赖 (如果有)
npm install

# 3. 启动开发服务器
npm run dev
```

#### 3.2.2 添加新功能

1. **前端页面**:
   - 在 `client/src/pages/` 创建新组件
   - 在 `client/src/routes.tsx` 注册路由
   - 在 `client/src/api/` 添加 API 调用

2. **后端 API**:
   - 在 `server/src/schemas/` 定义 Zod schema
   - 在 `server/src/routes/` 创建路由处理器
   - 在 `server/src/services/` 实现业务逻辑

3. **数据库**:
   - 在 `server/src/db/migrations/` 创建 SQL migration
   - 运行 `npm run db:migrate`

4. **测试**:
   - 在 `server/src/tests/` 添加测试
   - 运行 `npm test` 验证

### 3.3 代码规范

#### 3.3.1 TypeScript 规范

```typescript
// ✅ 好的实践
interface User {
  id: string;
  name: string;
  email: string;
}

// ❌ 避免
interface User {
  Id: string;  // 不一致的命名
  nameString: string;  // 冗余的类型后缀
}

// ✅ 类型断言
const result = await response.json() as User;

// ❌ 避免使用 any
const data: any = response.json();
```

#### 3.3.2 命名约定

```typescript
// 文件命名
- 组件: PascalCase (e.g., TaskList.tsx)
- 工具函数: camelCase (e.g., formatDateString.ts)
- 常量: UPPER_SNAKE_CASE (e.g., API_BASE_URL)
- 类型: PascalCase (e.g., TaskStatus)

// 变量命名
const userCount = 10;
const isActive = true;
const maxRetry = 3;

// 私有方法前缀
private _validateInput(): void {}
```

#### 3.3.3 注释规范

```typescript
/**
 * 计算风险等级分值
 * @param confidence - 0-1 之间的置信度
 * @returns 风险等级 (HIGH/MEDIUM/LOW/INFO)
 */
function calculateRiskLevel(confidence: number): RiskLevel {
  // ...
}

// TODO: 未来优化点
// FIXME: 已知问题
// NOTE: 重要说明
```

### 3.4 调试技巧

#### 3.4.1 后端调试

```bash
# 查看日志
docker compose logs -f vllm-chat    # vLLM 日志
docker compose logs -f server        # 后端日志

# 进入容器调试
docker exec -it contract-precheck-server bash
docker exec -it contract-precheck-db psql contract_precheck
```

#### 3.4.2 数据库查询

```bash
# 连接数据库
psql postgres://postgres:postgres@localhost:5432/contract_precheck

# 常用查询
SELECT * FROM precheck_tasks ORDER BY created_at DESC LIMIT 10;
SELECT * FROM task_events WHERE task_id = 'xxx' ORDER BY ts;
SELECT * FROM risks WHERE task_id = 'xxx' ORDER BY confidence DESC;
SELECT * FROM kb_chunks WHERE id = 'xxx';
```

#### 3.4.3 Redis 调试

```bash
# 连接 Redis
redis-cli

# 查看队列状态
keys "bull:*"
llen precheck.orchestrator:waiting
lrange precheck.orchestrator:active 0 10

# 清空队列 (谨慎使用!)
del precheck.orchestrator:waiting
```

### 3.5 热重加载

```bash
# 重启后端服务
npm run dev:server

# 重启前端服务
npm run dev:client

# 重启 Docker 服务
docker compose restart

# 重启特定容器
docker compose restart vllm-chat
```

---

## 4. 生产环境部署

### 4.1 生产环境要求

#### 4.1.1 硬件配置

**小型部署** (1-5 用户并发):
- CPU: 8 核
- 内存: 32GB
- 磁盘: 500GB SSD
- GPU: RTX 4090 (24GB) OR 智谱清言 API

**中型部署** (5-20 用户并发):
- CPU: 16 核
- 内存: 64GB
- 磁盘: 1TB SSD
- GPU: RTX 4090 (24GB) OR 智谱清言 API + 速率限制

**大型部署** (20+ 用户并发):
- CPU: 32 核+
- 内存: 128GB+
- 磁盘: 2TB+ NVMe SSD
- GPU: 多卡 OR 智谱清言企业版

#### 4.1.2 软件配置

```bash
# 生产环境版本
Node.js: 20.x LTS
PostgreSQL: 16.x
Redis: 7.x
Docker: 24.x+
```

### 4.2 部署架构

#### 4.2.1 单机部署

```
┌─────────────────────────────────────┐
│          Nginx (反向代理)           │
│    (端口 80/443)                    │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│     应用服务器 (Node.js)            │
│                                     │
│  ┌──────────┐  ┌──────────────┐   │
│  │  前端进程 │  │  后端 API 进程 │   │
│  │  (Vite)   │  │   (Fastify)    │   │
│  └──────────┘  └──────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │      PostgreSQL             │   │
│  │      Redis                  │   │
│  │      MinIO                  │   │
│  │      vLLM (可选)           │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 4.2.2 分布式部署

```
┌──────────────┐         ┌──────────────┐
│   负载均衡    │         │   负载均衡    │
│   (Nginx)     │         │   (Nginx)     │
└──────┬────────┘         └──────┬────────┘
       │                        │
       ↓                        ↓
┌───────────────────┐   ┌───────────────────┐
│   应用服务器 1      │   │   应用服务器 2      │
│   (Node.js)        │   │   (Node.js)        │
│                    │   │                    │
│  ┌────────────────┐ │   │  ┌────────────────┐ │
│  │ PostgreSQL     │ │   │  │ PostgreSQL     │ │
│  │ (主从复制)     │ │   │  │ (主从复制)     │ │
│  └────────────────┘ │   │  └────────────────┘ │
│  ┌────────────────┐ │   │  ┌────────────────┐ │
│  │ Redis Sentinel │ │   │  │ Redis Sentinel │ │
│  │  (主从)        │ │   │  │  (主从)        │ │
│  └────────────────┘ │   │  └────────────────┘ │
│  ┌────────────────┐ │   │  ┌────────────────┐ │
│  │ MinIO          │ │   │  │ MinIO          │ │
│  └────────────────┘ │   │  └────────────────┘ │
└─────────────────────┘   └─────────────────────┘
```

### 4.3 部署步骤

#### 4.3.1 准备部署环境

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
apt-get install -y nodejs

# 3. 安装 Docker
# 见 2.2.2 节

# 4. 安装 nginx
sudo apt install -y nginx

# 5. 安装 PM2 (进程管理器)
npm install -g pm2
```

#### 4.3.2 部署数据库

```bash
# 1. 安装 PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ pgp main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO - https://www.postgresql.org/media/keys/ACCX4U4FnP7pMD5vmExUXUxACFQCw ==O- | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-16-pgvector

# 2. 启用 pgvector
sudo -u postgres psql
CREATE EXTENSION IF NOT EXISTS vector;
\q

# 3. 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE DATABASE contract_precheck;
CREATE USER contract_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE contract_precheck TO contract_user;
\q
```

#### 4.3.3 部署 Redis

```bash
# 1. 安装 Redis
sudo apt install -y redis-server

# 2. 配置 Redis
sudo nano /etc/redis/redis.conf
# 设置:
# maxmemory 2gb
# maxmemory-policy allkeys-lru
# bind 0.0.0.0

# 3. 启动 Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### 4.3.4 部署应用

```bash
# 1. 创建应用目录
sudo mkdir -p /opt/contract-precheck
cd /opt/contract-precheck

# 2. 克隆代码
git clone https://github.com/your-org/contract-precheck.git
cd contract-precheck

# 3. 安装依赖
npm install
npm run build

# 4. 配置环境变量
cp .env.example .env
nano .env  # 修改生产环境配置

# 5. 使用 PM2 启动后端
pm2 start server/dist/server.js --name contract-api --env production

# 6. 配置 nginx
sudo nano /etc/nginx/sites-available/contract-precheck
```

**Nginx 配置示例**:
```nginx
upstream contract_api {
    server localhost:3000;
}

upstream contract_frontend {
    server localhost:5173;
}

server {
    listen 80;
    server_name your-domain.com;

    # API 代理
    location /api/ {
        proxy_pass http://contract_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 前端代理
    location / {
        proxy_pass http://contract_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4.3.5 配置 SSL (HTTPS)

```bash
# 1. 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 获取证书
sudo certbot --nginx -d your-domain.com

# 3. 自动续期
sudo certbot renew --dry-run
```

### 4.4 使用 Docker 部署

#### 4.4.1 Docker Compose 生产配置

创建 `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: contract-precheck-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: contract_precheck
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    networks:
      - contract_network

  redis:
    image: redis:7-alpine
    container_name: contract-precheck-redis
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: always
    networks:
      - contract_network

  minio:
    image: minio/minio:latest
    container_name: contract-precheck-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: always
    networks:
      - contract_network

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: contract-precheck-server
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - MINIO_ENDPOINT=${MINIO_ENDPOINT}
      - MINIO_PORT=${MINIO_PORT}
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - MINIO_BUCKET=${MINIO_BUCKET}
      - LLM_PROVIDER=${LLM_PROVIDER}
      - ZHIPU_API_KEY=${ZHIPU_API_KEY}
      # ... 其他环境变量
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      - minio
    restart: always
    networks:
      - contract_network

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  contract_network:
    driver: bridge
```

#### 4.4.2 部署命令

```bash
# 1. 构建镜像
docker compose -f docker-compose.prod.yml build

# 2. 启动服务
docker compose -f docker-compose.prod.yml up -d

# 3. 查看状态
docker compose -f docker-compose.prod.yml ps

# 4. 查看日志
docker compose -f docker-compose.prod.yml logs -f server
```

### 4.5 配置反向代理 (Nginx)

见 4.3.4 节 Nginx 配置

### 4.6 配置防火墙

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 4.7 配置监控

```bash
# 1. 安装监控工具
npm install -g pm2

# 2. 使用 PM2 启动应用
pm2 start ecosystem.config.cjs

# 3. 安装监控面板
pm2 install pm2-logrotate
pm2-plus install
```

**ecosystem.config.cjs** 示例:
```javascript
module.exports = {
  apps: [{
    name: 'contract-api',
    script: './server/dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    memory: '2G',
    max_memory_restart: '1G'
  }]
};
```

---

## 5. 配置优化

### 5.1 数据库优化

#### 5.1.1 PostgreSQL 调优

```sql
-- postgresql.conf

-- 连接配置
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 2GB
checkpoint_completion_target = 0.9

-- 查询优化
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = '32MB'

-- WAL 配置
wal_buffers = 1GB
min_wal_size = 2GB
max_wal_size = 8GB
checkpoint_completion_target = 0.9
```

#### 5.1.2 索引优化

```sql
-- 创建常用索引
CREATE INDEX idx_tasks_status ON precheck_tasks(status);
CREATE INDEX idx_tasks_created ON precheck_tasks(created_at DESC);
CREATE INDEX idx_risks_task_level ON risks(task_id, risk_level);
CREATE INDEX idx_kb_chunks_document ON kb_chunks(document_id);
CREATE INDEX idx_kb_embeddings_vector ON kb_embeddings USING ivfflat (embedding vector_cosine_ops);
```

### 5.2 Redis 优化

```conf
# redis.conf

# 内存配置
maxmemory 4gb
maxmemory-policy allkeys-lru

# 持久化配置
save 900 1
save 300 10
save 60 10000

# 复制配置 (如使用主从)
replica-serve-stale-data yes
replica-read-only yes
```

### 5.3 应用层优化

#### 5.3.1 并发配置

根据硬件配置调整 `.env`:

```bash
# RTX 4090 (24GB)
ORCHESTRATOR_CONCURRENCY=1
LLM_RISK_CONCURRENCY=3    # 可根据显存调整
EVIDENCE_CONCURRENCY=3
KB_INDEX_CONCURRENCY=2

# 云 API (智谱清言)
ORCHESTRATOR_CONCURRENCY=1
LLM_RISK_CONCURRENCY=2    # API 限速考虑
EVIDENCE_CONCURRENCY=2
KB_INDEX_CONCURRENCY=1
```

#### 5.3.2 缓存配置

```typescript
// server/src/config/cache.ts (示例)
import NodeCache from 'node-cache';

export const cache = new NodeCache({
  stdTTL: 60,      // 默认 60 秒
  checkperiod: 120,  // 每 2 分钟检查过期缓存
  useClones: false
});
```

### 5.4 LLM 配置优化

#### 5.4.1 本地 vLLM 调优

**Chat 模型** (Qwen2.5-7B):
```yaml
gpu-memory-utilization: 0.95  # 提高到 0.95
max-model-len: 12288            # 提高到 12K
max-num-seqs: 16               # 提高并发
max-num-batched-tokens: 12288
```

**Embed/Rerank 模型**:
```yaml
gpu-memory-utilization: 0.70
max-num-seqs: 64
```

#### 5.4.2 智谱清言 API 调优

```typescript
// 配置重试策略
const retryConfig = {
  maxAttempts: 3,          // 增加重试次数
  initialDelay: 1000,     # 1 秒
  maxDelay: 5000,          # 最大 5 秒
  backoffMultiplier: 2
};
```

### 5.5 日志配置

#### 5.5.1 生产环境日志

```typescript
// server/src/config/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  },
  // 写入文件
  ...(process.env.NODE_ENV === 'production' && {
    file: './logs/app.log',
    errorFile: './logs/error.log'
  })
});
```

#### 5.5.2 日志轮转

```bash
# 使用 logrotate
sudo nano /etc/logrotate.d/contract-precheck

/path/to/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
}
```

---

## 6. 监控与运维

### 6.1 健康检查

#### 6.1.1 应用健康检查

```typescript
// server/src/routes/health.ts (已实现)
GET /api/health

// 返回服务状态
{
  status: "ok",
  services: {
    database: boolean,
    redis: boolean,
    minio: boolean,
    vllm: boolean  // 或 zhipu
  }
}
```

#### 6.1.2 系统监控

```bash
# CPU 监控
top -bn 1

# 内存监控
free -h

# 磁盘监控
df -h

# GPU 监控 (vLLM 模式)
nvidia-smi -l 1

# Docker 容器监控
docker stats
```

### 6.2 日志监控

#### 6.2.1 集中式日志 (可选)

```bash
# 使用 Loki + Promtail
docker compose -f docker-compose.monitoring.yml up -d
```

#### 6.2.2 日志查询

```bash
# 查看应用日志
pm2 logs contract-api --lines 100

# 查看错误日志
pm2 logs contract-api --err

# 查看 Docker 日志
docker compose logs --tail 100 server
```

### 6.3 性能监控

#### 6.3.1 应用性能指标

```typescript
// 在关键位置添加性能监控
import { logger } from '../config/logger.js';

const startTime = Date.now();
// ... 业务逻辑 ...
const duration = Date.now() - startTime;
logger.info({ duration, operation: 'task_creation' }, 'Performance metric');
```

#### 6.3.2 LLM Token 监控

```typescript
// 监控 token 使用
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 在 ModelGateway 中记录
const usage = data.usage as TokenUsage;
logger.info({
  model: modelConfig.chat.model,
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  totalTokens: usage.totalTokens
}, 'LLM token usage');
```

### 6.4 告警配置

#### 6.4.1 任务失败告警

```typescript
// server/src/services/alerting.ts (示例)
async function alertTaskFailure(taskId: string, error: Error) {
  // 发送邮件
  await sendEmail({
    to: 'admin@example.com',
    subject: `Task ${taskId} Failed`,
    body: error.message
  });

  // 或发送钉钉/企业微信
  await sendDingTalkAlert(`Task ${taskId} failed: ${error.message}`);
}
```

#### 6.4.2 系统资源告警

```bash
# 使用 Prometheus + Grafana
docker compose -f docker-compose.monitoring.yml up -d

# 配置告警规则 (Alertmanager)
# - CPU > 80%
# - 内存 > 90%
# - 磁盘 > 85%
# - API 响应时间 > 5s
# - 任务失败率 > 5%
```

---

## 7. 故障排查

### 7.1 常见问题

#### 7.1.1 vLLM 启动失败

**症状**:
```bash
Error response from daemon: unknown or invalid runtime name: nvidia
```

**解决方案**:
```bash
# 1. 检查 NVIDIA 驱动
nvidia-smi

# 2. 检查 nvidia-container-toolkit
sudo dpkg -l | grep nvidia-container-toolkit

# 3. 重新安装 nvidia-container-toolkit
sudo apt-get install -y nvidia-container-toolkit

# 4. 重启 Docker
sudo systemctl restart docker

# 5. 或使用智谱清言模式 (无需 GPU)
LLM_PROVIDER=zhipu
```

#### 7.1.2 数据库连接失败

**症状**:
```
Error: connect ECONNREFUSED
```

**解决方案**:
```bash
# 1. 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 2. 检查端口监听
sudo netstat -tlnp | grep 5432

# 3. 检查防火墙
sudo ufw status

# 4. 测试连接
psql -U postgres -h localhost -p 5432 -d contract_precheck
```

#### 7.1.3 Redis 连接失败

**解决方案**:
```bash
# 1. 检查 Redis 状态
sudo systemctl status redis

# 2. 测试连接
redis-cli ping

# 3. 检查配置
redis-cli config get bind
redis-cli config get port
```

#### 7.1.4 LLM API 超时

**症状**:
```
Error: Chat API timeout
```

**解决方案**:
```bash
# 本地 vLLM: 检查模型是否完全加载
docker logs vllm-chat

# 智谱清言: 检查 API key 和额度
curl https://open.bigmodel.cn/api/paas/v4/models \
  -H "Authorization: Bearer $ZHIPU_API_KEY"
```

### 7.2 性能问题

#### 7.2.1 处理速度慢

**诊断**:
```bash
# 1. 检查当前处理阶段
SELECT current_stage, progress FROM precheck_tasks WHERE id = 'xxx';

# 2. 查看 worker 日志
docker logs contract-precheck-server

# 3. 检查队列积压
redis-cli -n keys "bull:*" | xargs redis-cli llen
```

**优化**:
- 增加 `LLM_RISK_CONCURRENCY`
- 优化数据库索引
- 增加 KB 检索的 `TOP_K` 减少
- 使用智谱清言替代本地 vLLM

#### 7.2.2 内存占用高

**诊断**:
```bash
# 1. 检查 Node.js 内存
pm2 logs contract-api --lines 50

# 2. 检查容器内存
docker stats

# 3. 内存泄漏分析
npm install -g heapdump
heapdump -heapsnapshot -o snapshot.heapsnapshot
```

**解决方案**:
- 限制并发数
- 增加 Node.js 内存限制
- 优化数据库连接池
- 重启服务定期

#### 7.2.3 GPU 内存不足 (OOM)

**症状**:
```
CUDA out of memory
```

**解决方案**:
```bash
# 1. 降低 gpu-memory-utilization
# 在 docker-compose.yml 中调整:
--gpu-memory-utilization=0.80

# 2. 减少 max-model-len
--max-model-len=6144

# 3. 减少 max-num-seqs
--max-num-seqs=4

# 4. 或使用智谱清言 (无需 GPU)
```

### 7.3 数据问题

#### 7.3.1 KB 检索无结果

**诊断**:
```sql
-- 1. 检查 embedding 数量
SELECT COUNT(*) FROM kb_embeddings;

-- 2. 检查 chunk 数量
SELECT COUNT(*) FROM kb_chunks;

-- 3. 检查 pgvector 扩展
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**解决方案**:
```bash
# 1. 重新索引 KB 文档
npm run db:migrate

# 2. 检查 indexing worker 日志
docker logs contract-precheck-server | grep -i index

# 3. 手动触发索引
curl -X POST http://localhost:3000/api/kb/reindex
```

#### 7.3.2 幻觉检测误报

**症状**:
```
所有风险都标记 hallucination_suspect=true
```

**解决方案**:
```sql
-- 1. 检查快照版本
SELECT * FROM task_kb_snapshots WHERE task_id = 'xxx';

-- 2. 检查 chunk 版本
SELECT kc.id, kc.document_id, d.version
FROM kb_chunks kc
JOIN kb_documents d ON kc.document_id = d.id
WHERE kc.id = 'xxx';

-- 3. 验证版本匹配
-- 如果不匹配,说明版本控制有问题
```

---

## 8. 常见问题

### 8.1 开发环境

**Q: npm install 失败?**
```bash
# 清理缓存
rm -rf node_modules package-lock.json
npm cache clean --force

# 重新安装
npm install
```

**Q: 端口被占用?**
```bash
# 查找占用端口的进程
lsof -i :3000
kill -9 <PID>

# 或修改端口
export SERVER_PORT=3001
```

**Q: Docker 权限问题?**
```bash
# 将用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录
newgrp docker
```

### 8.2 部署环境

**Q: 如何更新应用?**
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装新依赖
npm install

# 3. 重新构建
npm run build

# 4. 重启服务
pm2 restart contract-api

# 或 Docker
docker compose -f docker-compose.prod.yml up -d --build
```

**Q: 如何回滚版本?**
```bash
# 1. 查看提交历史
git log --oneline -10

# 2. 回滚到指定版本
git reset --hard <commit-hash>

# 3. 重新部署
npm run build
pm2 restart contract-api
```

**Q: 如何备份数据?**
```bash
# 数据库备份
pg_dump -U postgres -d contract_precheck > backup_$(date +%Y%m%d).sql

# MinIO 数据备份
docker cp contract-precheck-minio:/data /backup/minio_$(date +%Y%m%d).tar

# Redis 数据备份
redis-cli --rdb /backup/redis_$(date +%Y%m%d).rdb
```

### 8.3 性能问题

**Q: 如何优化响应时间?**
```bash
# 1. 数据库索引优化
npm run db:migrate

# 2. 增加 Redis 缓存
# 在代码中使用 cache middleware

# 3. 增加并发数
# 调整 LLM_RISK_CONCURRENCY 环境变量

# 4. 使用 CDN
# 静态资源部署到 CDN
```

**Q: 如何扩展系统?**
```bash
# 1. 部署多台服务器
# 见 4.2.2 分布式部署

# 2. 使用负载均衡
# Nginx 配置 upstream

# 3. 数据库主从复制
# PostgreSQL streaming replication

# 4. Redis 哨兵模式
# Redis Sentinel
```

### 8.4 安全问题

**Q: 如何保护生产环境?**
```bash
# 1. 更新默认密码
# 修改 .env 中的 MINIO_SECRET_KEY

# 2. 配置防火墙
sudo ufw enable
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443

# 3. 使用 HTTPS
# 申请 SSL 证书 (Let's Encrypt)

# 4. 限制 API 访问
# 在 Nginx 中配置 IP 白名单

# 5. 启用审计日志
auditLog = on; # PostgreSQL
```

---

## 附录

### A. 环境变量清单

见 [.env.example](/.env.example)

### B. 端口清单

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | Vite 开发服务器 |
| 后端 API | 3000 | Fastify API |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 队列 |
| MinIO | 9000, 9001 | 对象存储 |
| vLLM Chat | 8000 | 本地模型 (可选) |
| vLLM Embed | 8001 | 本地模型 (可选) |
| vLLM Rerank | 8002 | 本地模型 (可选) |

### C. 快速参考命令

```bash
# 开发
npm run dev                 # 启动开发服务器
npm run build               # 构建生产版本
npm test                   # 运行测试
npm run lint                 # 代码检查

# 基础设施
npm run docker:up            # 启动 Docker (vLLM)
npm run docker:up:zhipu    # 启动 Docker (智谱)
npm run docker:down          # 停止 Docker

# 数据库
npm run db:migrate          # 执行迁移

# 监控
pm2 logs contract-api        # 查看后端日志
docker stats                  # 查看 Docker 状态
```

### D. 联系支持

- **文档**: [README.md](README.md)
- **开发进度**: [TODO.md](TODO.md)
- **开发指南**: [CLAUDE.md](CLAUDE.md)

---

**文档版本**: v1.0
**最后更新**: 2025-01-22
**维护者**: 开发团队
