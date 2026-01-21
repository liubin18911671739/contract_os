/**
 * Report service - generates downloadable reports
 */
import { sql } from '../config/db.js';
import { minio } from '../config/minio.js';
import { generateId } from '../utils/hash.js';
import { logger } from '../config/logger.js';

export interface ReportData {
  taskId: string;
  contractInfo: any;
  summary: any;
  risks: any[];
  clauses: any[];
  events: any[];
  review?: any;
}

export class ReportService {
  /**
   * Generate HTML report
   */
  async generateHTMLReport(data: ReportData): Promise<string> {
    const { contractInfo, summary, risks, events, review } = data;

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>合同预审报告 - ${contractInfo.contract_name || 'Unknown'}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
        .summary-card .value { font-size: 32px; font-weight: bold; }
        .high-risk { color: #dc3545; }
        .medium-risk { color: #ffc107; }
        .low-risk { color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .risk-HIGH { background: #dc3545; color: white; }
        .risk-MEDIUM { background: #ffc107; color: #333; }
        .risk-LOW { background: #28a745; color: white; }
        .risk-INFO { background: #17a2b8; color: white; }
        .timeline { margin: 20px 0; }
        .timeline-item { padding: 10px; border-left: 3px solid #0066cc; margin-left: 10px; }
        .info-box { background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <h1>合同预审报告</h1>

    <div class="info-box">
        <strong>合同名称：</strong>${contractInfo.contract_name || 'N/A'}<br>
        <strong>对方：</strong>${contractInfo.counterparty || 'N/A'}<br>
        <strong>类型：</strong>${contractInfo.contract_type || 'N/A'}<br>
        <strong>任务ID：</strong>${data.taskId}<br>
        <strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}
    </div>

    <h2>风险统计</h2>
    <div class="summary">
        <div class="summary-card">
            <h3>高风险</h3>
            <div class="value high-risk">${summary.high_risks || 0}</div>
        </div>
        <div class="summary-card">
            <h3>中风险</h3>
            <div class="value medium-risk">${summary.medium_risks || 0}</div>
        </div>
        <div class="summary-card">
            <h3>低风险</h3>
            <div class="value low-risk">${summary.low_risks || 0}</div>
        </div>
        <div class="summary-card">
            <h3>条款数</h3>
            <div class="value">${summary.clause_count || 0}</div>
        </div>
    </div>

    <h2>风险详情</h2>
    <table>
        <thead>
            <tr>
                <th>条款</th>
                <th>风险等级</th>
                <th>风险类型</th>
                <th>置信度</th>
                <th>摘要</th>
            </tr>
        </thead>
        <tbody>
            ${risks
              .map(
                (risk) => `
            <tr>
                <td>${risk.title || risk.clause_id}</td>
                <td><span class="risk-badge risk-${risk.risk_level}">${risk.risk_level}</span></td>
                <td>${risk.risk_type || '-'}</td>
                <td>${(risk.confidence * 100).toFixed(0)}%</td>
                <td>${risk.summary || '-'}</td>
            </tr>
            `
              )
              .join('')}
        </tbody>
    </table>

    ${risks.length === 0 ? '<p style="color: #28a745; font-size: 18px;">✓ 未发现明显风险</p>' : ''}

    ${
      review
        ? `
    <h2>审阅结论</h2>
    <div class="info-box">
        <strong>结论：</strong>${review.conclusion}<br>
        ${review.notes ? `<strong>备注：</strong>${review.notes}<br>` : ''}
        <strong>审阅人：</strong>${review.created_by || 'System'}<br>
        <strong>时间：</strong>${new Date(review.created_at).toLocaleString('zh-CN')}
    </div>
    `
        : ''
    }

    <h2>处理时间线</h2>
    <div class="timeline">
        ${events
          .slice(-10)
          .map(
            (event) => `
        <div class="timeline-item">
            <strong>${event.stage}</strong> - ${event.message}<br>
            <small style="color: #666;">${new Date(event.ts).toLocaleString('zh-CN')}</small>
        </div>
        `
          )
          .join('')}
    </div>

    <div class="footer">
        <p>本报告由合同预审系统自动生成</p>
        <p>系统版本：v0.1.0 | 生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(data: ReportData): Promise<object> {
    return {
      report_id: generateId('report'),
      task_id: data.taskId,
      generated_at: new Date().toISOString(),
      contract: data.contractInfo,
      summary: data.summary,
      risks: data.risks,
      clauses: data.clauses,
      events: data.events.slice(-20),
      review: data.review,
      system_version: 'v0.1.0',
    };
  }

  /**
   * Collect report data
   */
  async collectReportData(taskId: string): Promise<ReportData> {
    // Get contract info
    const [contractInfo] = await sql`
      SELECT c.contract_name, c.counterparty, c.contract_type, cv.version_no
      FROM precheck_tasks pt
      JOIN contract_versions cv ON pt.contract_version_id = cv.id
      JOIN contracts c ON cv.contract_id = c.id
      WHERE pt.id = ${taskId}
    `;

    // Get summary
    const [summary] = await sql`
      SELECT
        COUNT(DISTINCT c.id) as clause_count,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'HIGH') as high_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'MEDIUM') as medium_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'LOW') as low_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'INFO') as info_risks,
        COUNT(r.id) as total_risks
      FROM precheck_tasks pt
      LEFT JOIN clauses c ON c.task_id = pt.id
      LEFT JOIN risks r ON r.task_id = pt.id
      WHERE pt.id = ${taskId}
      GROUP BY pt.id
    `;

    // Get risks with clause info
    const risks = await sql`
      SELECT
        r.id,
        r.risk_level,
        r.risk_type,
        r.confidence,
        r.summary,
        c.title,
        c.clause_id
      FROM risks r
      JOIN clauses c ON r.clause_id = c.clause_id AND r.task_id = c.task_id
      WHERE r.task_id = ${taskId}
      ORDER BY
        CASE r.risk_level
          WHEN 'HIGH' THEN 1
          WHEN 'MEDIUM' THEN 2
          WHEN 'LOW' THEN 3
          ELSE 4
        END,
        r.confidence DESC
    `;

    // Get clauses
    const clauses = await sql`
      SELECT clause_id, title, text, order_no
      FROM clauses
      WHERE task_id = ${taskId}
      ORDER BY order_no
    `;

    // Get events
    const events = await sql`
      SELECT ts, stage, level, message
      FROM task_events
      WHERE task_id = ${taskId}
      ORDER BY ts ASC
    `;

    // Get review if exists
    const [review] = await sql`
      SELECT conclusion, notes, created_by, created_at
      FROM reviews
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return {
      taskId,
      contractInfo: contractInfo || {},
      summary: summary || {},
      risks,
      clauses,
      events,
      review,
    };
  }

  /**
   * Create and upload report
   */
  async createReport(
    taskId: string,
    format: 'html' | 'json' = 'html'
  ): Promise<{ reportId: string; objectKey: string }> {
    const data = await this.collectReportData(taskId);

    let content: string | object;
    let objectKey: string;
    let mimeType: string;

    if (format === 'html') {
      content = await this.generateHTMLReport(data);
      objectKey = `reports/${taskId}/${Date.now()}.html`;
      mimeType = 'text/html';
    } else {
      content = await this.generateJSONReport(data);
      objectKey = `reports/${taskId}/${Date.now()}.json`;
      mimeType = 'application/json';
    }

    // Upload to MinIO
    const buffer = Buffer.from(
      typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    );
    await minio.putObject(process.env.MINIO_BUCKET || 'contract-precheck', objectKey, buffer, {
      'Content-Type': mimeType,
    });

    // Save report record
    const reportId = generateId('report');
    await sql`
      INSERT INTO reports (id, task_id, object_key, template_id)
      VALUES (${reportId}, ${taskId}, ${objectKey}, ${format})
    `;

    logger.info({ taskId, reportId, format }, 'Report created');

    return { reportId, objectKey };
  }

  /**
   * Get report URL for download
   */
  async getReportUrl(reportId: string): Promise<string> {
    const [report] = await sql`
      SELECT object_key FROM reports WHERE id = ${reportId}
    `;

    if (!report) {
      throw new Error('Report not found');
    }

    // Generate presigned URL (valid for 1 hour)
    const url = await minio.presignedGetObject(
      process.env.MINIO_BUCKET || 'contract-precheck',
      report.object_key,
      3600
    );

    return url;
  }
}

export const reportService = new ReportService();
