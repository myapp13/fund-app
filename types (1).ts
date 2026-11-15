export type AssetKind = "stock" | "bond" | "reit" | "balance" | "other";

export type ReturnKey = "m1" | "m3" | "m6" | "y1" | "y3" | "y5";

export type FundReturns = Record<ReturnKey, number | null>;

export type FundQuote = {
  isin: string;
  code: string;
  sep: string;
  name: string;
  short: string;
  company: string;
  kind: AssetKind;
  nisaTsumitate: boolean;
  nisaGrowth: boolean;
  nav: number | null;
  navChange: number | null;
  navChangePct: number | null;
  asOf: string | null;
  trustFeeExTax: number | null;
  trustFeeInTax: number | null;
  netAssetsMillion: number | null;
  returns: FundReturns;
  sbi: boolean;
};

export type BoardResult = {
  ok: boolean;
  error: string | null;
  fetchedAt: string;
  asOf: string | null;
  quotes: FundQuote[];
};

export type ShortReturn = { isin: string; m1: number | null; m3: number | null };

export type ShortResult = {
  ok: boolean;
  error: string | null;
  items: ShortReturn[];
};

export type NavPoint = { date: string; value: number };

export type FundSeries = {
  isin: string;
  name: string;
  points: NavPoint[];
};

export type SeriesResult = {
  ok: boolean;
  error: string | null;
  term: string;
  series: FundSeries[];
};

export type TermFlag = "1" | "3" | "6" | "12" | "36" | "60" | "120";
