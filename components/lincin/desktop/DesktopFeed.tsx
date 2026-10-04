import { useMemo } from "react";

import { useThemeSpec, type Hue } from "@/lib/design/theme";
import type { CardPost } from "@/lib/lincin/model";

import { useFeed, type Feed } from "../feed/useFeed";
import { DesktopFeedMagazine } from "./DesktopFeedMagazine";
import { DesktopFeedModern } from "./DesktopFeedModern";

/**
 * De feed op desktop (handoff 23 sep). Elk thema tekent zijn eigen feed —
 * `DesktopFeedMagazine` en `DesktopFeedModern` — maar ze lezen dezelfde
 * bijdragen (`useFeed`) en dezelfde editie (`useEdition` hieronder).
 */

export function DesktopFeed() {
  const f = useFeed();
  const spec = useThemeSpec();
  const ed = useEdition(f);
  if (spec.id === "magazine") return <DesktopFeedMagazine f={f} ed={ed} />;
  return <DesktopFeedModern f={f} ed={ed} />;
}

// ---------------------------------------------------------------
// De editie: wat er op de voorpagina staat
// ---------------------------------------------------------------

export type Tile = CardPost & { hue: Hue; isNew: boolean };

export function useEdition(f: Feed) {
  const { byTime, groups, seen, isMine, heroPost } = f;
  return useMemo(() => {
    const hueOf = new Map(groups.map((g) => [g.key, g.hue]));
    const tiles: Tile[] = byTime.map((c) => ({
      ...c,
      hue: c.swatch ?? hueOf.get(c.authorId) ?? "orange",
      isNew: !seen.has(c.id),
    }));
    // De omslag: dezelfde keuze als op de telefoon (`heroPost` in useFeed):
    // de eerste foto die je nog niet zag, vastgezet voor dit bezoek.
    const hero = tiles.find((p) => p.id === heroPost?.id) ?? null;
    // Wat je zelf het laatste etmaal plaatste staat bovenaan, vóór het
    // nieuws van je vrienden: wie iets plaatst en naar de feed gaat, wil
    // het daar meteen zien. Ouder werk van jezelf zakt naar de rest.
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const mineNow = tiles.filter((p) => isMine(p.authorId) && Date.parse(p.createdAt) >= since && p !== hero);
    const unread = tiles.filter((p) => p.isNew && p !== hero && !mineNow.includes(p));
    const alsoNew = [...mineNow, ...unread];
    const rest = tiles.filter((p) => !p.isNew && p !== hero && !mineNow.includes(p));
    const friends = new Set(tiles.filter((p) => !isMine(p.authorId)).map((p) => p.authorId)).size;
    const newCount = tiles.filter((p) => p.isNew).length;
    return { hero, alsoNew, rest, friends, newCount, total: tiles.length };
  }, [byTime, groups, seen, isMine, heroPost]);
}

export type EditionData = ReturnType<typeof useEdition>;
