import { DesktopFeed } from "@/components/lincin/desktop/DesktopFeed";
import { FeedDesktopEcht } from "@/components/lincin/catalogus/desktop/echt";
import { useCatalogusDesktop } from "@/components/lincin/catalogus/desktop/weergave";
import { FeedCatalogus } from "@/components/lincin/catalogus/schermen/FeedCatalogus";
import { FeedMagazine } from "@/components/lincin/feed/FeedMagazine";
import { FeedModern } from "@/components/lincin/modern/FeedModern";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";

/**
 * De feed (HANDOFF §Themes, implementatiehint): één scherm, drie
 * lay-outs. Welke, bepaalt het thema van de gebruiker. Beide lezen
 * dezelfde bijdragen en vrienden (`components/lincin/feed/useFeed.ts`).
 *
 * Op DESKTOP is er sinds 2.2 één feed voor beide thema's: het
 * bento-rooster, waarvan alleen de naad en de kaartvorm het thema volgen
 * (§9).
 */
export default function FeedScreen() {
  usePageTitle("Feed");
  const { theme } = useLincinTheme();
  const desktop = useIsDesktop();
  // Catalogus op een breed scherm: de vier weergaven (components/lincin/catalogus/desktop).
  const catalogusDesktop = useCatalogusDesktop();
  if (catalogusDesktop) return <FeedDesktopEcht />;
  if (desktop) return <DesktopFeed />;
  if (theme === "magazine") return <FeedMagazine />;
  if (theme === "catalogus") return <FeedCatalogus />;
  return <FeedModern />;
}
