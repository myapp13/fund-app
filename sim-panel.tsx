import { useMemo, useState } from "react";
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
import { RETURN_META } from "@/lib/funds/catalog";
import { annualize, formatPct, formatYen, monthlyRate, simulate, toneClass } from "@/lib/funds/format";
import type { FundQuote, ReturnKey } from "@/lib/funds/types";

const BASES: { id: Exclude<ReturnKey, "m1" | "m3">; label: string }[] = [
  { id: "m6", label: "6ヶ月" },
  { id: "y1", label: "1年" },
  { id: "y3", label: "3年" },
  { id: "y5", label: "5年" },
];

const STROKES = ["var(--color-s1)", "var(--color-s2)", "var(--color-s3)", "var(--color-s4)"];
const CHIPS = [10000, 30000, 50000, 100000];

export function SimPanel({ funds }: { funds: FundQuote[] }) {
  const [monthly, setMonthly] = useState(30000);
  const [initial, setInitial] = useState(0);
  const [years, setYears] = useState(20);
  const [basis, setBasis] = useState<Exclude<ReturnKey, "m1" | "m3">>("y5");

  const meta = RETURN_META.find((item) => item.key === basis) ?? RETURN_META[5];

  const model = useMemo(() => {
    const rows: Record<string, number | string>[] = [];
    const summaries = funds.map((fund) => {
      const cum = fund.returns[basis];
      const rate = monthlyRate(cum, meta?.years ?? 5);
      const ann = annualize(cum, meta?.years ?? 5);
      if (rate == null || !meta) {
        return { fund, cum, ann, rate, final: null as number | null, gain: null as number | null, points: [] };
      }
      const points = simulate({ monthly, initial, years, rate });
      const last = points[points.length - 1];
      return {
        fund,
        cum,
        ann,
        rate,
        final: last?.value ?? null,
        gain: last ? last.value - last.contrib : null,
        points,
      };
    });
    const longest = summaries.reduce((max, item) => Math.max(max, item.points.length), 0);
    for (let i = 0; i < longest; i += 1) {
      const month = summaries.find((item) => item.points[i])?.points[i]?.month ?? i;
      if (years > 15 && month % 3 !== 0 && i !== longest - 1) continue;
      const row: Record<string, number | string> = {
        label: month % 12 === 0 ? `${month / 12}年` : "",
        contrib: summaries.find((item) => item.points[i])?.points[i]?.contrib ?? initial,
      };
      for (const item of summaries) {
        const point = item.points[i];
        if (point) row[item.fund.isin] = Math.round(point.value);
      }
      rows.push(row);
    }
    const contributed = initial + monthly * years * 12;
    return { summaries, rows, contributed };
  }, [funds, monthly, initial, years, basis, meta]);

  if (!funds.length) {
    return <p className="text-sm text-mute">比較タブでファンドを選ぶと、その平均リターンで積立を描きます。</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-line bg-panel p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-mute">
            毎月の積立額
            <input
              type="number"
              min={0}
              max={10000000}
              step={1000}
              inputMode="numeric"
              value={monthly}
              onChange={(event) => setMonthly(clamp(Number(event.target.value), 0, 10_000_000))}
              className="mt-1 h-11 w-full rounded-lg border border-line bg-ink px-3 text-base text-paper tabular-nums"
            />
          </label>
          <label className="text-sm text-mute">
            最初に入れる金額
            <input
              type="number"
              min={0}
              max={100000000}
              step={10000}
              inputMode="numeric"
              value={initial}
              onChange={(event) => setInitial(clamp(Number(event.target.value), 0, 100_000_000))}
              className="mt-1 h-11 w-full rounded-lg border border-line bg-ink px-3 text-base text-paper tabular-nums"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIPS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setMonthly(amount)}
              className={
                "h-10 rounded-full border px-3 text-sm " +
                (monthly === amount ? "border-brass text-brass" : "border-line text-mute")
              }
            >
              {amount / 10000}万円
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm text-mute">
          運用年数 <span className="text-paper tabular-nums">{years}年</span>
          <input
            type="range"
            min={1}
            max={40}
            value={years}
            onChange={(event) => setYears(Number(event.target.value))}
            className="mt-2 w-full accent-brass"
          />
        </label>
        <div className="mt-4">
          <p className="text-sm text-mute">平均に使う過去リターン</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BASES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setBasis(item.id)}
                className={
                  "h-10 rounded-full border px-3 text-sm " +
                  (basis === item.id
                    ? "border-brass bg-brass text-brass-ink"
                    : "border-line text-paper")
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="h-80 rounded-2xl border border-line bg-panel p-2 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={model.rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "var(--color-mute)", fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fill: "var(--color-mute)", fontSize: 11 }}
              width={48}
              tickFormatter={(value) => formatAxis(Number(value))}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-panel-2)",
                border: "1px solid var(--color-line)",
                borderRadius: 12,
                color: "var(--color-paper)",
              }}
              formatter={(value, name) => [formatYen(Number(value)), name === "contrib" ? "元本" : String(name)]}
            />
            <Legend />
            <Line type="monotone" dataKey="contrib" name="元本" stroke="var(--color-mute)" dot={false} strokeDasharray="5 4" />
            {model.summaries.map((item, index) =>
              item.final == null ? null : (
                <Line
                  key={item.fund.isin}
                  type="monotone"
                  dataKey={item.fund.isin}
                  name={item.fund.short}
                  stroke={STROKES[index] ?? "var(--color-brass)"}
                  dot={false}
                  strokeWidth={2}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-col gap-2">
        {model.summaries.map((item) => (
          <li key={item.fund.isin} className="rounded-xl border border-line bg-panel px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{item.fund.short}</p>
              <p className={"text-lg tabular-nums " + toneClass(item.gain)}>
                {item.final == null ? "データ不足" : formatYen(item.final)}
              </p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-mute">
              {meta?.label}の累積 {formatPct(item.cum)} → 年率 {formatPct(item.ann)}
              {item.gain == null ? "" : ` · 元本 ${formatYen(model.contributed)} · 損益 ${formatYen(item.gain)}`}
            </p>
          </li>
        ))}
      </ul>

      <details className="rounded-xl border border-line bg-panel px-3 py-3 text-sm text-mute">
        <summary className="cursor-pointer text-paper">計算の前提</summary>
        <p className="mt-2 leading-relaxed">
          選んだ期間の累積騰落率を年率に直し、さらに月次複利に分解します。毎月末に積立額を加えてから、その月次リターンを掛けます。騰落率は分配金再投資・信託報酬控除後の協会データです。税金、売却時のコスト、途中の相場の上下は入れていません。将来の成果を約束するものではありません。
        </p>
      </details>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatAxis(value: number): string {
  if (Math.abs(value) >= 100_000_000) return `${Math.round(value / 100_000_000)}億`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 10_000)}万`;
  return String(Math.round(value));
}
