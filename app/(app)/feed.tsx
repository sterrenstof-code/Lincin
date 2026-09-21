import { DesktopFeed } from "@/components/lincin/desktop/DesktopFeed";
import { DesktopMagazine } from "@/components/lincin/desktop/DesktopMagazine";
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
 * Op desktop bestaat modern nog niet als eigen vorm; daar valt hij terug
 * op `DesktopFeed`, net als kleur. 2.2 is een ronde voor de telefoon.
 */
export default function FeedScreen() {
  usePageTitle("Feed");
  const { theme } = useLincinTheme();
  const desktop = useIsDesktop();
  if (desktop) return theme === "magazine" ? <DesktopMagazine /> : <DesktopFeed />;
  if (theme === "magazine") return <FeedMagazine />;
  if (theme === "modern") return <FeedModern />;
  return <FeedKleur />;
}
