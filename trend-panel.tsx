import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { loadSeriesFn } from "@/lib/funds/api";
import { formatPct, toneClass } from "@/lib/funds/format";
import type { FundQuote, NavPoint, TermFlag } from "@/lib/funds/types";

const PRESETS: { id: TermFlag; label: string }[] = [
  { id: "1", label: "1ヶ月" },
  { id: "3", label: "3ヶ月" },
  { id: "6", label: "6ヶ月" },
  { id: "12", label: "1年" },
  { id: "36", label: "3年" },
  { id: "60", label: "5年" },
  { id: "120", label: "設定来" },
];

const STROKES = ["var(--color-s1)", "var(--color-s2)", "var(--color-s3)", "var(--color-s4)"];

export function TrendPanel({ funds }: { funds: FundQuote[] }) {
  const [preset, setPreset] = useState<TermFlag>("12");
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);

  const term: TermFlag = custom && applied ? termForRange(applied.from, applied.to) : preset;

  const query = useQuery({
    queryKey: ["series", term, funds.map((fund) => fund.isin).join(",")],
    enabled: funds.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      loadSeriesFn({
        data: {
          term,
          refresh: false,
          funds: funds.map((fund) => ({
            isin: fund.isin,
            code: fund.code,
            sep: fund.sep,
            name: fund.short,
          })),
        },
      }),
  });

  const model = useMemo(() => {
    const series = query.data?.series ?? [];
    const range = custom && applied ? applied : null;
    return buildChart(series, funds, range);
  }, [query.data, funds, custom, applied]);

  if (!funds.length) {
    return <p className="text-sm text-mute">比較タブでファンドを1本以上選んでください。</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setPreset(item.id);
              setCustom(false);
            }}
            className={
              "h-10 rounded-full border px-3 text-sm " +
              (!custom && preset === item.id
                ? "border-brass bg-brass text-brass-ink"
                : "border-line bg-panel text-paper")
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!from || !to || from > to) return;
          setApplied({ from, to });
          setCustom(true);
        }}
      >
        <label className="text-xs text-mute">
          開始
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 block h-11 rounded-lg border border-line bg-panel px-2 text-sm text-paper"
          />
        </label>
        <label className="text-xs text-mute">
          終了
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 block h-11 rounded-lg border border-line bg-panel px-2 text-sm text-paper"
          />
        </label>
        <button type="submit" className="h-11 rounded-lg border border-line px-3 text-sm text-paper">
          この期間で比較
        </button>
      </form>
      <p className="text-xs text-mute">
        起点を100とした分配金再投資の基準価額です。期間が長いほど協会データの点は粗くなります。
        {custom && applied ? ` 指定 ${applied.from} 〜 ${applied.to}` : ""}
      </p>

      <div className="h-80 rounded-2xl border border-line bg-panel p-2 sm:h-96">
        {query.isPending ? (
          <p className="p-4 text-sm text-mute">推移を取得しています…</p>
        ) : query.data && !query.data.ok ? (
          <p className="p-4 text-sm text-down">{query.data.error}</p>
        ) : model.rows.length < 2 ? (
          <p className="p-4 text-sm text-mute">この期間の基準価額データがありません。</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "var(--color-mute)", fontSize: 11 }} minTickGap={28} />
              <YAxis
                tick={{ fill: "var(--color-mute)", fontSize: 11 }}
                width={42}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-panel-2)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  color: "var(--color-paper)",
                }}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return Number.isFinite(n) ? n.toFixed(1) : "—";
                }}
              />
              <Legend />
              {funds.map((fund, index) => (
                <Line
                  key={fund.isin}
                  type="monotone"
                  dataKey={fund.isin}
                  name={fund.short}
                  stroke={STROKES[index] ?? "var(--color-brass)"}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {model.stats.map((stat) => (
          <li key={stat.isin} className="rounded-xl border border-line bg-panel px-3 py-3">
            <p className="text-sm font-medium">{stat.name}</p>
            <p className={"mt-1 text-lg tabular-nums " + toneClass(stat.change)}>
              {formatPct(stat.change)}
            </p>
            <p className="text-xs text-mute">
              {stat.start ?? "—"} → {stat.end ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function termForRange(from: string, to: string): TermFlag {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days <= 32) return "1";
  if (days <= 95) return "3";
  if (days <= 190) return "6";
  if (days <= 380) return "12";
  if (days <= 1100) return "36";
  if (days <= 1900) return "60";
  return "120";
}

function buildChart(
  series: { isin: string; name: string; points: NavPoint[] }[],
  funds: FundQuote[],
  range: { from: string; to: string } | null,
) {
  const filtered = series.map((item) => ({
    ...item,
    points: item.points.filter((point) => !range || (point.date >= range.from && point.date <= range.to)),
  }));
  const dates = [...new Set(filtered.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const rows = dates.map((date) => {
    const row: Record<string, string | number | null> = { date: date.slice(2) };
    for (const item of filtered) {
      const point = item.points.find((candidate) => candidate.date === date);
      const base = item.points[0]?.value;
      row[item.isin] = point && base ? (point.value / base) * 100 : null;
    }
    return row;
  });
  const stats = funds.map((fund) => {
    const points = filtered.find((item) => item.isin === fund.isin)?.points ?? [];
    const first = points[0];
    const last = points[points.length - 1];
    const change = first && last ? (last.value / first.value - 1) * 100 : null;
    return {
      isin: fund.isin,
      name: fund.short,
      change,
      start: first?.date ?? null,
      end: last?.date ?? null,
    };
  });
  return { rows, stats };
}
