import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/b/http";
import { getDefaultOrganizationId } from "@/lib/server/b/supabase";
import { getLatestHandoffRow, getExistingPlanForHandoff } from "@/lib/server/b/planner";

/**
 * The current workforce_plans row for an organization, or null.
 *
 * "Current" = the latest-version plan tied to the organization's latest
 * role_b_handoffs row -- NOT simply the highest `version` number across
 * every workforce_plans row for the org. Different blueprint handoffs each
 * start their own plan at version 1 and increment independently, so
 * comparing raw version numbers across different handoffs is meaningless
 * (an old blueprint's plan re-approved a few times could outrank a newer
 * blueprint's fresh plan). Scoping through the latest handoff first
 * mirrors the idempotency check generateWorkforcePlan() already does.
 */
export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get("organizationId") ?? undefined;
  return handle(async () => {
    const orgId = organizationId ?? (await getDefaultOrganizationId());
    const handoffRow = await getLatestHandoffRow(orgId);
    if (!handoffRow) return { plan: null };
    const plan = await getExistingPlanForHandoff(handoffRow.id);
    return { plan: plan ?? null };
  });
}
