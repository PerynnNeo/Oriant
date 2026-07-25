/**
 * contact-config.ts — demo-request destination resolution (marketing
 * hardening spec §7). Configuration order:
 *
 *   1. NEXT_PUBLIC_DEMO_BOOKING_URL  → open the booking page (new tab).
 *   2. NEXT_PUBLIC_DEMO_CONTACT_EMAIL → mailto with a prefilled subject.
 *   3. hello@oriant.ai                → safe production fallback so the
 *                                       primary button is never dead.
 *
 * NEXT_PUBLIC_ values are inlined at build time, so this is callable from
 * client components without a provider round-trip.
 */

export type DemoContactAction =
  | { kind: "booking"; href: string }
  | { kind: "email"; href: string; email: string };

const FALLBACK_EMAIL = "hello@oriant.ai";

export function demoContactAction(): DemoContactAction {
  const booking = (process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ?? "").trim();
  if (/^https?:\/\//i.test(booking)) {
    return { kind: "booking", href: booking };
  }

  const email =
    (process.env.NEXT_PUBLIC_DEMO_CONTACT_EMAIL ?? "").trim() || FALLBACK_EMAIL;
  const subject = encodeURIComponent("Oriant.ai guided demo request");
  const body = encodeURIComponent(
    [
      "Hi Oriant team,",
      "",
      "We would like a guided demo of Oriant.ai.",
      "",
      "Company:",
      "Team size:",
      "What we want to improve:",
      "",
    ].join("\n"),
  );
  return {
    kind: "email",
    email,
    href: `mailto:${email}?subject=${subject}&body=${body}`,
  };
}
