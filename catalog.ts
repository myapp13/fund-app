export type CatalogEntry = {
  isin: string;
  short: string;
  tier: "core" | "more";
};

/** Popular funds sold at SBI Securities. ISINs are stable association identifiers. */
export const CATALOG: CatalogEntry[] = [
  { isin: "JP90C000H1T1", short: "オルカン", tier: "core" },
  { isin: "JP90C000GKC6", short: "Slim S&P500", tier: "core" },
  { isin: "JP90C000ENC5", short: "Slim 先進国株", tier: "core" },
  { isin: "JP90C000F7H5", short: "Slim 新興国株", tier: "core" },
  { isin: "JP90C000ENA9", short: "Slim TOPIX", tier: "core" },
  { isin: "JP90C000FXV1", short: "Slim 日経225", tier: "core" },
  { isin: "JP90C000EWV6", short: "Slim 8資産", tier: "core" },
  { isin: "JP90C000J569", short: "SBI・V・S&P500", tier: "core" },
  { isin: "JP90C000LY16", short: "SBI・V・全米", tier: "core" },
  { isin: "JP90C000MWH8", short: "SBI・V・全世界", tier: "core" },
  { isin: "JP90C000FQR3", short: "SBI 全世界", tier: "core" },
  { isin: "JP90C000FHD2", short: "楽天・全米", tier: "core" },
  { isin: "JP90C000FHC4", short: "楽天・全世界", tier: "core" },
  { isin: "JP90C0009VE0", short: "ニッセイ外国株", tier: "core" },
  { isin: "JP90C000G631", short: "Slim 除く日本", tier: "more" },
  { isin: "JP90C000G7W3", short: "Slim 3地域均等", tier: "more" },
  { isin: "JP90C000PZY9", short: "Slim 全米", tier: "more" },
  { isin: "JP90C000R9Z9", short: "Slim オール先進国", tier: "more" },
  { isin: "JP90C000END3", short: "Slim 先進国債券", tier: "more" },
  { isin: "JP90C000ENB7", short: "Slim 国内債券", tier: "more" },
  { isin: "JP90C000JD31", short: "Slim 先進国REIT", tier: "more" },
  { isin: "JP90C000JD23", short: "Slim 国内REIT", tier: "more" },
  { isin: "JP90C000LY24", short: "SBI・V・米国高配当", tier: "more" },
  { isin: "JP90C000GMR0", short: "楽天バランス均等", tier: "more" },
  { isin: "JP90C000CMK4", short: "たわら先進国株", tier: "more" },
  { isin: "JP90C000L9D2", short: "eMAXIS NASDAQ100", tier: "more" },
  { isin: "JP90C000GUN2", short: "iFreeNEXT NASDAQ100", tier: "more" },
  { isin: "JP90C0008CH5", short: "ひふみプラス", tier: "more" },
];

export const CATALOG_ISINS = CATALOG.map((c) => c.isin);

export const DEFAULT_SELECTED = ["JP90C000H1T1", "JP90C000GKC6", "JP90C000J569"];

const byIsin = new Map(CATALOG.map((c) => [c.isin, c]));

export function catalogOf(isin: string): CatalogEntry | undefined {
  return byIsin.get(isin);
}

export const SBI_SELLER_ID = "21256";

export const KIND_LABEL: Record<string, string> = {
  stock: "株式",
  bond: "債券",
  reit: "REIT",
  balance: "バランス",
  other: "その他",
};

export const RETURN_META: { key: "m1" | "m3" | "m6" | "y1" | "y3" | "y5"; label: string; years: number }[] = [
  { key: "m1", label: "1ヶ月", years: 1 / 12 },
  { key: "m3", label: "3ヶ月", years: 0.25 },
  { key: "m6", label: "6ヶ月", years: 0.5 },
  { key: "y1", label: "1年", years: 1 },
  { key: "y3", label: "3年", years: 3 },
  { key: "y5", label: "5年", years: 5 },
];
