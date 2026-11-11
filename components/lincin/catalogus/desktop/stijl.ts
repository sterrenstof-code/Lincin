import { CATALOGUS } from "@/lib/design/theme";

/**
 * Catalogus op desktop (design_handoff_lincin_3e/desktop): het stijlblad.
 *
 * Eén blad voor alle desktoponderdelen, op het kader `.cd`. De maten, de
 * overgangen en hun verloop komen uit het prototype (briefing §5 en §6); de
 * kleuren zijn de hex uit tokens.json (`CATALOGUS`), als variabelen per stand.
 *
 * Dit is CSS en geen stijlprop omdat de weergaven `:hover`, `filter`,
 * keyframes en `prefers-reduced-motion` nodig hebben, met precies de duur en
 * het verloop van de briefing. Alleen op web (zie `useCatalogusDesktop`).
 */

const L = CATALOGUS.light;
const D = CATALOGUS.dark;

/** Na Archivo Latijn de systeemletter, zoals in het prototype (`Archivo, system-ui`). */
export const FAMILIE = "'Archivo Latijn', system-ui, sans-serif";

/** De breedte van het paneel. */
export const PANEEL = 440;

/** Het verloop van de foto en de wand, en van het paneel (briefing §5). */
export const VERLOOP_FOTO = "cubic-bezier(.2,.8,.2,1)";
export const VERLOOP_PANEEL = "cubic-bezier(.3,.7,.25,1)";

