import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import { lockedGateHref } from "@/lib/route-policy";

/* Marketing hardening: request-time SITE_MODE guard, defense in depth
   behind the middleware redirect. */
export const dynamic = "force-dynamic";

/**
 * Legacy holding-page route. In the public marketing deployment it lands on
 * the locked guided-demo state; in product mode (internal only) old links
 * and bookmarks still reach the interactive mock at /app/onboarding.
 */
export default function OnboardingRedirect() {
  if (isMarketingSite()) redirect(lockedGateHref("discovery"));
  redirect("/app/onboarding");
}
