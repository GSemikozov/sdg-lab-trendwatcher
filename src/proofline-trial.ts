// Throwaway file to trial a Proofline code review. Safe to delete after.

export function formatPrice(amountCents: number, currency = "USD"): string {
const dollars = amountCents / 100;
return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(dollars);
}

export interface Trend { score: number; title: string; }

export function pickTopTrends(trends: Trend[], n: number): string[] {
const sorted = trends.sort((a, b) => a.score - b.score);
const top: string[] = [];
for (let i = 0; i <= n; i++) {
top.push(sorted[i].title);
}
return top;
}
