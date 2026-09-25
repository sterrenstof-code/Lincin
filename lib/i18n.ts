import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

/**
 * De taal van de bediening: NL, EN of DE.
 *
 * Alleen wat de app zélf zegt vertaalt — knoppen, titels, lege staten.
 * Wat een vriend schreef blijft in de taal waarin hij het schreef
 * (README §i18n). De woordenboeken zijn die uit `dict()` in het
 * prototype, letterlijk overgenomen.
 *
 * Bewaard onder `lincin-lang`, net als het prototype; op web synchroon
 * uit localStorage zodat het eerste beeld al in de goede taal staat.
 */

export type Lang = "nl" | "en" | "de";

const NL = {
  omCoverA: "Jouw editie", omCoverB: "van vandaag", omAndFriends: "& vrienden", omNoAlgo: "geen algoritme", omOpenPost: "Open bijdrage", omContents: "Inhoud", omEnd: "— Einde · morgen weer", omRestSeen: "Je bent bij. De rest heb je al gezien.", omPrivateTo: "Privé aan", omComments: "Comments", omFrom: "van", omVol: "Vol.", omFriendsN: "vrienden", omFriend1: "vriend",
  noNotes: "Nog geen meldingen", 
  editProfile: "Profiel bewerken", linkDevice: "Toestel koppelen", logout: "Uitloggen", groupsLabel: "Groepen", peopleYouLet: "mensen die jij toeliet", remembered: "wordt onthouden", rememberNote: "Alles wordt onthouden, ook op je andere toestellen — je thema, je taal, je weergave en welke vrienden je open of dicht had.", foldedDefault: "Vrienden standaard ingeklapt", foldedDefaultSub: "je ziet eerst de titels, klik om te openen", myPosts: "Jouw bijdragen", yourPage: "Jouw pagina", 
  dropHere: "sleep hierheen of klik — tot 6", titleLabel: "Titel", captionLabel: "Onderschrift", whoSees: "Wie ziet het", allLincs: "Al je lincs", howLincSees: "Zo ziet je linc het", share: "Delen", shareWithLincs: "Delen met je lincs", forYourLincs: "voor je lincs · geen algoritme", 
  togetherIn: "Samen in", messageTo: "Bericht aan", allPosts: "Alle bijdragen", newestFirst: "nieuwste eerst", lincPortrait: "Linc · portret", aboutTitle: "Over", fromName: "van", 
  invites: "nodigt uit", upcomingN: "komend", newEventPlus: "Nieuw event +", eventsTitle: "Events", 
  firstComment: "Nog niemand zei iets. Jij als eerste?", writeBack: "Schrijf iets terug…", 
  inThisA: "In deze", inThisB: "editie", 
  kickerFriends: "01 · Feed · per vriend · geen algoritme", kickerTime: "01 · Feed · op tijd · nieuwste eerst", restOfEdition: "Rest van de editie", alreadySeen: "al gezien", upToDateDot: "Je bent bij.", allSeenBelow: "Alles hieronder heb je al gezien.", postsFrom: "bijdragen van", newFront: "Nieuw · voorpagina", seenFront: "Voorpagina · gezien", 
  upToDate: "Je bent bij", secNew: "Nieuw", secSeen: "Gezien", allRead: "Alles gelezen", folded: "ingeklapt", markAllRead: "Markeer als gelezen", openAll: "Alles openen", closeAll: "Alles inklappen", caughtUp: "Je bent helemaal bij. Jouw beurt?", openDef: "Bijdragen staan open", openDefSub: "Banden op de feed beginnen uitgeklapt", editie: "Editie", alsoNew: "Ook nieuw", frontPage: "Voorpagina", unreadN: "ongelezen", editionEnd: "— einde van de editie · morgen weer —",
  editPost: "Bewerk", save: "Bewaar", saving: "Bewaren…", textPh: "De tekst zelf…",
  addPhoto: "foto erbij", dropMany: "sleep meerdere foto's — tot 6", pollOptions: "Keuzes", pollAdd: "Keuze erbij", pollOne: "één stem per linc", pollMulti: "meerdere keuzes", pollPh1: "Tent", pollPh2: "Geen tent, auto", pollPhN: "Nog een keuze…", landscape: "liggend", portrait: "staand", square: "vierkant", noImage: "nog geen afbeelding",
  feedA: "Wat je vrienden", feedB: "maken", perFriend: "Per vriend", byTime: "Op tijd",
  emptyKicker: "Nog niemand hier", emptyTitle: "Je feed is zo leeg als een nieuw schetsboek",
  emptyBody: "Lincin toont alleen wat je vrienden maken. Geen vrienden, geen feed — voeg er één toe en het begint.",
  scanQr: "Scan een QR-code", shareCode: "Deel mijn code", emptyCompose: "Of maak alvast je eerste bijdrage →",
  group: "groep", read: "gelezen", new: "nieuw", sayTo: "Zeg iets tegen",
  endLine: "— einde · geen algoritme, geen oneindig scrollen —", endTitle: "Niemand maakte iets nieuws. Jij wel?",
  endSub: "Je vrienden zien het als eerste.", comment: "Reactie", comments: "Reacties", privateMsg: "Bericht",
  readPost: "Post lezen", post: "Bijdrage", posts: "bijdragen", post1: "bijdrage", viewProfile: "bekijk profiel", event: "Event",
  writeComment: "Schrijf een reactie…", searchGif: "Zoek een gif… (dijk, zonsondergang, wow)", back: "Terug",
  lincSince: "linc sinds", privateChat: "Gesprek", planTogether: "Samen plannen", allFrom: "Alles van",
  chats: "Gesprekken", unread: "ongelezen", newMsg: "nieuw bericht", newMsgs: "nieuwe berichten", markRead: "Markeer als gelezen", markUnread: "Markeer als ongelezen", mentioned: "Vermeld", about: "over", typing: "schrijft…", writeTo: "Schrijf aan",
  eventsA: "Wat er", eventsB: "komt", planned: "gepland", waitsForYou: "wacht op jou", imIn: "Ik kom", maybe: "Misschien",
  listsA: "Wat jullie", listsB: "bijhouden", list: "lijst", lists: "lijsten", newList: "Nieuwe lijst", myLists: "Mijn lijsten",
  noListsYet: "Nog geen lijsten", listEmpty: "nog leeg", ofWord: "van",
  planNew: "Plan iets nieuws", draftFrom: "concept · uit", sinceMar: "sinds", yourLatest: "Jouw laatste bijdragen",
  yourColor: "Jouw kleur", yourColorSub: "alleen jij ziet dit", colorReset: "standaard", settings: "Instellingen", notifications: "Meldingen", lincsInvites: "Lincs & uitnodigingen", myQr: "Mijn QR-code", you: "Jij",
  footerNote: "Lincin 2.0 · versleuteld op je toestel", cancel: "Annuleer", newPost: "Nieuwe bijdrage",
  titlePh: "Titel — kort en groot", captionPh: "Eén zin eronder…", color: "Kleur", kind: "Soort", draft: "Klad",
  privateChatWith: "Gesprek met", sheetPh: "Schrijf iets over deze bijdrage…",
  tabFeed: "Feed", tabChats: "Gesprekken", tabEvents: "Events", tabYou: "Jij", scrThread: "Gesprek", scrProfile: "Profiel",
  pull: "↓ trek om te vernieuwen", refreshing: "Vernieuwen…",
  today: "Vandaag", yesterday: "Gisteren", thisWeek: "Deze week", earlier: "Eerder", now: "nu",
  publish: "Deel met je vrienden", published: "Gedeeld ✓", mention: "Bijdrage vermelden", mentioned2: "Vermeld ✓",
  votes: "stemmen · tik om te stemmen", lookTitle: "Hoe het eruitziet", lightDark: "Licht of donker",
  followsDevice: "Volgt je toestel", light: "licht", dark: "donker", tint: "Blad kleurt mee",
  tintSub: "Achtergrond neemt de kleur van de vriend in beeld", language: "Taal", languageSub: "Nederlands · English · Deutsch",
  notifTitle: "Meldingen", newPosts: "Nieuwe bijdragen", newPostsSub: "Eén melding per vriend per dag",
  quiet: "Stil tussen 23:00 en 08:00", quietSub: "Berichten komen wel binnen", whoTitle: "Wie ziet wat",
  visible: "Lincs zien mijn bijdragen", visibleSub: "Alleen wie je toevoegde", myLincs: "Mijn lincs", friends: "vrienden",
  gifNote: "gif", reply: "Antwoord", loading: "Laden…", failed: "Kon niet laden", retry: "Opnieuw",
  andWord: "en", othersWord: "anderen", otherWord: "ander", noFriendsYet: "Nog geen lincs", nothingNew: "Nog niets van je vrienden", me: "Jij",
  theme: "Thema", themeSub: "Kleur · Magazine · Modern", themeKleur: "Kleur", themeMagazine: "Magazine", themeModern: "Modern",
  edition: "Editie", editionA: "In deze", editionB: "editie", spotA: "Op", spotB: "spotlight", privateShort: "Bericht",
  noAlgo: "geen algoritme · alleen vrienden",
  device: "toestel", profileOf: "Profiel van", panelNote: "een gesprek opent op volle breedte", on: "aan", off: "uit",
};

