import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/b/http";
import { supabaseAdmin, getDefaultOrganizationId } from "@/lib/server/b/supabase";

/** Integration manifests for an organization (backs the Integrations tab). */
export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get("organizationId") ?? undefined;
  return handle(async () => {
    const orgId = organizationId ?? (await getDefaultOrganizationId());
    const { data, error } = await supabaseAdmin()
      .from("integration_manifests")
      .select("*")
      .eq("organization_id", orgId)
      .order("system_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { integrationManifests: data ?? [] };
  });
}
