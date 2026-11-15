import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Search, X } from "lucide-react";
import { KIND_LABEL, RETURN_META, catalogOf } from "@/lib/funds/catalog";
import { searchFundsFn } from "@/lib/funds/api";
import {
  annualize,
  formatAum,
  formatFee,
  formatNav,
  formatPct,
  formatSignedNav,
  toneClass,
} from "@/lib/funds/format";
import type { AssetKind, FundQuote, ReturnKey } from "@/lib/funds/types";

type FilterId = "all" | "core" | AssetKind;
type SortId = ReturnKey | "fee" | "aum";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "core", label: "定番" },
  { id: "stock", label: "株式" },
  { id: "bond", label: "債券" },
  { id: "balance", label: "バランス" },
  { id: "reit", label: "REIT" },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: "y5", label: "5年" },
  { id: "y3", label: "3年" },
  { id: "y1", label: "1年" },
  { id: "m6", label: "6ヶ月" },
  { id: "m3", label: "3ヶ月" },
  { id: "m1", label: "1ヶ月" },
  { id: "fee", label: "信託報酬が低い" },
  { id: "aum", label: "純資産が大きい" },
];

const SERIES = ["bg-s1", "bg-s2", "bg-s3", "bg-s4"];

export function ComparePanel({
  quotes,
  selected,
  shortLoading,
  onToggle,
  onRemove,
  onAdd,
}: {
  quotes: FundQuote[];
  selected: string[];
  shortLoading: boolean;
  onToggle: (isin: string) => void;
  onRemove: (isin: string) => void;
  onAdd: (quote: FundQuote) => void;
}) {
  const [filter, setFilter] = useState<FilterId>("core");
  const [sort, setSort] = useState<SortId>("y5");
  const [annual, setAnnual] = useState(false);
  const [q, setQ] = useState("");
  const search = useMutation({
    mutationFn: (query: string) => searchFundsFn({ data: { q: query } }),
  });

  const visible = quotes
    .filter((quote) => {
      if (filter === "all") return true;
      if (filter === "core") return catalogOf(quote.isin)?.tier === "core";
      return quote.kind === filter;
    })
    .slice()
    .sort((a, b) => compareQuotes(a, b, sort, annual));

  const picked = selected
    .map((isin) => quotes.find((quote) => quote.isin === isin))
    .filter((quote): quote is FundQuote => Boolean(quote));

  const barKey: ReturnKey = sort === "fee" || sort === "aum" ? "y5" : sort;
  const barMeta = RETURN_META.find((item) => item.key === barKey) ?? RETURN_META[5];

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const query = q.trim();
          if (query.length >= 2) search.mutate(query);
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">ファンドを検索</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="オルカン、S&P500、債券…"
            className="h-11 w-full rounded-xl border border-line bg-panel pr-3 pl-10 text-sm text-paper outline-none placeholder:text-mute focus:border-brass"
          />
        </label>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-brass px-4 text-sm font-medium text-brass-ink disabled:opacity-50"
          disabled={search.isPending}
        >
          {search.isPending ? "検索中" : "検索"}
        </button>
      </form>

      {search.data ? (
        <div className="rounded-2xl border border-line bg-panel p-3">
          <p className="mb-2 text-xs text-mute">
            SBI証券の取扱から {search.data.quotes.length} 件
            {search.data.error ? ` · ${search.data.error}` : ""}
          </p>
          <ul className="flex flex-col gap-2">
            {search.data.quotes.map((quote) => {
              const onBoard = quotes.some((item) => item.isin === quote.isin);
              return (
                <li key={quote.isin} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{quote.short}</p>
                    <p className="truncate text-xs text-mute">{quote.name}</p>
                  </div>
                  <button
                    type="button"
                    className="h-10 shrink-0 rounded-lg border border-line px-3 text-xs text-paper disabled:text-mute"
                    disabled={onBoard}
                    onClick={() => onAdd(quote)}
                  >
                    {onBoard ? "追加済み" : "比較に追加"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={
              "h-10 rounded-full border px-3 text-sm " +
              (filter === item.id
                ? "border-brass bg-brass text-brass-ink"
                : "border-line bg-panel text-paper")
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-mute">
          並べ替え
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortId)}
            className="h-10 rounded-lg border border-line bg-panel px-2 text-sm text-paper"
          >
            {SORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setAnnual((value) => !value)}
          className={
            "h-10 rounded-lg border px-3 text-sm " +
            (annual ? "border-brass text-brass" : "border-line text-mute")
          }
        >
          {annual ? "年率で表示中" : "累積で表示中"}
        </button>
      </div>

      {picked.length >= 2 && barMeta ? (
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="font-display text-lg text-paper">
            選択中の{barMeta.label}
            {annual ? "年率" : "騰落率"}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {picked.map((quote, index) => {
              const raw = quote.returns[barKey];
              const value = annual ? annualize(raw, barMeta.years) : raw;
              const width = barWidth(picked.map((item) => displayReturn(item, barKey, annual, barMeta.years)), value);
              return (
                <li key={quote.isin}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{quote.short}</span>
                    <span className={"tabular-nums " + toneClass(value)}>{formatPct(value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                    <div className={"h-full rounded-full " + (SERIES[index] ?? "bg-brass")} style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-mute">カードを選ぶと、最大4本まで推移グラフと積立シミュレーションで比べられます。</p>
      )}

      <ul className="flex flex-col gap-3">
        {visible.map((quote) => (
          <li key={quote.isin}>
            <FundCard
              quote={quote}
              selected={selected.includes(quote.isin)}
              shortLoading={shortLoading}
              annual={annual}
              extra={!catalogOf(quote.isin)}
              onToggle={() => onToggle(quote.isin)}
              onRemove={() => onRemove(quote.isin)}
            />
          </li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="text-sm text-mute">この条件のファンドはありません。</p> : null}
    </div>
  );
}

function displayReturn(quote: FundQuote, key: ReturnKey, annual: boolean, years: number): number | null {
  const raw = quote.returns[key];
  return annual ? annualize(raw, years) : raw;
}

function barWidth(values: (number | null)[], value: number | null): number {
  const max = Math.max(...values.map((item) => Math.abs(item ?? 0)), 0.01);
  if (value == null) return 0;
  return Math.max(4, Math.round((Math.abs(value) / max) * 100));
}

function compareQuotes(a: FundQuote, b: FundQuote, sort: SortId, annual: boolean): number {
  if (sort === "fee") return (a.trustFeeInTax ?? 99) - (b.trustFeeInTax ?? 99);
  if (sort === "aum") return (b.netAssetsMillion ?? 0) - (a.netAssetsMillion ?? 0);
  const meta = RETURN_META.find((item) => item.key === sort);
  const years = meta?.years ?? 1;
  const av = annual ? annualize(a.returns[sort], years) : a.returns[sort];
  const bv = annual ? annualize(b.returns[sort], years) : b.returns[sort];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return bv - av;
}

function FundCard({
  quote,
  selected,
  shortLoading,
  annual,
  extra,
  onToggle,
  onRemove,
}: {
  quote: FundQuote;
  selected: boolean;
  shortLoading: boolean;
  annual: boolean;
  extra: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={
        "relative rounded-2xl border bg-panel p-4 " + (selected ? "border-brass" : "border-line")
      }
    >
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-pressed={selected}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                "inline-flex size-5 items-center justify-center rounded border text-xs " +
                (selected ? "border-brass bg-brass text-brass-ink" : "border-line text-transparent")
              }
              aria-hidden
            >
              ✓
            </span>
            <h3 className="font-display text-xl leading-tight">{quote.short}</h3>
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-mute">
              {KIND_LABEL[quote.kind]}
            </span>
            {quote.nisaTsumitate ? (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-brass">つみたて</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-mute">{quote.name}</p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-medium tabular-nums">{formatNav(quote.nav)}</span>
            <span className={"text-sm tabular-nums " + toneClass(quote.navChangePct)}>
              {formatSignedNav(quote.navChange)} ({formatPct(quote.navChangePct)})
            </span>
          </p>
          <p className="mt-2 text-sm text-mute">
            信託報酬 <span className="text-paper tabular-nums">{formatFee(quote.trustFeeInTax)}</span>
            <span className="text-xs"> 税込</span>
            <span className="mx-2 text-line">/</span>
            税抜 {formatFee(quote.trustFeeExTax)}
            <span className="mx-2 text-line">/</span>
            純資産 {formatAum(quote.netAssetsMillion)}
          </p>
        </button>
        {extra ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-line text-mute"
            aria-label={`${quote.short}を一覧から外す`}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {RETURN_META.map((meta) => {
          const raw = quote.returns[meta.key];
          const pending = shortLoading && (meta.key === "m1" || meta.key === "m3") && raw == null;
          const value = annual ? annualize(raw, meta.years) : raw;
          return (
            <div key={meta.key} className="rounded-lg bg-panel-2 px-2 py-2">
              <p className="text-xs text-mute">{meta.label}</p>
              <p className={"text-sm font-medium tabular-nums " + toneClass(value)}>
                {pending ? <RefreshCw className="size-3.5 animate-spin" /> : formatPct(value)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-mute">{quote.company}</p>
    </article>
  );
}
