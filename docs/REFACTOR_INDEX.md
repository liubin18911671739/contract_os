# 合同预审系统Python重构方案 - 文档索引

本目录包含了将现有Node.js后端重构为Python后端的完整方案文档。

## 📚 文档列表

### 1. [CLAUDE_CODE_PROMPT.md](./CLAUDE_CODE_PROMPT.md) ⭐ **从这里开始**
**用途**: 直接复制给Claude Code执行的超级提示词
**内容**:
- 角色定义和任务概述
- 详细的技术栈变更说明
- 完整的9阶段实施步骤
- 关键代码示例和实现细节
- 验收标准和测试方法

**适合**: 想要立即开始重构时使用

---

### 2. [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md) 📋 **快速概览**
**用途**: 快速了解重构方案的核心内容
**内容**:
- 架构对比表（原系统 vs 新系统）
- 核心优势（部署、成本、开发效率）
- 项目结构图
- 9个实施阶段概览
- 验收标准
- 常见问题FAQ
- 快速开始指南

**适合**: 需要快速评估方案可行性时阅读

---

### 3. [REFACTOR_COMPARISON.md](./REFACTOR_COMPARISON.md) 📊 **详细对比**
**用途**: 深入了解两个系统的差异
**内容**:
- 技术栈逐层对比
- 依赖服务对比（6个Docker容器 vs 0容器）
- 部署复杂度对比（15-30分钟 vs 2-3分钟）
- 代码量对比（7300行 vs 3400行）
- 成本详细计算（¥6400-19000/月 vs ¥150-700/月）
- 性能对比分析
- 适用场景分析
- 迁移难度评估

**适合**: 需要说服团队/老板采用新方案时使用

---

### 4. [REFACTOR_PROMPT.md](./REFACTOR_PROMPT.md) 📘 **完整技术指南**
**用途**: 完整的实施手册，包含所有技术细节
**内容**:
- 项目概述和重构目标
- 技术栈详细对比
- 完整的项目结构
- SQLite数据库设计（18个表的完整SQL）
- 核心实现指南：
  - FastAPI应用架构
  - 智谱AI统一客户端
  - Faiss向量存储
  - 任务编排器
  - Agent基类
  - 8个Agent的完整实现示例
- API端点实现
- 环境变量配置
- Python依赖清单
- 9个实施阶段的详细步骤
- 关键注意事项
- 验收标准
- 常见问题与解决方案

**适合**: 技术团队深入了解实现细节时阅读

---

## 🚀 使用指南

### 如果你是...

#### 项目经理/技术负责人
1. 先读 [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md) 了解总体方案
2. 再读 [REFACTOR_COMPARISON.md](./REFACTOR_COMPARISON.md) 评估成本和收益
3. 决定是否采用新方案

#### 开发工程师
1. 先读 [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md) 了解架构
2. 再读 [REFACTOR_PROMPT.md](./REFACTOR_PROMPT.md) 深入技术细节
3. 最后复制 [CLAUDE_CODE_PROMPT.md](./CLAUDE_CODE_PROMPT.md) 给Claude Code执行

#### Claude Code/AI助手
1. 直接使用 [CLAUDE_CODE_PROMPT.md](./CLAUDE_CODE_PROMPT.md) 的内容
2. 参考其他文档解决具体问题

---

## 📊 快速对比

| 维度 | 原系统 (Node.js) | 新系统 (Python) | 改进 |
|------|-----------------|----------------|------|
| **Docker容器** | 6个 | 0个 | ✅ 简化部署 |
| **GPU需求** | RTX 4090 (24GB) | 无需GPU | ✅ 降低成本 |
| **代码量** | ~7300行 | ~3400行 | ✅ 减少53% |
| **部署时间** | 15-30分钟 | 2-3分钟 | ✅ 快10倍 |
| **月成本** | ¥6400-19000 | ¥150-700 | ✅ 省95% |
| **并发能力** | 3-5个任务 | 10-50个任务 | ✅ 提升10倍 |

---

## 🎯 核心优势

### 1. 部署极简
```bash
# 原系统: 启动6个容器
docker compose up -d

# 新系统: 运行Python
python server/main.py
```

