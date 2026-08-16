/**
 * LangGraph orchestration for Discovery.
 *
 * This is intentionally a thin first migration. Supabase remains the source
 * of truth and the existing generators remain responsible for provider calls,
 * JSON validation, and workflow-specific fallback behavior. LangGraph owns
 * the next-step decision so the interview and clarification flows can grow
 * into resumable state machines without changing the handoff contract.
 */
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { Db } from "../contracts";
import {
  generateDiscoveryInterviewQuestions,
} from "./discovery-interview-agent";
import { generateDiscoveryClarifications } from "./discovery-clarification-agent";

export type DiscoveryGraphOperation = "interview" | "clarifications";

type DiscoveryGraphOutput =
  | { operation: "interview"; result: Awaited<ReturnType<typeof generateDiscoveryInterviewQuestions>> }
  | { operation: "clarifications"; result: Awaited<ReturnType<typeof generateDiscoveryClarifications>> };

const DiscoveryState = Annotation.Root({
  db: Annotation<Db>(),
  operation: Annotation<DiscoveryGraphOperation>(),
  output: Annotation<DiscoveryGraphOutput | null>({
    reducer: (_previous, next) => next,
    default: () => null,
  }),
});

const graph = new StateGraph(DiscoveryState)
  .addNode("generateInterview", async (state) => ({
    output: {
      operation: "interview" as const,
      result: await generateDiscoveryInterviewQuestions(state.db),
    },
  }))
  .addNode("reviewClarifications", async (state) => ({
    output: {
      operation: "clarifications" as const,
      result: await generateDiscoveryClarifications(state.db),
    },
  }))
  .addConditionalEdges(START, (state) =>
    state.operation === "interview" ? "generateInterview" : "reviewClarifications",
  )
  .addEdge("generateInterview", END)
  .addEdge("reviewClarifications", END)
  .compile();

export async function runDiscoveryGraph(
  db: Db,
  operation: DiscoveryGraphOperation,
): Promise<DiscoveryGraphOutput["result"]> {
  const result = await graph.invoke({ db, operation, output: null });
  if (!result.output || result.output.operation !== operation) {
    throw new Error(`Discovery graph did not complete the ${operation} operation.`);
  }
  return result.output.result;
}

/**
 * Feature flag for the migration. Legacy orchestration remains the default so
 * existing deployments are unchanged until the graph path is verified.
 */
export function discoveryGraphEnabled(): boolean {
  return process.env.DISCOVERY_ENGINE === "langgraph";
}