const EN: typeof NL = {
  omCoverA: "Your edition", omCoverB: "of today", omAndFriends: "& friends", omNoAlgo: "no algorithm", omOpenPost: "Open post", omContents: "Contents", omEnd: "— The end · more tomorrow", omRestSeen: "You're up to date. You've seen the rest.", omPrivateTo: "Private to", omComments: "Comments", omFrom: "from", omVol: "Vol.", omFriendsN: "friends", omFriend1: "friend",
  noNotes: "No notifications yet", 
  editProfile: "Edit profile", linkDevice: "Link a device", logout: "Log out", groupsLabel: "Groups", peopleYouLet: "people you let in", remembered: "remembered", rememberNote: "Everything is remembered, on your other devices too — your theme, your language, your view and which friends you had open.", foldedDefault: "Friends folded by default", foldedDefaultSub: "you see the titles first, click to open", myPosts: "Your posts", yourPage: "Your page", 
  dropHere: "drop here or click — up to 6", titleLabel: "Title", captionLabel: "Caption", whoSees: "Who sees it", allLincs: "All your lincs", howLincSees: "How your linc sees it", share: "Share", shareWithLincs: "Share with your lincs", forYourLincs: "for your lincs · no algorithm", 
  togetherIn: "Together in", messageTo: "Message", allPosts: "All posts", newestFirst: "newest first", lincPortrait: "Linc · portrait", aboutTitle: "About", fromName: "by", 
  invites: "invites you", upcomingN: "upcoming", newEventPlus: "New event +", eventsTitle: "Events", 
  firstComment: "Nobody said anything yet. You first?", writeBack: "Write something back…", 
  inThisA: "In this", inThisB: "edition", 
  kickerFriends: "01 · Feed · by friend · no algorithm", kickerTime: "01 · Feed · by time · newest first", restOfEdition: "Rest of the edition", alreadySeen: "already seen", upToDateDot: "You're up to date.", allSeenBelow: "You've seen everything below.", postsFrom: "posts from", newFront: "New · front page", seenFront: "Front page · seen", 
  upToDate: "You're up to date", secNew: "New", secSeen: "Seen", allRead: "All read", folded: "folded", markAllRead: "Mark as read", openAll: "Open all", closeAll: "Fold all", caughtUp: "You're all caught up. Your turn?", openDef: "Posts start open", openDefSub: "Friend bands on the feed begin expanded", editie: "Edition", alsoNew: "Also new", frontPage: "Front page", unreadN: "unread", editionEnd: "— end of the edition · more tomorrow —",
  editPost: "Edit", save: "Save", saving: "Saving…", textPh: "The text itself…",
  addPhoto: "add photo", dropMany: "drop several photos — up to 6", pollOptions: "Choices", pollAdd: "Add choice", pollOne: "one vote per linc", pollMulti: "multiple choices", pollPh1: "Tent", pollPh2: "No tent, car", pollPhN: "Another choice…", landscape: "landscape", portrait: "portrait", square: "square", noImage: "no image yet",
  feedA: "What your friends", feedB: "make", perFriend: "By friend", byTime: "By time",
  emptyKicker: "Nobody here yet", emptyTitle: "Your feed is as empty as a new sketchbook",
  emptyBody: "Lincin only shows what your friends make. No friends, no feed — add one and it starts.",
  scanQr: "Scan a QR code", shareCode: "Share my code", emptyCompose: "Or make your first post now →",
  group: "group", read: "read", new: "new", sayTo: "Say something to",
  endLine: "— the end · no algorithm, no infinite scroll —", endTitle: "Nobody made anything new. Did you?",
  endSub: "Your friends see it first.", comment: "Comment", comments: "Comments", privateMsg: "Message",
  readPost: "Read post", post: "Post", posts: "posts", post1: "post", viewProfile: "view profile", event: "Event",
  writeComment: "Write a comment…", searchGif: "Search a gif… (dyke, sunset, wow)", back: "Back",
  lincSince: "linc since", privateChat: "Chat", planTogether: "Plan together", allFrom: "Everything from",
  chats: "Chats", unread: "unread", newMsg: "new message", newMsgs: "new messages", markRead: "Mark as read", markUnread: "Mark as unread", mentioned: "Mentioned", about: "about", typing: "is typing…", writeTo: "Write to",
  eventsA: "What's", eventsB: "coming", planned: "planned", waitsForYou: "waits for you", imIn: "I'm in", maybe: "Maybe",
  listsA: "What you", listsB: "keep", list: "list", lists: "lists", newList: "New list", myLists: "My lists",
  noListsYet: "No lists yet", listEmpty: "still empty", ofWord: "of",
  planNew: "Plan something new", draftFrom: "draft · from", sinceMar: "since", yourLatest: "Your latest posts",
  yourColor: "Your colour", yourColorSub: "only you see this", colorReset: "default", settings: "Settings", notifications: "Notifications", lincsInvites: "Lincs & invites", myQr: "My QR code", you: "You",
  footerNote: "Lincin 2.0 · encrypted on your device", cancel: "Cancel", newPost: "New post",
  titlePh: "Title — short and loud", captionPh: "One line below…", color: "Colour", kind: "Kind", draft: "Draft",
  privateChatWith: "Chat with", sheetPh: "Write something about this post…",
  tabFeed: "Feed", tabChats: "Chats", tabEvents: "Events", tabYou: "You", scrThread: "Chat", scrProfile: "Profile",
  pull: "↓ pull to refresh", refreshing: "Refreshing…",
  today: "Today", yesterday: "Yesterday", thisWeek: "This week", earlier: "Earlier", now: "now",
  publish: "Share with your friends", published: "Shared ✓", mention: "Mention post", mentioned2: "Mentioned ✓",
  votes: "votes · tap to vote", lookTitle: "Appearance", lightDark: "Light or dark",
  followsDevice: "Follows your device", light: "light", dark: "dark", tint: "Page takes the colour",
  tintSub: "Background tints with the friend in view", language: "Language", languageSub: "Nederlands · English · Deutsch",
  notifTitle: "Notifications", newPosts: "New posts", newPostsSub: "One notification per friend per day",
  quiet: "Quiet between 23:00 and 08:00", quietSub: "Messages still arrive", whoTitle: "Who sees what",
  visible: "Lincs see my posts", visibleSub: "Only people you added", myLincs: "My lincs", friends: "friends",
  gifNote: "gif", reply: "Reply", loading: "Loading…", failed: "Could not load", retry: "Retry",
  andWord: "and", othersWord: "others", otherWord: "other", noFriendsYet: "No lincs yet", nothingNew: "Nothing from your friends yet", me: "You",
  theme: "Theme", themeSub: "Colour · Magazine · Modern", themeKleur: "Colour", themeMagazine: "Magazine", themeModern: "Modern",
  edition: "Edition", editionA: "In this", editionB: "edition", spotA: "On", spotB: "spotlight", privateShort: "Message",
  noAlgo: "no algorithm · friends only",
  device: "device", profileOf: "Profile of", panelNote: "a chat opens full width", on: "on", off: "off",
};

