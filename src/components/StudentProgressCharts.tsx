"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Section, Card } from "@/components/ui";

const CHART_ACCENT = "#0e7490";
const CHART_MUTED = "var(--border-strong)";
const CHART_SECONDARY = "var(--muted)";
const CHART_INK = "var(--foreground)";
const CHART_TERTIARY = "#a8a29e";

const tooltipStyle = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
  boxShadow: "var(--shadow-sm)",
};

type RangeDays = 14 | 30;

function formatShortDate(isoDate: string) {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

type StudentProgressChartsProps = {
  studentId: Id<"students">;
  defaultRangeDays?: RangeDays;
  title?: string;
};

export function StudentProgressCharts({
  studentId,
  defaultRangeDays = 30,
  title,
}: StudentProgressChartsProps) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(defaultRangeDays);
  const [rangeAnchor] = useState(() => Date.now());

  const { since, until } = useMemo(() => {
    return {
      until: rangeAnchor,
      since: rangeAnchor - rangeDays * 24 * 60 * 60 * 1000,
    };
  }, [rangeDays, rangeAnchor]);

  const data = useQuery(api.logs.progressChartData, {
    studentId,
    since,
    until,
  });

  if (data === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading charts…</p>;
  }

  const timeSeries = data.timeSeries.map((point) => ({
    ...point,
    label: formatShortDate(point.date),
  }));

  const subjectBars =
    data.bySubject.length > 0
      ? data.bySubject
      : [{ subjectId: null, name: "No data", minutes: 0 }];

  const entryBars = data.byEntryType;
  const verifiedBars = data.verifiedBreakdown.map((row) => ({
    ...row,
    label: row.status === "verified" ? "Verified" : "Unverified",
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {title ? (
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {title}
            </h2>
          ) : null}
          <p className="text-sm text-[var(--muted)]">
            Last {rangeDays} days of logged learning.
          </p>
        </div>
        <div className="flex gap-2">
          {([14, 30] as const).map((days) => (
            <Button
              key={days}
              variant={rangeDays === days ? "primary" : "secondary"}
              size="sm"
              onClick={() => setRangeDays(days)}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total minutes", value: data.totals.totalMinutes },
          { label: "Verified", value: data.totals.verifiedMinutes },
          { label: "Entries", value: data.totals.entryCount },
          {
            label: "Streak / days logged",
            value: (
              <>
                {data.totals.streak}
                <span className="text-base font-normal text-[var(--muted)]">
                  {" "}
                  / {data.totals.daysLogged}
                </span>
              </>
            ),
          },
        ].map(({ label, value }) => (
          <Card key={label} padding="sm" className="text-center sm:text-left">
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {value}
            </dd>
          </Card>
        ))}
      </dl>

      <Section title="Minutes over time">
        <Card padding="sm">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_MUTED} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_MUTED }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date
                      ? String(payload[0].payload.date)
                      : ""
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  name="Minutes"
                  stroke={CHART_ACCENT}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="verifiedMinutes"
                  name="Verified"
                  stroke={CHART_TERTIARY}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Minutes by subject">
          <Card padding="sm">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectBars}
                  margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
                >
                  <CartesianGrid stroke={CHART_MUTED} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_MUTED }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="minutes" name="Minutes" fill={CHART_ACCENT} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

        <Section title="Minutes by entry type">
          <Card padding="sm">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={entryBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_MUTED} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_MUTED }}
                  />
                  <YAxis
                    tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="minutes" name="Minutes" fill={CHART_INK} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>
      </div>

      <Section title="Verified vs unverified">
        <Card padding="sm" className="max-w-md">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verifiedBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_MUTED} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_MUTED }}
                />
                <YAxis
                  tick={{ fill: CHART_SECONDARY, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="minutes" name="Minutes" fill={CHART_TERTIARY} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>
    </div>
  );
}
