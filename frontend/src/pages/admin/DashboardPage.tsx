import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/context/I18nContext";
import { api, unwrapEnvelope } from "@/lib/api";
import type { AdminDashboard } from "@/types/api";

const chartPalette = ["#00677d", "#00b4d8", "#8fbfd0", "#d5e5eb"];

export default function DashboardPage() {
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get("/dashboard/admin");
        setDashboard(unwrapEnvelope<AdminDashboard>(response.data));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const statusChartData = useMemo(
    () =>
      dashboard?.tasksByStatus.map((item) => ({
        name: prettyStatus(item.status),
        total: item.count,
      })) ?? [],
    [dashboard],
  );

  const roleChartData = useMemo(
    () =>
      dashboard?.roleDistribution.map((item) => ({
        name: prettyRole(item.roleCode),
        value: item.count,
      })) ?? [],
    [dashboard],
  );

  const summaryCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const openTasks = Math.max(dashboard.summary.totalTasks - dashboard.summary.completedTasks, 0);
    const completionRate =
      dashboard.summary.totalTasks > 0
        ? Math.round((dashboard.summary.completedTasks / dashboard.summary.totalTasks) * 100)
        : 0;

    return [
      {
        key: "activeUsers",
        label: t("dashboard.activeUsers"),
        value: dashboard.summary.activeUsers,
        note: t("dashboard.totalAccounts", { count: dashboard.summary.totalUsers }),
        accent: "from-primary/14 via-primary/8 to-surface-container-lowest dark:to-surface-container-low dark:via-primary/10",
      },
      {
        key: "openTasks",
        label: t("dashboard.openTasks"),
        value: openTasks,
        note: t("dashboard.managerAssigned", {
          count: dashboard.summary.managerAssignedTasks,
        }),
        accent: "from-sky-100 via-white to-primary/5 dark:from-primary/12 dark:via-surface-container dark:to-surface-container-high",
      },
      {
        key: "completionRate",
        label: t("dashboard.completionRate"),
        value: `${completionRate}%`,
        note: t("dashboard.tasksDone", { count: dashboard.summary.completedTasks }),
        accent: "from-emerald-100 via-white to-emerald-50 dark:from-emerald-500/12 dark:via-surface-container dark:to-surface-container-high",
      },
      {
        key: "overdueTasks",
        label: t("dashboard.overdueRisk"),
        value: dashboard.summary.overdueTasks,
        note: t("dashboard.stillInProgress", {
          count: dashboard.summary.inProgressTasks,
        }),
        accent: "from-rose-100 via-white to-rose-50 dark:from-rose-500/12 dark:via-surface-container dark:to-surface-container-high",
      },
    ];
  }, [dashboard, t]);

  if (loading) {
    return <div className="p-6 text-sm text-on-surface-variant">{t("dashboard.loading")}</div>;
  }

  if (!dashboard) {
    return (
      <div className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-6">
        <h1 className="text-3xl font-semibold text-on-surface">{t("dashboard.title")}</h1>
        <p className="mt-3 text-sm text-error">{error ?? t("dashboard.unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-on-surface">{t("dashboard.title")}</h1>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className={`min-w-0 rounded-[28px] border border-outline-variant bg-gradient-to-br ${card.accent} px-5 py-5 shadow-[0_10px_28px_rgba(0,103,125,0.05)] sm:px-6`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary">
              {card.label}
            </p>
            <div className="mt-5 text-[2rem] font-semibold leading-none text-on-surface sm:text-[2.5rem]">
              {card.value}
            </div>
            <p className="mt-4 text-sm text-on-surface-variant">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={t("dashboard.taskStatusDistribution")}
          description={t("dashboard.taskStatusDescription")}
          badge={t("dashboard.tasksBadge", { count: dashboard.summary.totalTasks })}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={statusChartData} barGap={12}>
              <CartesianGrid vertical={false} stroke="var(--outline-variant)" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-container-high)" }} />
              <Bar dataKey="total" radius={[14, 14, 0, 0]} fill="var(--primary-brand)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.roleDistribution")}
          description={t("dashboard.roleDistributionDescription")}
          badge={t("dashboard.rolesBadge", { count: dashboard.summary.totalRoles })}
        >
          <div className="space-y-5">
            <div className="mx-auto h-[320px] max-w-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={112}
                    paddingAngle={3}
                  >
                    {roleChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {roleChartData.map((item, index) => (
                <div key={item.name} className="inline-flex items-center gap-3 rounded-full px-3 py-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
                  />
                  <span className="font-medium text-on-surface">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-6">
        <ChartCard
          title={t("dashboard.focusTimeTracking")}
          description={t("dashboard.focusTimeDescription")}
          badge={t("dashboard.lowToHighIntensity")}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-3 text-xs font-medium uppercase tracking-[0.16em] text-secondary">
              <span>{t("dashboard.low")}</span>
              <div className="flex gap-1">
                {[0.15, 0.35, 0.55, 0.75, 1].map((value) => (
                  <span
                    key={value}
                    className="size-4 rounded-sm border border-outline-variant/50"
                    style={{ backgroundColor: heatmapColor(value) }}
                  />
                ))}
              </div>
              <span>{t("dashboard.high")}</span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px] space-y-2 pb-1">
                <div
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: `88px repeat(${dashboard.focusHeatmap.timeSlots.length}, minmax(0, 1fr))` }}
                >
                  <div />
                  {dashboard.focusHeatmap.timeSlots.map((slot) => (
                    <div
                      key={slot.hour}
                      className="text-center text-xs font-medium uppercase tracking-[0.16em] text-secondary"
                    >
                      {slot.label}
                    </div>
                  ))}
                </div>

                {dashboard.focusHeatmap.rows.map((row) => (
                  <div
                    key={row.dateKey}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: `88px repeat(${row.cells.length}, minmax(0, 1fr))` }}
                  >
                    <div className="pr-2 text-right text-sm font-medium text-secondary">{row.label}</div>
                    {row.cells.map((cell) => (
                      <div
                        key={`${row.dateKey}-${cell.hour}`}
                        className="group relative h-10 rounded-[12px] border border-outline-variant/50 transition-transform hover:-translate-y-0.5 hover:shadow-sm"
                        style={{ backgroundColor: heatmapColor(cell.intensity) }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-on-surface/85">
                          {cell.count > 0 ? cell.count : ""}
                        </div>
                        <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden min-w-[170px] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-left shadow-lg group-hover:block">
                          <div className="text-xs uppercase tracking-[0.16em] text-secondary">
                            {row.label} | {cell.label}
                          </div>
                          <div className="mt-1 text-sm font-medium text-on-surface">
                            {t("dashboard.statusChanges", { count: cell.count })}
                          </div>
                          <div className="mt-1 text-sm text-on-surface-variant">
                            {t("dashboard.employeesCount", { count: cell.employeeCount })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>
      </section>
    </div>
  );
}

function ChartCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
        </div>
        <Badge variant="outline">{badge}</Badge>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string;
    value?: string | number;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-lg">
      {label ? <div className="mb-2 text-xs uppercase tracking-[0.18em] text-secondary">{label}</div> : null}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: entry.color ?? "#00677d" }}
            />
            <span className="text-on-surface">{prettyDataKey(String(entry.name ?? entry.dataKey ?? ""))}</span>
            <span className="ml-auto font-medium text-on-surface">{entry.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function prettyStatus(status: string) {
  return status.replaceAll("_", " ");
}

function prettyRole(roleCode: string) {
  return roleCode.charAt(0) + roleCode.slice(1).toLowerCase();
}

function prettyDataKey(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function heatmapColor(intensity: number) {
  const alpha = intensity <= 0 ? 0.12 : 0.18 + intensity * 0.72;
  return `rgba(0, 103, 125, ${alpha})`;
}
