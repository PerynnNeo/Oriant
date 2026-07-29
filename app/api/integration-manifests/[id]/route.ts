import { handle } from "@/lib/server/b/http";
import { supabaseAdmin } from "@/lib/server/b/supabase";

/**
 * integration_manifests.connection_status uses the Blueprint's own
 * CurrentSystemSummary vocabulary (a DB check constraint enforces exactly
 * connected/requested/not_requested/unavailable) — map the frontend's
 * IntegrationStatus (connected/required/optional/needs_approval) onto it.
 */
function toDbStatus(status: "connected" | "required" | "optional" | "needs_approval") {
  switch (status) {
    case "connected":
      return "connected";
    case "required":
      return "requested";
    case "needs_approval":
      return "unavailable";
    default:
      return "not_requested";
  }
}

/** Update connection status — backs the ConnectWizard's "mark connected" step. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { connectionStatus } = (await req.json()) as {
    connectionStatus: "connected" | "required" | "optional" | "needs_approval";
  };
  return handle(async () => {
    const { data, error } = await supabaseAdmin()
      .from("integration_manifests")
      .update({ connection_status: toDbStatus(connectionStatus) })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Integration manifest not found");
    return { integrationManifest: data };
  });
}
