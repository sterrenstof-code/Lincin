import type { Ionicons } from "@expo/vector-icons";

/**
 * Wat je kunt delen — één lijst, op één plek.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN EIGEN BESTAND IS
 * ---------------------------------------------------------------
 * Deze lijst stond twee keer: als soortenkiezer in stap één van het
 * deelscherm, en als snelmenu onder de zwevende plusknop. Twee lijsten die
 * hetzelfde moeten zeggen lopen altijd een keer uiteen, en dat was ook
 * gebeurd — het snelmenu had vier ingangen waarvan er één naar "fragment"
 * wees, een soort die uit de kiezer verdwenen was. Je kreeg dus twee
 * verschillende antwoorden op dezelfde vraag, afhankelijk van welke plus je
 * toevallig aantikte.
 *
 * Nu is er één bron. Wie hier een soort toevoegt of weghaalt, verandert
 * beide schermen tegelijk; ze kúnnen niet meer verschillen.
 *
 * De volgorde is die van het deelscherm en is niet willekeurig: eerst de
 * drie die om een URL vragen (link, video, muziek), dan de drie die om iets
 * van jezelf vragen (notitie, foto, idee).
 */

export type ShareKind = "link" | "video" | "music" | "note" | "image" | "idea";

export type ShareKindSpec = {
  id: ShareKind;
  /** Zoals hij in de kiezer staat: één woord. */
  label: string;
  /** De regel eronder in de kiezer. */
  hint: string;
  /**
   * Zoals hij in het snelmenu staat. Daar ontbreekt de uitleg-regel, dus
   * moet het label zelf volledig zijn: "Een link" leest daar beter dan
   * "Link", dat als kop prima werkt maar als menu-item kaal aanvoelt.
   */
  menuLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const SHARE_KINDS: ShareKindSpec[] = [
  {
    id: "link",
    label: "Link",
    hint: "Artikel, site, repo",
    menuLabel: "Een link",
    icon: "link-outline",
  },
  {
    id: "video",
    label: "Video",
    hint: "YouTube, Vimeo",
    menuLabel: "Een video",
    icon: "play-outline",
  },
  {
    id: "music",
    label: "Muziek",
    hint: "Spotify, Bandcamp, SoundCloud",
    menuLabel: "Muziek",
    icon: "musical-notes-outline",
  },
  {
    id: "note",
    label: "Notitie",
    hint: "Een gedachte, een passage, iets dat je las",
    menuLabel: "Een notitie",
    icon: "create-outline",
  },
  {
    id: "image",
    label: "Foto",
    hint: "Uit je bibliotheek of camera",
    menuLabel: "Foto's",
    icon: "images-outline",
  },
  {
    id: "idea",
    label: "Idee",
    hint: "Iets om te maken of te bouwen",
    menuLabel: "Een idee",
    icon: "bulb-outline",
  },
];
