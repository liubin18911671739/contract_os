/**
 * Metrics service
 * Provides performance metrics and evaluation data
 */
import { sql } from '../config/db.js';

export interface MetricsOverview {
  period: {
    start: string;
    end: string;
  };
  total_tasks: number;
  completion_rate: number;
  avg_duration_seconds: number;
  risk_distribution: {
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  daily_breakdown: Array<{
    date: string;
    tasks_created: number;
    tasks_completed: number;
  }>;
}

export class MetricsService {
  async getOverview(from: string, to: string): Promise<MetricsOverview> {
    const startDate = new Date(from);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999); // End of day

    // Total tasks in period
    const [totalTasksResult] = await sql<any[]>`
      SELECT COUNT(*) as count
      FROM precheck_tasks
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `;
    const total_tasks = Number(totalTasksResult?.count || 0);

    // Completion rate (tasks with status DONE)
    const [completionResult] = await sql<any[]>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'DONE') * 100.0 / NULLIF(COUNT(*), 0) as rate
      FROM precheck_tasks
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `;
    const completion_rate = Number(completionResult?.rate || 0);

    // Average processing time in seconds
    const [avgDurationResult] = await sql<any[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
      FROM precheck_tasks
      WHERE status = 'DONE'
      AND created_at >= ${startDate} AND created_at <= ${endDate}
    `;
    const avg_duration_seconds = Math.round(Number(avgDurationResult?.avg_seconds || 0));

    // Risk distribution
    const [riskDistResult] = await sql<any[]>`
      SELECT
        COUNT(*) FILTER (WHERE risk_level = 'HIGH') as high,
        COUNT(*) FILTER (WHERE risk_level = 'MEDIUM') as medium,
        COUNT(*) FILTER (WHERE risk_level = 'LOW') as low,
        COUNT(*) FILTER (WHERE risk_level = 'INFO') as info
      FROM risks r
      JOIN precheck_tasks pt ON r.task_id = pt.id
      WHERE pt.created_at >= ${startDate} AND pt.created_at <= ${endDate}
    `;

    const risk_distribution = {
      high: Number(riskDistResult?.high || 0),
      medium: Number(riskDistResult?.medium || 0),
      low: Number(riskDistResult?.low || 0),
      info: Number(riskDistResult?.info || 0),
    };

    // Daily breakdown
    const dailyBreakdown = await sql<any[]>`
      SELECT
        DATE(pt.created_at) as date,
        COUNT(*) as tasks_created,
        COUNT(*) FILTER (WHERE status = 'DONE') as tasks_completed
      FROM precheck_tasks pt
      WHERE pt.created_at >= ${startDate} AND pt.created_at <= ${endDate}
      GROUP BY DATE(pt.created_at)
      ORDER BY date ASC
    `;

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      total_tasks,
      completion_rate: Math.round(completion_rate * 10) / 10,
      avg_duration_seconds,
      risk_distribution,
      daily_breakdown: dailyBreakdown.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        tasks_created: Number(d.tasks_created),
        tasks_completed: Number(d.tasks_completed),
      })),
    };
  }

  async getF1Score(): Promise<{ f1_score: number; precision: number; recall: number }> {
    // Placeholder: In a real implementation, this would come from evaluation results
    // For now, return mock data based on actual task completion
    const [result] = await sql<any[]>`
      WITH completed_tasks AS (
        SELECT COUNT(*) as total
        FROM precheck_tasks
        WHERE status = 'DONE'
      ),
      risks_with_review AS (
        SELECT COUNT(*) as reviewed
        FROM risks
        WHERE status IN ('CONFIRMED', 'DISMISSED')
      )
      SELECT
        COALESCE(ct.total, 0) as total_tasks,
        COALESCE(rw.reviewed, 0) as reviewed_risks
      FROM completed_tasks ct, risks_with_review rw
    `;

    const totalTasks = Number(result?.total_tasks || 0);

    // Mock calculations - in reality these would come from actual evaluation data
    const precision = totalTasks > 0 ? 0.85 + (Math.random() * 0.1) : 0;
    const recall = totalTasks > 0 ? 0.82 + (Math.random() * 0.12) : 0;
    const f1_score =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      f1_score: Math.round(f1_score * 1000) / 10,
      precision: Math.round(precision * 1000) / 10,
      recall: Math.round(recall * 1000) / 10,
    };
  }

  async getHallucinationRate(): Promise<{ rate: number; trend: number }> {
    // Placeholder: In a real implementation, this would track hallucination detection
    // For now, return a mock value
    const rate = 3.2; // Mock value
    const trend = -14.8; // Mock trend percentage

    return {
      rate: Math.round(rate * 10) / 10,
      trend: Math.round(trend * 10) / 10,
    };
  }
}

export const metricsService = new MetricsService();
