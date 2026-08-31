/**
 * In welke taal een datum en een tijd geschreven worden.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN CONSTANTE IS EN GEEN STRING PER AANROEP
 * ---------------------------------------------------------------
 * Er stond elf keer `"nl-NL"` en zeven keer `"nl-BE"`, en op twee plekken in
 * het gesprek stond `toLocaleTimeString([], …)`. Die laatste is de ergste:
 * een lege array betekent "neem de taal van het besturingssysteem", en op
 * een toestel dat op Engels staat leverde dat `3:45 PM` op — midden tussen
 * Nederlandse datums, in dezelfde bubbel nog wel. Twee berichten onder
 * elkaar in twee klokstelsels.
 *
 * De keuze zelf mag niet per bestand gemaakt worden, want dan wordt het
 * telkens opnieuw geraden. `nl-BE` en niet `nl-NL`: de app schrijft Vlaams,
 * de agenda en de eventkaarten stonden er al op, en het is de tijdzone waar
 * deze kring in leeft. Voor datums verschillen de twee in de praktijk
 * nauwelijks — dat is precies waarom het uiteen kon lopen zonder dat iemand
 * het zag, en waarom het hier hoort te staan en niet daar.
 */
export const NL = "nl-BE";
