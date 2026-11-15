import { CATALOG, CATALOG_ISINS, SBI_SELLER_ID, catalogOf } from "@/lib/funds/catalog";
import { halfwidth, toFullwidth } from "@/lib/funds/format";
import type {
  AssetKind,
  BoardResult,
  FundQuote,
  FundReturns,
  FundSeries,
  NavPoint,
  SeriesResult,
  ShortResult,
  TermFlag,
} from "@/lib/funds/types";

const ORIGIN = "https://toushin-lib.fwg.ne.jp";
const SEARCH_URL = `${ORIGIN}/FdsWeb/FDST999900/fundDataSearch`;
const CHART_URL = `${ORIGIN}/FdsWeb/FDST030000/get-basis-price-chart-date`;
const UA =
  "Mozilla/5.0 (compatible; Kijundai/1.0; +https://www.toushin.or.jp/) AppleWebKit/537.36";

const TTL_MS = 15 * 60 * 1000;

type CacheEntry<T> = { at: number; data: T };

const quoteCache = new Map<string, CacheEntry<FundQuote>>();
const seriesCache = new Map<string, CacheEntry<NavPoint[]>>();
const jar = new Map<string, string>();
let warmed = false;

const KIND_MAP: Record<string, AssetKind> = {
  "1": "stock",
  "2": "bond",
  "3": "reit",
  "4": "other",
  "5": "balance",
};

function num(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function dateOnly(value: unknown): string | null {
  const text = asText(value);
  const match = text.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function absorbCookies(res: Response) {
  const list =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const cookie of list) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(): string {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("user-agent", UA);
  headers.set("accept-language", "ja,en;q=0.8");
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(25000) });
  absorbCookies(res);
  return res;
}

async function ensureSession() {
  if (warmed) return;
  const res = await request(`${ORIGIN}/FdsWeb/FDST999900?t_searchInfoFlag=1`, { method: "GET" });
  if (!res.ok) throw new Error(`協会サイトに接続できません (${res.status})`);
  await res.arrayBuffer();
  warmed = true;
}

type SearchBody = {
  keyword?: string;
  kbn?: "1" | "2";
  isins?: string[];
  sellers?: string[];
};

async function searchRows(body: SearchBody): Promise<Record<string, unknown>[]> {
  await ensureSession();
  const keyword = body.keyword ?? "";
  const kbn = body.kbn ?? "1";
  const collected: Record<string, unknown>[] = [];
  let start = 0;
  for (let page = 0; page < 6; page += 1) {
    const payload = {
      t_keyword: keyword,
      t_kensakuKbn: kbn,
      s_keyword: keyword,
      s_kensakuKbn: kbn,
      s_investAssetKindCd: [],
      s_investArea10kindCd: [],
      s_setlFqcy: [],
      s_dividend1y: [],
      s_totalNetAssets: [],
      s_nowToRedemptionDate: [],
      s_establishedDateToNow: [],
      s_dcFundCD: [],
      s_isinCd: body.isins ?? [],
      s_instCd: [],
      s_fdsInstCd: body.sellers ?? [],
      s_investArea3kindCd: [],
      t_investArea10kindCd: [],
      t_investAssetKindCd: [],
      t_instCd: [],
      t_fdsInstCd: [],
      startNo: start,
      draw: page + 1,
      searchBtnClickFlg: true,
    };
    const res = await request(SEARCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
        origin: ORIGIN,
        referer: `${ORIGIN}/FdsWeb/FDST999900`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`ファンド検索に失敗しました (${res.status})`);
    const json = (await res.json()) as {
      searchResultInfo?: { recordsTotal?: string; resultInfoMapList?: Record<string, unknown>[] };
    };
    const info = json.searchResultInfo;
    const rows = info?.resultInfoMapList ?? [];
    collected.push(...rows);
    const total = Number(info?.recordsTotal ?? collected.length);
    if (rows.length === 0 || collected.length >= total) break;
    start += rows.length;
  }
  return collected;
}

function soldAtSbi(row: Record<string, unknown>): boolean {
  const list = row.institutionInfo;
  if (!Array.isArray(list)) return false;
  return list.some((item) => {
    if (!item || typeof item !== "object") return false;
    const name = asText((item as { instName?: unknown }).instName);
    return name.includes("ＳＢＩ証券");
  });
}

function emptyReturns(): FundReturns {
  return { m1: null, m3: null, m6: null, y1: null, y3: null, y5: null };
}

