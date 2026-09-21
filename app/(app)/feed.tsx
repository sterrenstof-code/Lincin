import { DesktopFeed } from "@/components/lincin/desktop/DesktopFeed";
import { FeedKleur } from "@/components/lincin/feed/FeedKleur";
import { FeedMagazine } from "@/components/lincin/feed/FeedMagazine";
import { FeedModern } from "@/components/lincin/modern/FeedModern";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";

/**
 * De feed (HANDOFF §Themes, implementatiehint): één scherm, drie
 * lay-outs. Welke, bepaalt het thema van de gebruiker. Alle drie lezen
 * dezelfde bijdragen en vrienden (`components/lincin/feed/useFeed.ts`).
 *
 * Op DESKTOP is er sinds 2.2 één feed voor alle drie de thema's: het
 * bento-rooster, waarvan alleen de naad en de kaartvorm het thema volgen
 * (§9). `DesktopMagazine` — de masthead-feed uit 2.1 — staat nog in de
 * code maar heeft geen route meer; hij wacht op de vraag of hij terugkomt.
 */
export default function FeedScreen() {
  usePageTitle("Feed");
  const { theme } = useLincinTheme();
  const desktop = useIsDesktop();
  if (desktop) return <DesktopFeed />;
  if (theme === "magazine") return <FeedMagazine />;
  if (theme === "modern") return <FeedModern />;
  return <FeedKleur />;
}
