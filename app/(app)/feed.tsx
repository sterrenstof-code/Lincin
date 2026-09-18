import { DesktopFeed } from "@/components/lincin/desktop/DesktopFeed";
import { DesktopMagazine } from "@/components/lincin/desktop/DesktopMagazine";
import { FeedKleur } from "@/components/lincin/feed/FeedKleur";
import { FeedMagazine } from "@/components/lincin/feed/FeedMagazine";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";

/**
 * De feed (HANDOFF §Themes, implementatiehint): één scherm, twee
 * lay-outs. Welke, bepaalt het thema van de gebruiker. Beide lezen
 * dezelfde bijdragen en vrienden (`components/lincin/feed/useFeed.ts`).
 */
export default function FeedScreen() {
  usePageTitle("Feed");
  const { theme } = useLincinTheme();
  const desktop = useIsDesktop();
  if (desktop) return theme === "magazine" ? <DesktopMagazine /> : <DesktopFeed />;
  if (theme === "magazine") return <FeedMagazine />;
  return <FeedKleur />;
}