function toQuote(row: Record<string, unknown>): FundQuote | null {
  const isin = asText(row.isinCd);
  const code = asText(row.associFundCd);
  if (!isin || !code) return null;
  const official = halfwidth(asText(row.fundNm) || asText(row.fundStNm));
  const nick = halfwidth(asText(row.fundNkNm));
  const catalog = catalogOf(isin);
  const feeEx = num(row.trustReward);
  return {
    isin,
    code,
    sep: asText(row.separateseparateDiv || "0"),
    name: official || nick || isin,
    short: catalog?.short || nick || official || isin,
    company: halfwidth(asText(row.entrustCmpNm)),
    kind: KIND_MAP[asText(row.investAssetKindCd)] ?? "other",
    nisaTsumitate: asText(row.nisaFlg) === "1",
    nisaGrowth: asText(row.nisaGrowthFlg) === "1",
    nav: num(row.standardPrice),
    navChange: num(row.stdCostPointFrmDayBfr),
    navChangePct: num(row.stdCostPointFrmDayBfrRt),
    asOf: dateOnly(row.standardDate),
    trustFeeExTax: feeEx,
    trustFeeInTax: feeEx == null ? null : Math.round(feeEx * 1.1 * 1e6) / 1e6,
    netAssetsMillion: num(row.totalNetAssets),
    returns: {
      ...emptyReturns(),
      m6: num(row.standardPriceRa6m),
      y1: num(row.standardPriceRa1y),
      y3: num(row.standardPriceRa3y),
      y5: num(row.standardPriceRa5y),
    },
    sbi: soldAtSbi(row),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function quotesForIsins(isins: string[], refresh: boolean): Promise<FundQuote[]> {
  const unique = [...new Set(isins)];
  const now = Date.now();
  const missing: string[] = [];
  const ready = new Map<string, FundQuote>();
  for (const isin of unique) {
    const hit = quoteCache.get(isin);
    if (!refresh && hit && now - hit.at < TTL_MS) ready.set(isin, hit.data);
    else missing.push(isin);
  }
  if (missing.length) {
    const rows: Record<string, unknown>[] = [];
    for (const group of chunk(missing, 10)) {
      rows.push(...(await searchRows({ isins: group })));
    }
    const seen = new Set<string>();
    for (const row of rows) {
      const quote = toQuote(row);
      if (!quote || seen.has(quote.isin)) continue;
      seen.add(quote.isin);
      quoteCache.set(quote.isin, { at: now, data: quote });
      ready.set(quote.isin, quote);
    }
  }
  return unique.map((isin) => ready.get(isin)).filter((q): q is FundQuote => Boolean(q));
}

function parsePoints(raw: unknown): NavPoint[] {
  if (!Array.isArray(raw)) return [];
  const points: NavPoint[] = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const date = dateOnly(item[0]);
    const value = num(item[1]);
    if (!date || value == null || value <= 0) continue;
    points.push({ date, value });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

export async function loadSeriesPoints(
  code: string,
  sep: string,
  term: TermFlag,
  refresh = false,
): Promise<NavPoint[]> {
  const key = `${code}:${sep}:${term}`;
  const now = Date.now();
  const hit = seriesCache.get(key);
  if (!refresh && hit && now - hit.at < TTL_MS) return hit.data;
  await ensureSession();
  const res = await request(CHART_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      "x-requested-with": "XMLHttpRequest",
      origin: ORIGIN,
      referer: `${ORIGIN}/FdsWeb/FDST030000`,
    },
    body: new URLSearchParams({
      termFlg: term,
      associFundCd: code,
      separateseparateDiv: sep || "0",
    }),
  });
  if (!res.ok) throw new Error(`基準価額の推移を取得できません (${res.status})`);
  const json = (await res.json()) as {
    profitDistributionData?: unknown;
    basisPriceData?: unknown;
  };
  const dist = parsePoints(json.profitDistributionData);
  const points = dist.length ? dist : parsePoints(json.basisPriceData);
  seriesCache.set(key, { at: now, data: points });
  return points;
}

function windowReturn(points: NavPoint[], months: number): number | null {
  if (points.length < 2) return null;
  const end = points[points.length - 1];
  if (!end) return null;
  if (months >= 3) {
    const start = points[0];
    if (!start || start.value <= 0) return null;
    return (end.value / start.value - 1) * 100;
  }
  const endDate = new Date(`${end.date}T00:00:00Z`);
  const target = new Date(endDate);
  target.setUTCMonth(target.getUTCMonth() - months);
  const targetIso = target.toISOString().slice(0, 10);
  let pick = points[0];
  for (const point of points) {
    if (point.date <= targetIso) pick = point;
    else break;
  }
  if (!pick || pick.value <= 0 || pick.date === end.date) return null;
  return (end.value / pick.value - 1) * 100;
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function loadBoard(input: { extraIsins: string[]; refresh: boolean }): Promise<BoardResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const isins = [...CATALOG_ISINS, ...input.extraIsins];
    const quotes = await quotesForIsins(isins, input.refresh);
    const asOf = quotes.reduce<string | null>((latest, quote) => {
      if (!quote.asOf) return latest;
      if (!latest || quote.asOf > latest) return quote.asOf;
      return latest;
    }, null);
    return { ok: quotes.length > 0, error: quotes.length ? null : "ファンドを取得できませんでした", fetchedAt, asOf, quotes };
  } catch (error) {
    const message = error instanceof Error ? error.message : "データ取得に失敗しました";
    return { ok: false, error: message, fetchedAt, asOf: null, quotes: [] };
  }
}

