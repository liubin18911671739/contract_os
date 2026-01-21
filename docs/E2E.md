# E2E 测试配置指南

本文档说明如何为合同预审系统设置和运行端到端测试。

## 推荐工具

### Playwright（推荐）
- 支持多浏览器（Chrome、Firefox、Safari、Edge）
- 强大的选择器和 API
- 自动等待机制
- 视觉录制和回放
- 并行测试执行

### 安装
```bash
npm install -D @playwright/test
npx playwright install
```

## E2E 测试场景

### 场景 1：完整用户流程
1. 启动应用
2. 创建知识库集合
3. 上传 KB 文档
4. 创建合同预审任务
5. 监控处理进度
6. 查看分析结果
7. 生成并下载报告

### 场景 2：知识库管理
1. 创建多个 KB 集合
2. 批量上传文档
3. 验证索引完成
4. 测试检索功能
5. 验证快照过滤

### 场景 3：多任务并发
1. 同时创建 3 个任务
2. 验证队列处理
3. 检查任务独立性
4. 验证无数据混乱

## Playwright 配置示例

### playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### E2E 测试示例

#### e2e/complete-flow.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test.describe('Complete User Flow', () => {
  test('should complete full contract analysis workflow', async ({ page }) => {
    // Navigate to KB Admin
    await page.goto('/');
    await page.click('text=Knowledge Base');

    // Create KB collection
    await page.click('text=New Collection');
    await page.fill('[name="name"]', 'Test Legal KB');
    page.selectOption('[name="scope"]', 'GLOBAL');
    await page.click('button:has-text("Create")');

    // Upload KB document
    await page.click('text=Upload Document');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./e2e/fixtures/sample-kb.txt');

    await page.click('button:has-text("Upload")');

    // Wait for indexing (in real test, would check status)
    await page.waitForTimeout(2000);

    // Navigate to New Task
    await page.click('text=New Task');

    // Fill contract info
    await page.fill('[name="contract_name"]', 'Test Contract');
    await page.fill('[name="counterparty"]', 'Test Party');

    // Upload contract file
    const contractFile = await page.locator('input[type="file"]');
    await contractFile.setInputFiles('./e2e/fixtures/sample-contract.txt');

    // Select KB collection
    await page.check('.checkbox'); // First KB collection

    // Create task
    await page.click('button:has-text("Create Task")');

    // Should redirect to processing page
    await page.waitForURL(/\/processing\/.+/);
    await expect(page.locator('h2')).toContainText('Processing Task');

    // Wait for completion (in real test, would poll API)
    // For now, just verify UI elements
    await expect(page.locator('.progress-bar')).toBeVisible();
    await expect(page.locator('.timeline')).toBeVisible();

    // Eventually would navigate to results
    // Then generate and verify report
  });
});

test.describe('KB Management', () => {
  test('should create and manage KB collections', async ({ page }) => {
    await page.goto('/kb');

    // Create collection
    await page.click('text=New Collection');
    await page.fill('[name="name"]', 'E2E Test Collection');
    await page.click('button:has-text("Create")');

    // Verify collection appears
    await expect(page.locator('text=E2E Test Collection')).toBeVisible();
  });
});

test.describe('Report Generation', () => {
  test('should generate and download report', async ({ page }) => {
    // Assuming a completed task exists
    await page.goto('/results/test-task-id');

    // Wait for task completion
    await page.waitForSelector('button:has-text("HTML Report")', { timeout: 10000 });

    // Click generate report
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("HTML Report")');

    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(html|json)$/);
  });
});
```

## 运行 E2E 测试

### 安装依赖
```bash
npm install -D @playwright/test
npx playwright install
```

### 运行测试
```bash
# 运行所有 E2E 测试
npx playwright test

# 运行特定测试文件
npx playwright test complete-flow.spec.ts

# 调试模式（打开浏览器窗口）
npx playwright test --debug

# 生成测试报告
npx playwright test --reporter=html
```

## 测试数据准备

### e2e/fixtures/sample-contract.txt
```text
服务合同

甲方：ABC 公司
乙方：XYZ 科技有限公司

第一条 服务内容
乙方为甲方提供软件开发服务，包括但不限于需求分析、系统设计、编码实现、测试部署。

第二条 付款条款
甲方应在验收合格后 30 日内支付全部款项。
若逾期支付，每日按逾期金额的 0.05% 支付违约金。

第三条 知识产权
乙方交付的所有软件、文档、资料的知识产权归甲方所有。

第四条 违约责任
任何一方违反本合同，应承担违约责任，并赔偿因此给对方造成的全部损失。

第五条 争议解决
因本合同引起的或与本合同有关的任何争议，双方应友好协商解决。
```

### e2e/fixtures/sample-kb.txt
```text
中华人民共和国合同法知识库

付款期限条款规定：
- 付款期限不应超过 60 天
- 逾期付款应支付合理的违约金
- 违约金比例不应超过 0.1%

知识产权条款要求：
- 软件开发合同的知识产权归属应明确
- 需注明交付成果的形式和范围
- 保留权利的限制应清晰列出

违约责任规范：
- 违约金应与实际损失相当
- 不可抗力因素应予免责
- 赔偿范围应包括直接损失和间接损失
```

## 持续集成配置

### GitHub Actions 示例
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: |
          npm install
          npx playwright install --with-deps

      - name: Install dependencies
        run: npm run build

      - name: Start services
        run: docker compose up -d

      - name: Wait for services
        run: npm run wait

      - name: Run migrations
        run: npm run db:migrate

      - name: Run E2E tests
        run: npx playwright test

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## 性能基准测试

### K6 性能测试示例
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  // Test health endpoint
  let res = http.get('http://localhost:3000/api/health');
  check(res.status === 200, 'Health check failed');

  // Test task creation
  const payload = JSON.stringify({
    contract_version_id: 'test-ver',
    kb_collection_ids: ['test-kb'],
    kb_mode: 'STRICT',
  });

  res = http.post('http://localhost:3000/api/precheck-tasks', {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  check(res.status === 201, 'Task creation failed');

  sleep(1);
};
```

### 运行 K6 测试
```bash
# 安装 K6
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

# 运行测试
k6 run performance-test.js
```

## 测试最佳实践

### 1. 测试隔离
- 每个测试使用独立数据
- 测试前后清理数据
- 使用事务回滚

### 2. 等待策略
```typescript
// ❌ 不好的做法
await page.waitForTimeout(5000);

// ✅ 好的做法
await page.waitForSelector('.results-table');
await page.waitForURL(/\/results\/.+/);
await page.waitForResponse(response => response.status() === 200);
```

### 3. 选择器策略
```typescript
// 优先级：data-testid > aria-label > text
await page.click('[data-testid="submit-button"]');
await page.click('button:has-text("Submit")');
```

### 4. 并行测试
```typescript
test.describe.configure({ mode: 'parallel' })(() => {
  test('scenario 1', async () => {});
  test('scenario 2', async () => {});
  test('scenario 3', async () => {});
});
```

## 当前状态

- ✅ E2E 测试框架文档完成
- ✅ 测试场景定义完成
- ⏳ 实际测试文件待实现（需要安装 Playwright）
- ⏳ 测试数据准备待完成

## 下一步

1. 安装 Playwright：`npm install -D @playwright/test`
2. 创建 e2e 目录和测试文件
3. 添加测试数据到 e2e/fixtures/
4. 配置 CI/CD 集成
5. 运行首次 E2E 测试
