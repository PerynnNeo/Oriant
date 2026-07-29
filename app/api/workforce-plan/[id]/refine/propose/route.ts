import { handle } from "@/lib/server/b/http";
import { proposeRefinement } from "@/lib/server/b/refine";

/** Propose a reviewable diff from a natural-language instruction. Never applies anything. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { instruction } = (await req.json()) as { instruction?: string };
  return handle(async () => {
    if (!instruction || !instruction.trim()) throw new Error("instruction is required");
    const { diff, mode } = await proposeRefinement(id, instruction);
    return { diff, mode };
  });
}
