import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, PiggyBank, RefreshCw, Scale } from "lucide-react";
import { ComparePanel } from "@/components/desk/compare-panel";
import { DEFAULT_SELECTED } from "@/lib/funds/catalog";
import { loadBoardFn, loadShortFn } from "@/lib/funds/api";
import { formatAsOf } from "@/lib/funds/format";
import type { BoardResult, FundQuote } from "@/lib/funds/types";

const TrendPanel = lazy(() => import("@/components/desk/trend-panel").then((mod) => ({ default: mod.TrendPanel })));
const SimPanel = lazy(() => import("@/components/desk/sim-panel").then((mod) => ({ default: mod.SimPanel })));

const STORAGE_KEY = "kijundai-v1";
type TabId = "compare" | "trend" | "sim";

type Saved = {
  selected?: string[];
  extraIsins?: string[];
};

export function DeskApp({ initial }: { initial: BoardResult }) {
  const [tab, setTab] = useState<TabId>("compare");
  const [boot, setBoot] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<FundQuote[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Saved;
      if (Array.isArray(saved.extraIsins)) setExtras(saved.extraIsins.filter((id) => typeof id === "string"));
      if (Array.isArray(saved.selected) && saved.selected.length) {
        setSelected(saved.selected.filter((id) => typeof id === "string").slice(0, 4));
      }
    } catch {
      /* ignore broken local prefs */
    }
    setBoot(true);
  }, []);

  useEffect(() => {
    if (!boot) return;
    const payload: Saved = { selected, extraIsins: extras };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [boot, selected, extras]);

  const board = useQuery({
    queryKey: ["board", extras, tick],
    enabled: boot,
    staleTime: 5 * 60 * 1000,
    initialData: extras.length === 0 && tick === 0 ? initial : undefined,
    queryFn: () => loadBoardFn({ data: { extraIsins: extras, refresh: tick > 0 } }),
  });

  const quotes = useMemo(() => {
    const fromServer = board.data?.quotes ?? [];
    const ids = new Set(fromServer.map((quote) => quote.isin));
    return [...fromServer, ...pending.filter((quote) => !ids.has(quote.isin))];
  }, [board.data, pending]);

  const short = useQuery({
    queryKey: ["short", quotes.map((quote) => quote.isin).join(","), tick],
    enabled: boot && quotes.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      loadShortFn({
        data: {
          refresh: tick > 0,
          funds: quotes.map((quote) => ({ isin: quote.isin, code: quote.code, sep: quote.sep })),
        },
      }),
  });

  const merged = useMemo(() => {
    const map = new Map((short.data?.items ?? []).map((item) => [item.isin, item]));
    return quotes.map((quote) => {
      const extra = map.get(quote.isin);
      if (!extra) return quote;
      return { ...quote, returns: { ...quote.returns, m1: extra.m1, m3: extra.m3 } };
    });
  }, [quotes, short.data]);

  const picked = selected
    .map((isin) => merged.find((quote) => quote.isin === isin))
    .filter((quote): quote is FundQuote => Boolean(quote));

  function toggle(isin: string) {
    setSelected((current) => {
      if (current.includes(isin)) return current.filter((id) => id !== isin);
      if (current.length >= 4) return current;
      return [...current, isin];
    });
  }

  function add(quote: FundQuote) {
    setPending((current) => (current.some((item) => item.isin === quote.isin) ? current : [...current, quote]));
    setExtras((current) => (current.includes(quote.isin) ? current : [...current, quote.isin]));
    setSelected((current) => {
      if (current.includes(quote.isin) || current.length >= 4) return current;
      return [...current, quote.isin];
    });
  }

  function remove(isin: string) {
    setPending((current) => current.filter((quote) => quote.isin !== isin));
    setExtras((current) => current.filter((id) => id !== isin));
    setSelected((current) => current.filter((id) => id !== isin));
  }

  const asOf = board.data?.asOf ?? initial.asOf;
  const loading = !board.data && board.isFetching;

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs tracking-widest text-brass">SBI証券で買える投資信託</p>
            <h1 className="font-display text-3xl leading-tight">基準台</h1>
          </div>
          <button
            type="button"
            onClick={() => setTick((value) => value + 1)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-paper"
          >
            <RefreshCw className={"size-4 " + (board.isFetching ? "animate-spin" : "")} />
            更新
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <p className="text-sm text-mute">
          基準日 {formatAsOf(asOf)} · 信託報酬と騰落率は投資信託協会の最新値
          {selected.length ? ` · ${selected.length}/4 本を選択中` : ""}
        </p>
        <nav className="mt-3 grid grid-cols-3 gap-2" aria-label="画面">
          <TabButton current={tab} id="compare" icon={<Scale className="size-4" />} label="比較" onSelect={setTab} />
          <TabButton current={tab} id="trend" icon={<LineChart className="size-4" />} label="推移" onSelect={setTab} />
          <TabButton current={tab} id="sim" icon={<PiggyBank className="size-4" />} label="積立" onSelect={setTab} />
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {loading ? <p className="text-sm text-mute">最新の基準価額を取得しています…</p> : null}
        {board.data && !board.data.ok ? (
          <p className="mb-3 rounded-xl border border-line bg-panel px-3 py-3 text-sm text-down">{board.data.error}</p>
        ) : null}
        {selected.length >= 4 && tab === "compare" ? (
          <p className="mb-3 text-xs text-brass">比較は4本までです。外してから追加してください。</p>
        ) : null}

        {tab === "compare" ? (
          <ComparePanel
            quotes={merged}
            selected={selected}
            shortLoading={short.isFetching}
            onToggle={toggle}
            onRemove={remove}
            onAdd={add}
          />
        ) : null}
        {tab === "trend" ? (
          <Suspense fallback={<p className="text-sm text-mute">グラフを準備しています…</p>}>
            <TrendPanel funds={picked} />
          </Suspense>
        ) : null}
        {tab === "sim" ? (
          <Suspense fallback={<p className="text-sm text-mute">シミュレーションを準備しています…</p>}>
            <SimPanel funds={picked} />
          </Suspense>
        ) : null}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-mute">
        騰落率は期間の累積（分配金再投資）で、年率ではありません。年率表示はそれを複利換算した参考値です。信託報酬の税込は協会掲載の税抜合計に消費税率10%を掛けた概算です。投資判断は交付目論見書と販売会社の情報を確認してください。これは将来の運用成果を示すものではありません。
      </footer>
    </div>
  );
}

function TabButton({
  current,
  id,
  label,
  icon,
  onSelect,
}: {
  current: TabId;
  id: TabId;
  label: string;
  icon: ReactNode;
  onSelect: (id: TabId) => void;
}) {
  const on = current === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm " +
        (on ? "border-brass bg-brass text-brass-ink" : "border-line bg-panel text-paper")
      }
    >
      {icon}
      {label}
    </button>
  );
}