export const CSS = `
.cd{--g:${L.vlak};--seam:${L.naad};--card:${L.kaart};--k:${L.inkt};--onk:${L.tekstOpInkt};--dim:${L.label};--two:${L.tekstTweede};--ph:${L.plaatshouder};--acc:${L.accent};--gevaar:${L.gevaar};--table:#141210}
.cd[data-stand=donker]{--g:${D.vlak};--seam:${D.naad};--card:${D.kaart};--k:${D.inkt};--onk:${D.tekstOpInkt};--dim:${D.label};--two:${D.tekstTweede};--ph:${D.plaatshouder};--gevaar:${D.gevaar};--table:#000000}
.cd{position:relative;width:100%;height:100vh;display:flex;flex-direction:column;overflow:hidden;background:var(--seam);color:var(--k);font-family:${FAMILIE};font-size:15px;line-height:normal;text-align:left;-webkit-font-smoothing:auto}
.cd *,.cd *::before,.cd *::after{box-sizing:border-box}
/* Alleen de bovenbalk, boven een pagina zonder desktopvorm (KolomKop); het menu mag eronder uitsteken. */
.cd.kolomkop{height:auto;flex:none;overflow:visible;z-index:20}
.cd a{color:inherit;text-decoration:none;cursor:pointer}
.cd button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
.cd input{font:inherit;color:inherit;margin:0;border-radius:0;outline:none}
.cd input::placeholder{color:var(--two);opacity:1}
.cd a:focus-visible,.cd button:focus-visible,.cd input:focus-visible,.cd [tabindex]:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}
.cd img{display:block}
/* Het open stuk: geen focusring om zijn oude plek. */
.cd .has-open [data-meet="stuk"][aria-current]:focus-visible{outline:none}
.cd .app{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.cd .S{font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;line-height:1.7}
.cd .dim{color:var(--dim)}
.cd .T{font-weight:300;letter-spacing:-.04em;line-height:.92}
.cd .spec{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:12px;font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;line-height:1.7}
.cd .spec>span:nth-child(odd){color:var(--dim)}
.cd .spec>span:nth-child(even){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cd .spec.wit>span:nth-child(odd){color:inherit}
.cd .pic{display:block;position:relative;flex:none;overflow:hidden;background:var(--ph)}
.cd .pic>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cd .pic>.ding{position:absolute;left:0;top:0;transform-origin:0 0}
.cd .pic>.album{position:absolute;left:6px;top:6px;z-index:1;display:flex;align-items:center;gap:3px;padding:3px 5px 3px 4px;background:rgba(20,18,16,.38);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:rgba(255,255,255,.92);font-size:9px;font-weight:500;line-height:1;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.cd .kleine-acties{display:flex;gap:14px}
.cd .kleine-acties button{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;min-height:28px}
.cd .sq{flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;color:#141210;overflow:hidden}
.cd .sq>img{width:100%;height:100%;object-fit:cover}
.cd .strip{height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 16px;background:var(--g)}
.cd .ib{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px}
.cd .btn{height:44px;padding:0 16px;display:inline-flex;align-items:center;gap:8px;background:var(--k);color:var(--onk)}
.cd .btn.ghost{background:none;color:var(--k);border:1px solid var(--k)}
.cd .link{text-decoration:underline;text-underline-offset:3px}
.cd .act{height:44px;min-width:44px;padding:0 8px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600}
.cd .act svg{transition:transform .18s}
.cd .act:active svg{transform:scale(1.3)}
.cd .dot{width:7px;height:7px;background:var(--acc);flex:none}
.cd .grid{display:grid;gap:2px;flex:1;min-height:0}
.cd .scroll{overflow:auto;min-height:0}
.cd .main{min-height:0;min-width:0;display:flex;flex-direction:column;gap:2px;position:relative;flex:1}
.cd .tile{background:var(--g);padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;min-height:0;min-width:0;transition:background .15s}
.cd .tile:hover{background:color-mix(in srgb,var(--card) 55%,var(--g))}
.cd .tile .obj{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
.cd .tile[aria-current]{background:var(--card);outline:2px solid var(--k);outline-offset:-2px}

/* de bovenbalk */
.cd .top{height:56px;flex:none;display:flex;align-items:center;gap:28px;padding:0 8px 0 16px;background:var(--g);border-bottom:2px solid var(--seam)}
.cd .top.helder{background:transparent;border-color:transparent}
.cd .top nav{display:flex;gap:20px;margin-left:12px}
.cd .top nav a{height:44px;display:flex;align-items:center;gap:6px;padding:0 4px;font-weight:500;border-bottom:2px solid transparent}
.cd .top nav a[aria-current]{font-weight:600;border-bottom-color:currentColor}

/* het paneel */
.cd .panel{background:var(--card);color:var(--k);display:flex;flex-direction:column;min-height:0;height:100%}
.cd .cm{display:flex;gap:10px;padding:10px 20px 2px;cursor:pointer;position:relative}
/* Een antwoord: ingesprongen tot onder de tekst van zijn reactie, met een lijn in het vlak die het eraan hangt. */
.cd .cm.antwoord{padding-left:68px;padding-top:4px}
.cd .cm.antwoord::before{content:"";position:absolute;left:33px;top:0;bottom:0;width:2px;background:var(--g)}
.cd .field{flex:1;height:44px;border:1px solid var(--k);background:var(--card);padding:0 12px}
.cd label>.field{flex:none}
.cd textarea.field{height:auto;min-height:96px;padding:10px 12px;line-height:1.5;resize:vertical;font:inherit;color:inherit;border-radius:0;outline:none}
.cd .drawer{position:fixed;top:0;right:0;bottom:0;width:${PANEEL}px;z-index:40;box-shadow:-30px 0 60px rgba(20,18,16,.18);animation:cd-slide .42s ${VERLOOP_PANEEL}}
.cd .drawer.weg{animation:none;transform:translateX(100%);transition:transform .36s ${VERLOOP_PANEEL}}
.cd .scrim{position:fixed;left:0;top:0;bottom:0;right:${PANEEL}px;z-index:39;cursor:pointer;background:none;border:0}
@keyframes cd-slide{from{transform:translateX(100%)}to{transform:none}}
@keyframes cd-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.cd .rise{animation:cd-rise .35s ${VERLOOP_FOTO}}

/* een @naam in een reactie: vet, en onderstreept onder de muis */
.cd .naam{font-weight:600}
.cd .naam:hover{text-decoration:underline;text-underline-offset:3px}

.cd .naarprofiel{display:inline-flex}
.cd .naarprofiel:hover{text-decoration:underline;text-underline-offset:3px}
.cd .naarprofiel.beeld{flex:none;align-self:flex-start}
.cd .naarprofiel.beeld:hover{outline:2px solid var(--k);outline-offset:1px}

/* naar de pagina van de bijdrage: de titel in het paneel en de open foto */
.cd .naarpagina,.cd .naarlink{cursor:pointer}
.cd .naarlink:hover{text-decoration:underline;text-underline-offset:4px}
.cd .naarpagina:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px}
.cd .scrim.opfoto{cursor:zoom-in}.cd .scrim.oplink{cursor:pointer}

/* een tekst als artikel (de bijdragepagina) */
.cd .artikel{width:100%;max-width:680px;padding:24px 0 40px;color:var(--k)}
.cd .artikel header{display:flex;flex-direction:column;gap:20px;padding-bottom:36px;margin-bottom:40px;border-bottom:2px solid var(--seam)}
.cd .artikel h1{margin:0;font-size:clamp(48px,5.2vw,80px);overflow-wrap:break-word;text-wrap:balance}
.cd .artikel .inleiding{margin:0;font-size:23px;line-height:1.4;color:var(--two);text-wrap:pretty}
.cd .artikel .lijf p{margin:0;font-size:20px;line-height:1.65;text-indent:1.6em;hyphens:auto;-webkit-hyphens:auto;text-wrap:pretty;overflow-wrap:break-word}
.cd .artikel .lijf p.eerste,.cd .artikel .lijf p.na-wit{text-indent:0}
.cd .artikel .lijf p.na-wit{margin-top:1.65em}
.cd .artikel .lijf p.eerste::first-letter{initial-letter:2;-webkit-initial-letter:2;font-weight:300;margin-right:.12em}
.cd .artikel .slot{display:inline-block;width:.42em;height:.42em;margin-left:.4em;background:var(--k);vertical-align:.08em}

/* het menu van je eigen bijdrage (⋯ in het paneel) */
.cd .eigenmenu{position:absolute;right:6px;top:52px;width:260px;z-index:3;background:var(--card);color:var(--k);box-shadow:0 24px 60px rgba(20,18,16,.28);display:flex;flex-direction:column}
.cd .eigenmenu button{min-height:52px;padding:0 16px;text-align:left;border-top:2px solid var(--g)}
.cd .eigenmenu button:first-child{border-top:0}
.cd .eigenmenu button:hover{background:var(--g)}
.cd .bewerk{padding:18px 20px}

/* wand */
.cd .wall{flex:1;min-height:0;background:var(--g);overflow:hidden;position:relative}
.cd .track{position:relative;display:flex;align-items:flex-start;gap:84px;padding:6vh 90px 0;width:max-content;transition:transform .7s ${VERLOOP_FOTO};will-change:transform}
.cd .track.live{transition:none}
.cd .hang{flex:none;display:flex;flex-direction:column;transition:opacity .45s,filter .45s}
.cd .hang .up{height:58vh;display:flex;flex-direction:column;justify-content:flex-end;gap:10px}
.cd .hang .pic{transition:transform .3s ${VERLOOP_FOTO},box-shadow .3s}
.cd .wall:not(.has-open) .hang:hover .pic{transform:translateY(-8px);box-shadow:0 24px 40px rgba(20,18,16,.18)}
.cd .hang .floor{height:2px;background:var(--seam);margin:28px -42px 0}
.cd .wall.has-open .hang:not([aria-current]){opacity:.14;filter:saturate(.3)}
.cd .wall.has-open .hang[aria-current]{position:relative;z-index:2}
.cd .wall.has-open .hang[aria-current] .pic{box-shadow:0 34px 70px rgba(20,18,16,.3);transition:transform .7s ${VERLOOP_FOTO},box-shadow .5s}
.cd .hang.terug .pic{transition:transform .7s ${VERLOOP_FOTO},box-shadow .5s}
.cd .hang .cap,.cd .hang .floor,.cd .hang .nr{transition:opacity .35s}
.cd .wall.has-open .hang[aria-current] .cap,.cd .wall.has-open .hang[aria-current] .floor,.cd .wall.has-open .hang[aria-current] .nr{opacity:0}
/*
 * Een titel onder een stuk: hoogstens twee regels, dan "…". Een lang woord breekt
 * binnen de breedte van het stuk. De regelhoogte is 1,1 in plaats van 0,92, zodat
 * geen letter wordt afgesneden en er van een derde regel niets te zien is; de
 * marge van −0,09em houdt een titel van één regel op precies dezelfde plek.
 */
.cd .titel2{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;hyphens:auto;-webkit-hyphens:auto;line-height:1.1;margin:-.09em 0}

/* wand op blad */
.cd .table{flex:1;min-height:0;background:var(--table);display:grid;grid-template-columns:150px minmax(0,1fr)}
/* Een laag venster: minder ruimte boven de tabbladen, en lagere tabbladen (ontwerp bij 900: 96 en 88). */
.cd .tabs{display:flex;flex-direction:column;gap:4px;padding-top:clamp(16px,calc(100vh - 584px),96px);min-height:0}
.cd .tab{height:clamp(56px,calc((100vh - 340px) / 4.4),88px);flex:none;background:var(--g);margin-left:14px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;font-size:14px;font-weight:500;transition:margin .2s,background .2s}
.cd .tab:hover{margin-left:6px}
.cd .tab[aria-current]{background:var(--seam);margin-left:0;font-weight:600}
.cd .sheet{margin:40px 40px 40px 0;background:var(--seam);padding:2px;display:flex;flex-direction:column;gap:2px;min-width:0;min-height:0}

/* het kleurveld (lichtbak, gloedraster) */
.cd .glow{position:fixed;inset:0;z-index:0;background:#2A2622;overflow:hidden}
.cd .glow>div{position:absolute;inset:-8%;background-size:cover;background-position:center;filter:blur(24px);opacity:0;transition:opacity .9s;will-change:opacity}
.cd .glow>div.on{opacity:1}
.cd .glow::after{content:"";position:absolute;inset:0;background:rgba(20,18,16,.3)}
.cd.glowt .app{z-index:1;color:#fff}
.cd.glowt .top .spec>span:nth-child(odd){color:rgba(255,255,255,.7)}

/* lichtbak */
.cd .light{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;padding:0 48px;position:relative}
.cd .light .mid .pic{transition:transform .7s ${VERLOOP_FOTO}}
.cd .light>*,.cd .film{transition:opacity .45s}
.cd .light.has-open>*:not(.mid){opacity:0;pointer-events:none}
.cd .light.has-open .mid{position:relative;z-index:2}
.cd .film.has-open{opacity:.14;pointer-events:none}
/* safe: is de strook breder dan het venster, dan schuift hij vanaf het eerste vakje. */
.cd .film{flex:none;display:flex;justify-content:safe center;gap:2px;padding-bottom:28px;overflow-x:auto}
.cd .film a{width:104px;height:124px;flex:none;background:var(--g);color:var(--k);padding:8px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;transition:transform .2s}
.cd .film a:hover{transform:translateY(-6px)}
.cd .film a[aria-current]{background:var(--card);outline:2px solid #fff}

/* gloedraster */
.cd .gg{flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.28);position:relative}
.cd .gg.lang{grid-template-rows:none;grid-auto-rows:calc((100vh - 57px) / 2);overflow-y:auto}
.cd .gg>a{border-right:1px solid rgba(255,255,255,.28);border-bottom:1px solid rgba(255,255,255,.28);padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;min-height:0;min-width:0}
.cd .gg>a:hover,.cd .gg>a[aria-current]{background:rgba(255,255,255,.1)}
.cd .gg .obj{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
.cd .gg .pic{box-shadow:0 20px 50px rgba(20,18,16,.35);transition:transform .7s ${VERLOOP_FOTO}}
.cd .gg:not(.has-open)>a:hover .pic{transform:scale(1.08) translateY(-6px)}
.cd .gg>a,.cd .gg>a>span{transition:opacity .45s,background .3s}
.cd .gg.has-open>a:not([aria-current]){opacity:.14}
.cd .gg.has-open>a[aria-current]{background:none;position:relative;z-index:2}
.cd .gg.has-open>a[aria-current]>span:not(.obj){opacity:0}
.cd .gg .spec>span:nth-child(odd),.cd .gg .dim{color:rgba(255,255,255,.7)}

/* de meldingen: met iets nieuws een blok in de accentkleur met het aantal */
.cd .ster{position:relative}
.cd .ster.nieuw{width:auto;height:36px;padding:0 12px 0 10px;gap:8px;background:var(--acc);color:#fff;font-size:15px}
.cd .ster.nieuw::after{content:"";position:absolute;inset:0;border:2px solid var(--acc);animation:cd-ping 1.6s ${VERLOOP_FOTO} 3;pointer-events:none}
.cd .ster .aantal{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;animation:cd-rise .3s ${VERLOOP_FOTO}}
@keyframes cd-ping{0%{opacity:.9;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.35,1.6)}}

/* de weergave in de bovenbalk */
.cd .wk{flex:none;display:flex;align-items:center;gap:8px}
.cd .wkgroep{display:flex}
.cd .wkbtn{width:40px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid currentColor;opacity:.55;transition:opacity .12s,background .12s}
.cd .wkgroep .wkbtn+.wkbtn{margin-left:-1px}
.cd .wkbtn:hover{opacity:1}
.cd .wkbtn[aria-checked=true]{opacity:1;background:var(--k);color:var(--onk);border-color:var(--k)}
.cd.glowt .wkbtn[aria-checked=true]{background:#fff;color:#141210;border-color:#fff}
.cd .wkstand{width:36px;border-color:transparent}

@media (prefers-reduced-motion:reduce){.cd,.cd *,.cd *::before,.cd *::after{animation:none!important;transition:none!important}}
`;
