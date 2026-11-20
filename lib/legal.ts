/**
 * Privacybeleid en voorwaarden (nov 2026). Wie verantwoordelijk is staat op
 * één plek, `VERANTWOORDELIJKE`; de teksten zelf hieronder. Verandert er iets
 * wezenlijks, pas dan ook `BIJGEWERKT` aan.
 */
export const VERANTWOORDELIJKE = {
  naam: "Tom Coysman",
  adres: "Berlijn, Duitsland",
  email: "contact@lincin.com",
};

export const BIJGEWERKT = "20 november 2026";

export type LegalSection = { kop: string; tekst: string[] };

export const PRIVACY: LegalSection[] = [
  {
    kop: "Wie",
    tekst: [
      `Lincin wordt gemaakt door ${VERANTWOORDELIJKE.naam}, ${VERANTWOORDELIJKE.adres}. Dat is de verwerkingsverantwoordelijke in de zin van de AVG. Vragen of verzoeken over je gegevens: ${VERANTWOORDELIJKE.email}.`,
    ],
  },
  {
    kop: "Wat we bewaren, en waarom",
    tekst: [
      "Je account: e-mailadres, wachtwoord (alleen als onleesbare hash), naam, gebruikersnaam, kleur, en wat je zelf aan je profiel toevoegt (foto, bio, links). Nodig om Lincin te laten werken (uitvoering van de overeenkomst).",
      "Wat je deelt: bijdragen, foto's, video's, reacties, peilingen, lijsten, events en hartjes. Alleen zichtbaar voor de mensen die jij toelaat (je lincs, of de leden van een gesprek of event).",
      "Berichten zijn end-to-end versleuteld: de server bewaart ze, maar kan ze niet lezen. Je privésleutel staat op je toestel; als je een herstelcode of passkey instelt, bewaren we een kopie die alleen met die code of passkey te openen is.",
      "Wanneer je laatst actief was, alleen zichtbaar voor je lincs en wie met je in een gesprek zit.",
      "Een pushtoken per toestel, als je meldingen aanzet.",
      "Contacten zoeken: je toestel stuurt geen adressen, alleen een vingerafdruk (SHA-256-hash) van elk e-mailadres; we bewaren die niet.",
      "Je geboortejaar vragen we om te controleren dat je 16 of ouder bent. Het jaar zelf bewaren we niet, alleen dat het in orde was.",
      "Bugmeldingen en meldingen van ongepaste inhoud die je zelf instuurt.",
    ],
  },
  {
    kop: "Wie er verder bij komt",
    tekst: [
      "Supabase (database, opslag en inloggen; servers in Ierland, EU).",
      "Vercel (hosting van de website). Vercel Analytics telt paginabezoeken zonder cookies en zonder je te volgen; welke pagina, niet wie.",
      "8x8 (JaaS) voor videobellen, alleen als je belt.",
      "Apple, Google, Mozilla en Expo voor het afleveren van pushmeldingen.",
      "Een e-maildienst voor bevestigings- en uitnodigingsmails.",
      "Lettertypes en scripts komen van onze eigen server, niet van derden. We verkopen niets aan niemand en tonen geen advertenties.",
    ],
  },
  {
    kop: "Hoe lang",
    tekst: [
      "Zolang je account bestaat. Verwijder je je account (Profiel bewerken → Account verwijderen), dan wissen we meteen je profiel, bijdragen, reacties, berichten, bestanden en sleutels. Gesprekken blijven voor de anderen bestaan, zonder jouw berichten.",
    ],
  },
  {
    kop: "Je rechten",
    tekst: [
      "Je mag je gegevens inzien, laten verbeteren, laten wissen of meenemen, en bezwaar maken. Mail ons daarvoor. Ben je niet tevreden over hoe we ermee omgaan, dan kun je klagen bij de toezichthouder in je eigen land, of bij ons bevoegde: de Berliner Beauftragte für Datenschutz und Informationsfreiheit.",
    ],
  },
  {
    kop: "Leeftijd",
    tekst: ["Lincin is er vanaf 16 jaar. Merken we dat een account van iemand jonger is, dan verwijderen we het."],
  },
];

export const VOORWAARDEN: LegalSection[] = [
  {
    kop: "Wat Lincin is",
    tekst: [
      `Een tijdschrift van je vrienden: je deelt bijdragen met de mensen die jij toelaat. Lincin wordt gemaakt door ${VERANTWOORDELIJKE.naam} (${VERANTWOORDELIJKE.email}). Lincin is gratis; er zijn geen abonnementen of betalingen.`,
    ],
  },
  {
    kop: "Je account",
    tekst: [
      "Je moet 16 jaar of ouder zijn. Je geeft juiste gegevens op en houdt je wachtwoord, herstelcode en passkey voor jezelf. Verlies je je sleutel én je herstelcode, dan kunnen ook wij je oude berichten niet terughalen.",
    ],
  },
  {
    kop: "Wat je deelt",
    tekst: [
      "Wat je deelt blijft van jou. Je geeft ons alleen toestemming het op te slaan en te tonen aan de mensen die jij kiest, zolang het op Lincin staat.",
      "Je deelt alleen wat je zelf mag delen: geen werk van anderen zonder toestemming, niets onwettigs, geen naaktbeelden van anderen, geen beelden van minderjarigen die hen schaden, geen intimidatie, haat of geweld, geen spam.",
      `Zie je iets dat niet hoort, meld het: bij een reactie via het menu, en anders via ${VERANTWOORDELIJKE.email}. We kunnen inhoud verwijderen en accounts blokkeren die deze regels breken. Ben je het niet eens met zo'n beslissing, mail ons.`,
    ],
  },
  {
    kop: "Wat we beloven, en wat niet",
    tekst: [
      "We doen ons best om Lincin veilig en beschikbaar te houden, maar kunnen niet beloven dat het nooit stilvalt of dat er nooit iets verloren gaat. Voor zover de wet het toelaat zijn we niet aansprakelijk voor indirecte schade.",
    ],
  },
  {
    kop: "Stoppen",
    tekst: [
      "Je kunt altijd stoppen door je account te verwijderen (Profiel bewerken → Account verwijderen). Veranderen deze voorwaarden wezenlijk, dan laten we het je in de app weten.",
      "Op deze voorwaarden is het Duitse recht van toepassing, onverminderd de dwingende bescherming die het recht van je eigen land je als consument geeft.",
    ],
  },
];
