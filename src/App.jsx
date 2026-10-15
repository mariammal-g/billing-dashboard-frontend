import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  Users,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const DASHBOARD_ENDPOINT =
  import.meta.env.VITE_DASHBOARD_ENDPOINT || "/dashboard";

const numberFormat = new Intl.NumberFormat("en-IN");

function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

function formatRupeesFromCents(cents) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);
}

function formatDate(value) {
  if (!value) return "";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function StatCard({ title, value, subtitle, color }) {
  return (
    <section className={`stat-card stat-${color}`}>
      <div className="stat-top">
        <span>{title}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </section>
  );
}

function PanelHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="panel-header">
      <div className="panel-title-row">
        {Icon && <Icon size={17} className="panel-heading-icon" />}
        <h2>{title}</h2>
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

function CustomersTable({ customers, includedUnits }) {
  if (!customers.length) {
    return <div className="empty-state">No customer usage data available.</div>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th className="number-cell">Usage</th>
            <th>% of Allowance</th>
          </tr>
        </thead>
        <tbody>
          {customers.slice(0, 5).map((customer) => {
            const usage = Number(customer.usage ?? customer.total_units ?? 0);
            const allowance = Number(customer.allowance ?? includedUnits ?? 0);
            const percentage = allowance
              ? Math.round((usage / allowance) * 100)
              : 0;

            return (
              <tr key={customer.id ?? customer.name}>
                <td>
                  <span className="customer-name">{customer.name}</span>
                </td>
                <td className="number-cell">{formatNumber(usage)}</td>
                <td>
                  <div className="allowance-cell">
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${
                          percentage >= 90
                            ? "progress-high"
                            : percentage >= 70
                              ? "progress-medium"
                              : ""
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <span>{percentage}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DailyUsageChart({ records }) {
  if (!records.length) {
    return (
      <div className="empty-state chart-empty">
        No daily usage records are available.
      </div>
    );
  }

  const chartData = records.map((item) => ({
    date: item.date ?? item.usage_date,
    units: Number(item.units ?? item.total_units ?? 0),
  }));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
        >
          <CartesianGrid stroke="#e9eef5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "#8a94a6", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatNumber}
            tick={{ fill: "#8a94a6", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip
            labelFormatter={formatDate}
            formatter={(value) => [
              `${formatNumber(value)} units`,
              "Daily usage",
            ]}
          />
          <Line
            type="monotone"
            dataKey="units"
            stroke="#2876dc"
            strokeWidth={2.3}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChurnRiskPanel({ customers }) {
  return (
    <section className="panel churn-panel">
      <PanelHeader
        title="Churn Risk"
        subtitle="Customers with usage down more than 50% month over month"
        icon={AlertTriangle}
      />

      {customers.length ? (
        customers.map((customer) => (
          <div className="risk-item" key={customer.id ?? customer.name}>
            <div className="risk-customer">
              <span>{customer.name}</span>
              <small>Usage drop compared with previous period</small>
            </div>
            <span className="risk-percent">
              -{Math.abs(Number(customer.drop_percent ?? 0))}%
            </span>
          </div>
        ))
      ) : (
        <div className="empty-state">
          No customers currently meet the churn-risk threshold.
        </div>
      )}
    </section>
  );
}

function SystemStatusPanel({ status }) {
  const items = [
    ["Plan pricing cache", status.cache
      ? `${status.cache}, TTL ${status.cache_ttl ?? "—"}`
      : "Not reported"],
    ["Aggregation job", status.aggregation ?? "Not reported"],
    ["Batch size", status.batch_size
      ? `${status.batch_size} rows per batch`
      : "Not reported"],
    ["Usage rate limit", status.rate_limit ?? "Not reported"],
  ];

  return (
    <section className="panel system-panel">
      <PanelHeader
        title="System Status"
        subtitle="Service health information"
        icon={Server}
      />

      <div className="system-list">
        {items.map(([label, value]) => (
          <div className="system-row" key={label}>
            <span className="system-label">{label}</span>
            <span className="system-value">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}${DASHBOARD_ENDPOINT}`,
        {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Dashboard API returned HTTP ${response.status}`);
      }

      const result = await response.json();
      const data = result.data ?? result;

      setDashboard(data);
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <main className="app-shell">
        <div className="loading-state">
          <RefreshCw className="spin" size={24} />
          <p>Loading dashboard data...</p>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="app-shell">
        <div className="error-state">
          <AlertTriangle size={28} />
          <h2>Unable to load dashboard</h2>
          <p>{error || "The API returned no dashboard data."}</p>
          <button className="refresh-button" onClick={fetchDashboard}>
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      </main>
    );
  }

  const currentUsage = Number(dashboard.current_cycle_usage ?? 0);
  const includedUnits = Number(dashboard.included_units ?? 0);
  const percentage = includedUnits
    ? Math.round((currentUsage / includedUnits) * 100)
    : 0;

  const plan = dashboard.active_plan ?? {};
  const topCustomers = dashboard.top_customers ?? [];
  const churnRisk = dashboard.churn_risk ?? [];
  const dailyUsage = dashboard.daily_usage ?? [];
  const systemStatus = dashboard.system_status ?? {};

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={20} />
          </div>
          <div>
            <div className="brand-name">Merchant Dashboard</div>
            <div className="brand-caption">
              {dashboard.merchant_name ?? "Merchant"}
            </div>
          </div>
        </div>

        <button
          className="refresh-button"
          onClick={fetchDashboard}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <div className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">MERCHANT OVERVIEW</div>
            <h1>Dashboard Overview</h1>
            <p className="page-description">
              Usage, revenue and customer activity for{" "}
              <strong>{dashboard.merchant_name ?? "your account"}</strong>.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            title="Current Cycle Usage"
            value={`${formatNumber(currentUsage)} / ${formatNumber(includedUnits)}`}
            subtitle={`${percentage}% of included units`}
            color="blue"
          />

          <StatCard
            title="Projected Overage Revenue"
            value={formatRupeesFromCents(
              dashboard.projected_overage_revenue_cents ?? 0
            )}
            subtitle="Estimated current-cycle overage"
            color="orange"
          />

          <StatCard
            title="Active Plan"
            value={plan.name ?? "No active plan"}
            subtitle={plan.billing_cycle ?? "Billing cycle unavailable"}
            color="green"
          />
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <section className="panel customers-panel">
              <PanelHeader
                title="Top 5 Customers by Usage"
                subtitle="Current billing cycle"
                icon={Users}
              />

              <CustomersTable
                customers={topCustomers}
                includedUnits={includedUnits}
              />
            </section>

            <section className="panel chart-panel">
              <PanelHeader
                title="Daily Usage Trend"
                subtitle="Daily totals for the last 30 days"
                icon={Activity}
              />
              <DailyUsageChart records={dailyUsage} />
            </section>
          </div>

          <aside className="side-column">
            <ChurnRiskPanel customers={churnRisk} />
            <SystemStatusPanel status={systemStatus} />

            <section className="panel insight-panel">
              <CheckCircle2 size={19} />
              <div>
                <h3>Dashboard API</h3>
                <p>Data loaded from your Laravel backend.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

