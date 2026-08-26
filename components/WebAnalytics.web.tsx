import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

/** Vercel Analytics — alleen op web. Zie WebAnalytics.tsx voor het waarom. */
export function WebAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
