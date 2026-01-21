/**
 * Dashboard service
 * Provides statistics and overview data for the dashboard
 */
import { sql } from '../config/db.js';

export interface DashboardStats {
  total_contracts: number;
  high_risk_findings: number;
  compliance_rate: number;
  avg_processing_time: number; // in seconds
  trends_7d: {
    contracts_analyzed: number;
    risk_discovery: number;
    compliance_rate: number;
  };
}

export interface RecentTask {
  id: string;
  contract_name: string;
  status: string;
  progress: number;
  created_at: string;
  high_risks: number;
  medium_risks: number;
}

export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    // Get current date and 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Total contracts analyzed
    const [totalContractsResult] = await sql<any[]>`
      SELECT COUNT(*) as count
      FROM precheck_tasks
      WHERE status = 'DONE'
    `;
    const total_contracts = Number(totalContractsResult?.count || 0);

    // High risk findings
    const [highRisksResult] = await sql<any[]>`
      SELECT COUNT(*) as count
      FROM risks
      WHERE risk_level = 'HIGH'
    `;
    const high_risk_findings = Number(highRisksResult?.count || 0);

    // Compliance rate (approved reviews / total reviews)
    const [complianceResult] = await sql<any[]>`
      SELECT
        COUNT(*) FILTER (WHERE conclusion = 'APPROVE') * 100.0 / NULLIF(COUNT(*), 0) as rate
      FROM reviews
    `;
    const compliance_rate = Number(complianceResult?.rate || 0);

    // Average processing time in seconds
    const [avgTimeResult] = await sql<any[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
      FROM precheck_tasks
      WHERE status = 'DONE'
    `;
    const avg_processing_time = Math.round(Number(avgTimeResult?.avg_seconds || 0));

    // 7-day trends
    const [trendsResult] = await sql<any[]>`
      WITH current_period AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'DONE') as contracts,
          0 as risk_discovery -- Placeholder: need historical comparison
        FROM precheck_tasks
        WHERE created_at >= ${sevenDaysAgo}
      ),
      previous_period AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'DONE') as contracts
        FROM precheck_tasks
        WHERE created_at >= ${sevenDaysAgo} - INTERVAL '7 days'
        AND created_at < ${sevenDaysAgo}
      )
      SELECT
        cp.contracts as current_contracts,
        pp.contracts as previous_contracts
      FROM current_period cp, previous_period pp
    `;

    const currentContracts = Number(trendsResult?.current_contracts || 0);
    const previousContracts = Number(trendsResult?.previous_contracts || 0);

    // Calculate trend percentages
    const contracts_analyzed = previousContracts > 0
      ? Math.round((currentContracts - previousContracts) / previousContracts * 100)
      : 0;

    const risk_discovery = 0; // Placeholder: need historical risk data

    const compliance_rate_trend = 0; // Placeholder: need historical compliance data

    return {
      total_contracts,
      high_risk_findings,
      compliance_rate: Math.round(compliance_rate * 10) / 10,
      avg_processing_time,
      trends_7d: {
        contracts_analyzed,
        risk_discovery,
        compliance_rate: compliance_rate_trend,
      },
    };
  }

  async getRecentTasks(page: number = 1, limit: number = 10): Promise<{
    tasks: RecentTask[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await sql<any[]>`
      SELECT COUNT(*) as count
      FROM precheck_tasks
    `;
    const total = Number(countResult?.count || 0);

    // Get recent tasks with contract names and risk counts
    const tasks = await sql<any[]>`
      SELECT
        pt.id,
        c.contract_name,
        pt.status,
        pt.progress,
        pt.created_at,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'HIGH') as high_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'MEDIUM') as medium_risks
      FROM precheck_tasks pt
      LEFT JOIN contract_versions cv ON pt.contract_version_id = cv.id
      LEFT JOIN contracts c ON cv.contract_id = c.id
      LEFT JOIN risks r ON pt.id = r.task_id
      GROUP BY pt.id, c.contract_name
      ORDER BY pt.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        contract_name: t.contract_name || 'Unknown Contract',
        status: t.status,
        progress: t.progress,
        created_at: t.created_at.toISOString(),
        high_risks: Number(t.high_risks || 0),
        medium_risks: Number(t.medium_risks || 0),
      })),
      total,
      page,
      limit,
    };
  }
}

export const dashboardService = new DashboardService();
