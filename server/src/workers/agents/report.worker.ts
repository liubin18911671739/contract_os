/**
 * Report agent worker - generates downloadable reports
 */
import { createWorker } from '../../queues/index.js';
import { reportService } from '../../services/reportService.js';
import { BaseAgent } from '../../agents/baseAgent.js';
import { logger } from '../../config/logger.js';

interface ReportJobData {
  taskId: string;
  format?: 'html' | 'json';
  generateBoth?: boolean;
}

class ReportAgent extends BaseAgent {
  readonly stageName = 'REPORT';

  protected async execute(jobData: ReportJobData): Promise<any> {
    const { taskId, format = 'html', generateBoth = false } = jobData;

    logger.info({ taskId, format, generateBoth }, 'Starting report generation');

    const results = [];

    // Generate HTML report
    const htmlReport = await reportService.createReport(taskId, 'html');
    results.push({
      reportId: htmlReport.reportId,
      format: 'html',
      objectKey: htmlReport.objectKey,
    });

    // Generate JSON report if requested
    if (generateBoth || format === 'json') {
      const jsonReport = await reportService.createReport(taskId, 'json');
      results.push({
        reportId: jsonReport.reportId,
        format: 'json',
        objectKey: jsonReport.objectKey,
      });
    }

    logger.info({
      taskId,
      reports: results.length,
      reportIds: results.map(r => r.reportId),
    }, 'Report generation completed');

    return {
      reports: results,
      downloadUrls: results.map(r => ({
        reportId: r.reportId,
        format: r.format,
        // URL would be generated on-demand via GET /api/reports/:reportId/download
      })),
    };
  }
}

const agent = new ReportAgent();
export const reportWorker = createWorker('precheck.agent.report', (job) => agent.run(job.data), {
  concurrency: 2,
});