export async function loadShortReturns(input: {
  funds: { isin: string; code: string; sep: string }[];
  refresh: boolean;
}): Promise<ShortResult> {
  try {
    const items: ShortResult["items"] = [];
    await mapPool(input.funds.slice(0, 40), 6, async (fund) => {
      try {
        const points = await loadSeriesPoints(fund.code, fund.sep, "3", input.refresh);
        const item = { isin: fund.isin, m1: windowReturn(points, 1), m3: windowReturn(points, 3) };
        items.push(item);
        const cached = quoteCache.get(fund.isin);
        if (cached) {
          cached.data = {
            ...cached.data,
            returns: { ...cached.data.returns, m1: item.m1, m3: item.m3 },
          };
          cached.at = Date.now();
        }
      } catch {
        items.push({ isin: fund.isin, m1: null, m3: null });
      }
    });
    return { ok: true, error: null, items };
  } catch (error) {
    const message = error instanceof Error ? error.message : "短期騰落率を取得できませんでした";
    return { ok: false, error: message, items: [] };
  }
}

export async function searchFunds(input: { q: string }): Promise<BoardResult> {
  const fetchedAt = new Date().toISOString();
  const q = input.q.trim().slice(0, 80);
  if (q.length < 2) {
    return { ok: false, error: "2文字以上で検索してください", fetchedAt, asOf: null, quotes: [] };
  }
  try {
    const full = toFullwidth(q);
    let rows = await searchRows({ keyword: full, kbn: "1", sellers: [SBI_SELLER_ID] });
    if (!rows.length && full !== q) {
      rows = await searchRows({ keyword: q, kbn: "1", sellers: [SBI_SELLER_ID] });
    }
    if (!rows.length) {
      rows = await searchRows({ keyword: full, kbn: "2", sellers: [SBI_SELLER_ID] });
    }
    const quotes: FundQuote[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const quote = toQuote(row);
      if (!quote || seen.has(quote.isin) || !quote.sbi) continue;
      seen.add(quote.isin);
      quotes.push(quote);
      if (quotes.length >= 12) break;
    }
    const known = new Set(CATALOG.map((c) => c.isin));
    for (const quote of quotes) {
      if (!known.has(quote.isin)) quoteCache.set(quote.isin, { at: Date.now(), data: quote });
    }
    return {
      ok: true,
      error: quotes.length ? null : "SBI証券の取扱ファンドが見つかりません",
      fetchedAt,
      asOf: quotes.find((q) => q.asOf)?.asOf ?? null,
      quotes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return { ok: false, error: message, fetchedAt, asOf: null, quotes: [] };
  }
}

export async function loadSeries(input: {
  funds: { isin: string; code: string; sep: string; name: string }[];
  term: TermFlag;
  refresh: boolean;
}): Promise<SeriesResult> {
  try {
    const series: FundSeries[] = [];
    await mapPool(input.funds.slice(0, 4), 4, async (fund) => {
      const points = await loadSeriesPoints(fund.code, fund.sep, input.term, input.refresh);
      series.push({ isin: fund.isin, name: fund.name, points });
    });
    return { ok: true, error: null, term: input.term, series };
  } catch (error) {
    const message = error instanceof Error ? error.message : "推移データを取得できませんでした";
    return { ok: false, error: message, term: input.term, series: [] };
  }
}