### 2. 成本优化
- 去除GPU服务器需求
- 使用智谱API按需付费
- 月成本从¥6400-19000降至¥150-700

### 3. 开发高效
- Python生态更成熟
- 代码量减少53%
- 单机调试，无需排查分布式问题

### 4. 功能完整
- 保留所有核心功能
- 前端代码完全不变
- API端点100%兼容

---

## ⚙️ 技术栈

### 前端（保持不变）
```
React + Vite + TailwindCSS + Lucide Icons
```

### 后端（替换为）
```
FastAPI + SQLite + Faiss + 智谱AI
```

### 依赖服务（全部移除）
```diff
- PostgreSQL + pgvector
- Redis
- MinIO
- vLLM (3个容器)
```

---

## 📖 实施路线图

### Phase 1: 项目初始化 (1天)
- 创建目录结构
- 配置Python依赖
- 复制前端代码

### Phase 2: 数据库层 (2天)
- SQLite表结构定义
- SQLAlchemy模型
- 数据库初始化脚本

### Phase 3: 核心服务 (3天)
- 智谱AI客户端
- Faiss向量存储
- 文件存储服务
- 任务/知识库服务

### Phase 4: Agent系统 (5天)
- 8个Agent实现
- LLM风险分析
- 证据链收集

### Phase 5: 任务编排 (2天)
- 状态机实现
- 取消机制
- 错误重试

### Phase 6: API路由 (3天)
- 6个路由模块
- API兼容性验证

### Phase 7: 前端集成 (1天)
- 前端代码复用
- 端到端测试

### Phase 8: 测试 (3天)
- 单元测试
- 集成测试
- 性能测试

### Phase 9: 文档 (1天)
- README编写
- 部署指南

**总计**: 21天（3周）

---

## ✅ 验收标准

### 功能完整性
- [ ] 知识库管理（导入、向量化、检索）
- [ ] 合同上传与任务创建
- [ ] 8阶段处理流程
- [ ] 风险结果展示（含证据链）
- [ ] 报告生成与下载
- [ ] 所有前端页面正常

### 性能指标
- [ ] 单任务 < 5分钟
- [ ] 并发3个任务
- [ ] KB检索 < 2秒

### 代码质量
- [ ] 类型注解 > 80%
- [ ] 测试覆盖率 > 60%
- [ ] 完整文档

---

## 🔗 相关资源

### 智谱AI
- 官网: https://open.bigmodel.cn/
- Python SDK: https://github.com/zhipuai/zhipuai-python
- 定价: https://open.bigmodel.cn/pricing

### Faiss
- 官网: https://faiss.ai/
- GitHub: https://github.com/facebookresearch/faiss
- 教程: https://github.com/facebookresearch/faiss/wiki

### FastAPI
- 官网: https://fastapi.tiangolo.com/
- 文档: https://fastapi.tiangolo.com/tutorial/

---

## 💬 常见问题

### Q: 为什么选择Python而不是继续Node.js？
**A**: Python在AI/ML领域生态更成熟，Faiss、智谱SDK都有官方Python支持。

### Q: SQLite够用吗？
**A**: 够用。SQLite支持百万级记录，对于中小规模应用完全足够。

### Q: 智谱API稳定吗？
**A**: 智谱是清华系公司，API稳定性有保障，且有备用方案。

### Q: 如何从原系统迁移？
**A**: 提供了数据库迁移脚本和向量导出工具，1-2天可完成。

### Q: 前端代码真的不用改吗？
**A**: 对的，只要API端点和响应格式保持一致，前端完全不需要修改。

---

## 📞 支持

如有问题，请参考：
1. [CLAUDE_CODE_PROMPT.md](./CLAUDE_CODE_PROMPT.md) - 实施指南
2. [REFACTOR_PROMPT.md](./REFACTOR_PROMPT.md) - 技术细节
3. [REFACTOR_COMPARISON.md](./REFACTOR_COMPARISON.md) - 对比分析

---

## 🎉 开始重构

准备好了吗？复制 [CLAUDE_CODE_PROMPT.md](./CLAUDE_CODE_PROMPT.md) 的内容给Claude Code，开始重构之旅！

**预计时间**: 3周
**预计成本节省**: 95%
**代码量减少**: 53%

祝重构顺利！🚀