const DE: typeof NL = {
  omCoverA: "Deine Ausgabe", omCoverB: "von heute", omAndFriends: "& Freunde", omNoAlgo: "kein Algorithmus", omOpenPost: "Beitrag öffnen", omContents: "Inhalt", omEnd: "— Ende · morgen wieder", omRestSeen: "Du bist auf dem Stand. Den Rest hast du gesehen.", omPrivateTo: "Privat an", omComments: "Kommentare", omFrom: "von", omVol: "Vol.", omFriendsN: "Freunde", omFriend1: "Freund",
  noNotes: "Noch keine Meldungen", 
  editProfile: "Profil bearbeiten", linkDevice: "Gerät verbinden", logout: "Abmelden", groupsLabel: "Gruppen", peopleYouLet: "Menschen, die du zugelassen hast", remembered: "wird gespeichert", rememberNote: "Alles wird gespeichert, auch auf deinen anderen Geräten — dein Thema, deine Sprache, deine Ansicht und welche Freunde du offen hattest.", foldedDefault: "Freunde standardmäßig eingeklappt", foldedDefaultSub: "du siehst zuerst die Titel, klicke zum Öffnen", myPosts: "Deine Beiträge", yourPage: "Deine Seite", 
  dropHere: "hierher ziehen oder klicken — bis 6", titleLabel: "Titel", captionLabel: "Unterschrift", whoSees: "Wer sieht es", allLincs: "Alle deine Lincs", howLincSees: "So sieht dein Linc es", share: "Teilen", shareWithLincs: "Mit deinen Lincs teilen", forYourLincs: "für deine Lincs · kein Algorithmus", 
  togetherIn: "Zusammen in", messageTo: "Nachricht an", allPosts: "Alle Beiträge", newestFirst: "neueste zuerst", lincPortrait: "Linc · Porträt", aboutTitle: "Über", fromName: "von", 
  invites: "lädt ein", upcomingN: "kommend", newEventPlus: "Neues Event +", eventsTitle: "Events", 
  firstComment: "Noch hat niemand etwas gesagt. Du zuerst?", writeBack: "Schreib etwas zurück…", 
  inThisA: "In dieser", inThisB: "Ausgabe", 
  kickerFriends: "01 · Feed · nach Freund · kein Algorithmus", kickerTime: "01 · Feed · nach Zeit · neueste zuerst", restOfEdition: "Rest der Ausgabe", alreadySeen: "schon gesehen", upToDateDot: "Du bist auf dem Stand.", allSeenBelow: "Alles darunter hast du schon gesehen.", postsFrom: "Beiträge von", newFront: "Neu · Titelseite", seenFront: "Titelseite · gesehen", 
  upToDate: "Du bist auf dem Stand", secNew: "Neu", secSeen: "Gesehen", allRead: "Alles gelesen", folded: "eingeklappt", markAllRead: "Als gelesen markieren", openAll: "Alle öffnen", closeAll: "Alle einklappen", caughtUp: "Du bist auf dem Stand. Du bist dran?", openDef: "Beiträge stehen offen", openDefSub: "Bänder im Feed beginnen ausgeklappt", editie: "Ausgabe", alsoNew: "Auch neu", frontPage: "Titelseite", unreadN: "ungelesen", editionEnd: "— Ende der Ausgabe · morgen wieder —",
  editPost: "Bearbeiten", save: "Speichern", saving: "Speichern…", textPh: "Der Text selbst…",
  addPhoto: "Foto hinzufügen", dropMany: "mehrere Fotos ablegen — bis 6", pollOptions: "Auswahl", pollAdd: "Auswahl hinzufügen", pollOne: "eine Stimme pro Linc", pollMulti: "mehrere Auswahlen", pollPh1: "Zelt", pollPh2: "Kein Zelt, Auto", pollPhN: "Noch eine Auswahl…", landscape: "liegend", portrait: "stehend", square: "quadratisch", noImage: "noch kein Bild",
  feedA: "Was deine Freunde", feedB: "machen", perFriend: "Nach Freund", byTime: "Nach Zeit",
  emptyKicker: "Noch niemand hier", emptyTitle: "Dein Feed ist so leer wie ein neues Skizzenbuch",
  emptyBody: "Lincin zeigt nur, was deine Freunde machen. Keine Freunde, kein Feed — füg einen hinzu und es geht los.",
  scanQr: "QR-Code scannen", shareCode: "Meinen Code teilen", emptyCompose: "Oder mach jetzt deinen ersten Beitrag →",
  group: "Gruppe", read: "gelesen", new: "neu", sayTo: "Sag etwas zu",
  endLine: "— Ende · kein Algorithmus, kein endloses Scrollen —", endTitle: "Niemand hat etwas Neues gemacht. Du?",
  endSub: "Deine Freunde sehen es zuerst.", comment: "Kommentar", comments: "Kommentare", privateMsg: "Nachricht",
  readPost: "Beitrag lesen", post: "Beitrag", posts: "Beiträge", post1: "Beitrag", viewProfile: "Profil ansehen", event: "Event",
  writeComment: "Kommentar schreiben…", searchGif: "GIF suchen… (Deich, Sonnenuntergang, wow)", back: "Zurück",
  lincSince: "Linc seit", privateChat: "Gespräch", planTogether: "Zusammen planen", allFrom: "Alles von",
  chats: "Gespräche", unread: "ungelesen", newMsg: "neue Nachricht", newMsgs: "neue Nachrichten", markRead: "Als gelesen markieren", markUnread: "Als ungelesen markieren", mentioned: "Erwähnt", about: "über", typing: "schreibt…", writeTo: "Schreib an",
  eventsA: "Was", eventsB: "kommt", planned: "geplant", waitsForYou: "wartet auf dich", imIn: "Ich komme", maybe: "Vielleicht",
  listsA: "Was ihr", listsB: "festhaltet", list: "Liste", lists: "Listen", newList: "Neue Liste", myLists: "Meine Listen",
  noListsYet: "Noch keine Listen", listEmpty: "noch leer", ofWord: "von",
  planNew: "Etwas Neues planen", draftFrom: "Entwurf · aus", sinceMar: "seit", yourLatest: "Deine letzten Beiträge",
  yourColor: "Deine Farbe", yourColorSub: "nur du siehst das", colorReset: "Standard", settings: "Einstellungen", notifications: "Mitteilungen", lincsInvites: "Lincs & Einladungen", myQr: "Mein QR-Code", you: "Du",
  footerNote: "Lincin 2.0 · verschlüsselt auf deinem Gerät", cancel: "Abbrechen", newPost: "Neuer Beitrag",
  titlePh: "Titel — kurz und groß", captionPh: "Ein Satz darunter…", color: "Farbe", kind: "Art", draft: "Entwurf",
  privateChatWith: "Gespräch mit", sheetPh: "Schreib etwas über diesen Beitrag…",
  tabFeed: "Feed", tabChats: "Gespräche", tabEvents: "Events", tabYou: "Du", scrThread: "Gespräch", scrProfile: "Profil",
  pull: "↓ ziehen zum Aktualisieren", refreshing: "Aktualisieren…",
  today: "Heute", yesterday: "Gestern", thisWeek: "Diese Woche", earlier: "Früher", now: "jetzt",
  publish: "Mit Freunden teilen", published: "Geteilt ✓", mention: "Beitrag erwähnen", mentioned2: "Erwähnt ✓",
  votes: "Stimmen · tippen zum Abstimmen", lookTitle: "Aussehen", lightDark: "Hell oder dunkel",
  followsDevice: "Folgt deinem Gerät", light: "hell", dark: "dunkel", tint: "Seite färbt sich mit",
  tintSub: "Hintergrund nimmt die Farbe des Freundes im Bild", language: "Sprache", languageSub: "Nederlands · English · Deutsch",
  notifTitle: "Mitteilungen", newPosts: "Neue Beiträge", newPostsSub: "Eine Mitteilung pro Freund pro Tag",
  quiet: "Ruhe zwischen 23:00 und 08:00", quietSub: "Nachrichten kommen trotzdem an", whoTitle: "Wer sieht was",
  visible: "Lincs sehen meine Beiträge", visibleSub: "Nur wer du hinzugefügt hast", myLincs: "Meine Lincs", friends: "Freunde",
  gifNote: "gif", reply: "Antworten", loading: "Laden…", failed: "Konnte nicht laden", retry: "Nochmal",
  andWord: "und", othersWord: "andere", otherWord: "andere:r", noFriendsYet: "Noch keine Lincs", nothingNew: "Noch nichts von deinen Freunden", me: "Du",
  theme: "Thema", themeSub: "Farbe · Magazin · Modern", themeKleur: "Farbe", themeMagazine: "Magazin", themeModern: "Modern",
  edition: "Ausgabe", editionA: "In dieser", editionB: "Ausgabe", spotA: "Im", spotB: "Rampenlicht", privateShort: "Nachricht",
  noAlgo: "kein Algorithmus · nur Freunde",
  device: "Gerät", profileOf: "Profil von", panelNote: "ein Gespräch öffnet in voller Breite", on: "an", off: "aus",
};

export type Dict = typeof NL;

const DICTS: Record<Lang, Dict> = { nl: NL, en: EN, de: DE };

const STORAGE_KEY = "lincin-lang";

function isLang(v: unknown): v is Lang {
  return v === "nl" || v === "en" || v === "de";
}

function initial(): Lang {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isLang(raw)) return raw;
    } catch {
      // geen opslag — dan Nederlands
    }
  }
  return "nl";
}

let lang: Lang = initial();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

/** Wie wil weten dat jíj van taal wisselde (lib/lincin/prefs.ts bewaart hem). */
const choiceListeners = new Set<() => void>();

export function subscribeLang(fn: () => void) {
  choiceListeners.add(fn);
  return () => {
    choiceListeners.delete(fn);
  };
}

/** `quiet`: de taal komt uit de database en hoeft niet terug te worden geschreven. */
export function setLang(next: Lang, opts?: { quiet?: boolean }) {
  if (next === lang) return;
  lang = next;
  if (!opts?.quiet) for (const fn of choiceListeners) fn();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* zie initial() */
    }
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** De woorden van de app in de taal die nu geldt. */
export function useT(): Dict {
  const l = useLang();
  return DICTS[l];
}

export function t(): Dict {
  return DICTS[lang];
}
