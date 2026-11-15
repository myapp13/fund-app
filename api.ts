import { createServerFn } from "@tanstack/react-start";
import type { BoardResult, SeriesResult, ShortResult, TermFlag } from "@/lib/funds/types";

const ISIN = /^[A-Z0-9]{10,14}$/;
const TERMS = new Set<TermFlag>(["1", "3", "6", "12", "36", "60", "120"]);

function isinList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && ISIN.test(item)).slice(0, limit);
}

export const loadBoardFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { extraIsins?: unknown; refresh?: unknown };
    return { extraIsins: isinList(raw.extraIsins, 20), refresh: raw.refresh === true };
  })
  .handler(async ({ data }): Promise<BoardResult> => {
    const mod = await import("./toushin.server");
    return mod.loadBoard(data);
  });

export const loadShortFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { funds?: unknown; refresh?: unknown };
    const funds = Array.isArray(raw.funds) ? raw.funds : [];
    const clean = funds
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { isin?: unknown; code?: unknown; sep?: unknown };
        if (typeof row.isin !== "string" || !ISIN.test(row.isin)) return null;
        if (typeof row.code !== "string" || !/^[0-9A-Za-z]{6,12}$/.test(row.code)) return null;
        return { isin: row.isin, code: row.code, sep: typeof row.sep === "string" ? row.sep : "0" };
      })
      .filter((item): item is { isin: string; code: string; sep: string } => Boolean(item))
      .slice(0, 40);
    return { funds: clean, refresh: raw.refresh === true };
  })
  .handler(async ({ data }): Promise<ShortResult> => {
    const mod = await import("./toushin.server");
    return mod.loadShortReturns(data);
  });

export const searchFundsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { q?: unknown };
    return { q: typeof raw.q === "string" ? raw.q.slice(0, 80) : "" };
  })
  .handler(async ({ data }): Promise<BoardResult> => {
    const mod = await import("./toushin.server");
    return mod.searchFunds(data);
  });

export const loadSeriesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { funds?: unknown; term?: unknown; refresh?: unknown };
    const term: TermFlag = typeof raw.term === "string" && TERMS.has(raw.term as TermFlag) ? (raw.term as TermFlag) : "12";
    const funds = Array.isArray(raw.funds) ? raw.funds : [];
    const clean = funds
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { isin?: unknown; code?: unknown; sep?: unknown; name?: unknown };
        if (typeof row.isin !== "string" || !ISIN.test(row.isin)) return null;
        if (typeof row.code !== "string" || !/^[0-9A-Za-z]{6,12}$/.test(row.code)) return null;
        const name = typeof row.name === "string" ? row.name.slice(0, 80) : row.code;
        return { isin: row.isin, code: row.code, sep: typeof row.sep === "string" ? row.sep : "0", name };
      })
      .filter((item): item is { isin: string; code: string; sep: string; name: string } => Boolean(item))
      .slice(0, 4);
    return { funds: clean, term, refresh: raw.refresh === true };
  })
  .handler(async ({ data }): Promise<SeriesResult> => {
    const mod = await import("./toushin.server");
    return mod.loadSeries(data);
  });
