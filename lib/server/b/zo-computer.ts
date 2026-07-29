/**
 * lib/server/b/zo-computer.ts — adapter boundary for Zo Computer
 * (workflow / tool-integration composition). No SDK, API key or docs were
 * available when this pipeline was built, so this is a stub: it passes the
 * OpenAI-drafted workflow definition through unchanged and tags it
 * `composedBy: "zo-computer-stub"`. Swap the body of `composeWorkflow` for a
 * real Zo Computer call later — nothing else in the Executor Agent needs to
 * change, same as the existing aiand/doubleword provider adapters.
 */
import type { WorkflowDefinitionPayload } from "./types";

export function zoComputerLive(): boolean {
  return !!process.env.ZO_COMPUTER_API_KEY;
}

export async function composeWorkflow(
  draft: WorkflowDefinitionPayload,
): Promise<WorkflowDefinitionPayload> {
  if (!zoComputerLive()) {
    return { ...draft, composedBy: "zo-computer-stub" };
  }
  // TODO: once Zo Computer's API/SDK is available, call it here to compose
  // the final tool-integration wiring for `draft`, then return the result
  // tagged `composedBy: "zo-computer-stub"` -> change to a real tag once wired.
  return { ...draft, composedBy: "zo-computer-stub" };
}
