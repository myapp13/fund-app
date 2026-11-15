import type { ReturnKey } from "@/lib/funds/types";

export function halfwidth(input: string): string {
  return input
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toFullwidth(input: string): string {
  return input
    .replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0))
    .replace(/ /g, "　");
}

export function formatNav(value: number | null): string {
  if (value == null) return "—";
  const rounded = Math.round(value * 100) / 100;
  const frac = Math.abs(rounded - Math.round(rounded)) > 0.001;
  return (
    new Intl.NumberFormat("ja-JP", {
      minimumFractionDigits: frac ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(rounded) + "円"
  );
}

export function formatSignedNav(value: number | null): string {
  if (value == null) return "—";
  const body = formatNav(Math.abs(value)).replace("円", "");
  if (value > 0) return `+${body}円`;
  if (value < 0) return `-${body}円`;
  return `${body}円`;
}

export function formatPct(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatFee(value: number | null): string {
  if (value == null) return "—";
  const text = value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}%`;
}

export function formatAum(millionYen: number | null): string {
  if (millionYen == null) return "—";
  const yen = millionYen * 1_000_000;
  if (yen >= 1e12) return `${(yen / 1e12).toFixed(2)}兆円`;
  if (yen >= 1e8) return `${Math.round(yen / 1e8).toLocaleString("ja-JP")}億円`;
  return `${Math.round(yen / 1e4).toLocaleString("ja-JP")}万円`;
}

export function formatAsOf(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

export function formatYen(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(Math.round(value))}円`;
}

export function toneClass(value: number | null): string {
  if (value == null || value === 0) return "text-mute";
  return value > 0 ? "text-up" : "text-down";
}

export function annualize(cumPct: number | null, years: number): number | null {
  if (cumPct == null || !(years > 0)) return null;
  const growth = 1 + cumPct / 100;
  if (!(growth > 0)) return null;
  return (Math.pow(growth, 1 / years) - 1) * 100;
}

export function monthlyRate(cumPct: number | null, years: number): number | null {
  const ann = annualize(cumPct, years);
  if (ann == null) return null;
  return Math.pow(1 + ann / 100, 1 / 12) - 1;
}

export type SimPoint = { month: number; value: number; contrib: number };

export function simulate(opts: {
  monthly: number;
  initial: number;
  years: number;
  rate: number;
}): SimPoint[] {
  const months = Math.max(1, Math.round(opts.years * 12));
  const points: SimPoint[] = [{ month: 0, value: opts.initial, contrib: opts.initial }];
  let value = opts.initial;
  let contrib = opts.initial;
  for (let month = 1; month <= months; month += 1) {
    value = (value + opts.monthly) * (1 + opts.rate);
    contrib += opts.monthly;
    points.push({ month, value, contrib });
  }
  return points;
}

export const BASIS_YEARS: Record<Exclude<ReturnKey, "m1" | "m3">, number> = {
  m6: 0.5,
  y1: 1,
  y3: 3,
  y5: 5,
};
