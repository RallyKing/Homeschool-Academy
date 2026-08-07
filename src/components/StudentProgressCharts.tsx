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

const CHART_INK = "#262626";
const CHART_MUTED = "#a3a3a3";
const CHART_ACCENT = "#0f766e";
const CHART_SECONDARY = "#57534e";
const CHART_TERTIARY = "#a8a29e";

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
    return <p className="text-sm text-neutral-500">Loading charts…</p>;
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
            <h2 className="text-lg font-medium">{title}</h2>
          ) : null}
          <p className="text-sm text-neutral-600">
            Last {rangeDays} days of logged learning.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {([14, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={
                rangeDays === days
                  ? "border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-white"
                  : "border border-neutral-300 px-2.5 py-1 text-neutral-700"
              }
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">Total minutes</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {data.totals.totalMinutes}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Verified</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {data.totals.verifiedMinutes}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Entries</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {data.totals.entryCount}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Streak / days logged</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {data.totals.streak}
            <span className="text-base font-normal text-neutral-500">
              {" "}
              / {data.totals.daysLogged}
            </span>
          </dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-800">
          Minutes over time
        </h3>
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
                contentStyle={{
                  border: "1px solid #d4d4d4",
                  background: "#fff",
                  fontSize: 12,
                }}
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
                stroke={CHART_SECONDARY}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-800">
            Minutes by subject
          </h3>
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
                <Tooltip
                  contentStyle={{
                    border: "1px solid #d4d4d4",
                    background: "#fff",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="minutes" name="Minutes" fill={CHART_ACCENT} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-800">
            Minutes by entry type
          </h3>
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
                <Tooltip
                  contentStyle={{
                    border: "1px solid #d4d4d4",
                    background: "#fff",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="minutes" name="Minutes" fill={CHART_INK} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-800">
          Verified vs unverified
        </h3>
        <div className="h-44 w-full max-w-md">
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
              <Tooltip
                contentStyle={{
                  border: "1px solid #d4d4d4",
                  background: "#fff",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="minutes" name="Minutes" fill={CHART_TERTIARY} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
