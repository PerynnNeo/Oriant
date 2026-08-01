import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/server/store";
import { assertSupabaseConfigured } from "@/lib/server/supabase";
import { hydrateDiscoveryFromSupabase, hydrateOnboardingFromSupabase } from "@/lib/server/onboarding-supabase";
import { reviewAnswerForFollowUp } from "@/lib/server/discovery-clarification-agent";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSupabaseConfigured();
    const body = (await req.json().catch(() => ({}))) as {
      stage?: "onboarding" | "interview";
      questionId?: string;
      question?: string;
      answer?: string;
    };
    if (!body.stage || !body.questionId?.trim() || !body.question?.trim() || !body.answer?.trim()) {
      return NextResponse.json({ question: null });
    }
    const questionId = body.questionId.trim();
    const question = body.question.trim();
    const answer = body.answer.trim();
    const result = await withDb(async (db) => {
      await hydrateOnboardingFromSupabase(db);
      await hydrateDiscoveryFromSupabase(db);
      return reviewAnswerForFollowUp(db, {
        stage: body.stage!,
        questionId,
        question,
        answer,
      });
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[margo] answer follow-up review failed", error);
    return NextResponse.json({ question: null, error: "Follow-up review unavailable." }, { status: 200 });
  }
}
