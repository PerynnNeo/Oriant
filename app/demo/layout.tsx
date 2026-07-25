import { Bricolage_Grotesque, Instrument_Sans, Space_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import { lockedGateHref } from "@/lib/route-policy";

/* Marketing hardening: request-time SITE_MODE guard, defense in depth
   behind the middleware redirect. */
export const dynamic = "force-dynamic";

// Margo demo app fonts — loaded only on /demo routes.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
  style: ["normal", "italic"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-space-mono",
});

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (isMarketingSite()) redirect(lockedGateHref("operations"));
  return (
    <div className={`${bricolage.variable} ${instrumentSans.variable} ${spaceMono.variable}`}>
      {children}
    </div>
  );
}
