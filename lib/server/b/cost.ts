/**
 * lib/server/b/cost.ts — shared cost math (item 7). $4 USD per 1,000,000
 * tokens, applied two ways:
 *
 * - realCostUsd(): real usage.total_tokens from an actual OpenAI call.
 *   Always exact, never estimated.
 * - monthlyProjectedTokens(): a projection built from the blueprint's own
 *   process frequency data (estimatedRunsPerPeriod/period) times an assumed
 *   tokens-per-run. This is a placeholder assumption pending real execution
 *   telemetry from the deployment layer — documented, not hidden.
 */
import type { ProcessSummary } from "./contracts";

export const USD_PER_MILLION_TOKENS = 4;

/**
 * Assumed tokens consumed per single real run of an agent workflow
 * (prompt + context + structured output). No production runs exist yet to
 * measure this from, so it's a documented placeholder — replace with a
 * rolling average of real per-run token usage once the deployment layer
 * (Person C) reports it.
 */
export const ASSUMED_TOKENS_PER_RUN = 1500;

/** No process frequency data at all: assume a conservative minimum. */
const FALLBACK_RUNS_PER_MONTH = 4;

export function tokensToUsd(tokens: number): number {
  return (tokens / 1_000_000) * USD_PER_MILLION_TOKENS;
}

function runsPerMonth(process: ProcessSummary): number {
  const runs = process.estimatedRunsPerPeriod;
  if (runs == null) return FALLBACK_RUNS_PER_MONTH;
  switch (process.period) {
    case "day":
      return runs * 30;
    case "week":
      return runs * 4.345;
    case "year":
      return runs / 12;
    case "month":
    default:
      return runs;
  }
}

/** Projected monthly token volume for one agent, from the processes that drove its selection. */
export function monthlyProjectedTokens(processes: ProcessSummary[]): number {
  return processes.reduce((sum, p) => sum + runsPerMonth(p) * ASSUMED_TOKENS_PER_RUN, 0);
}
