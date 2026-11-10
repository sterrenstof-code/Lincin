import type { Compose } from "@/app/post-compose";

import { Spec, klikbaar } from "./Delen";

/**
 * Nieuwe bijdrage op desktop, op `useCompose()` (app/post-compose.tsx). Niet
 * apart ontworpen: de twee stappen van de telefoon (ontwerp 09 en 10) naast
 * elkaar, in de opbouw van Gesprekken en het paneel.
 *
 *   links (300)    de soorten; de gekozen is wit met een rand
 *   midden         het voorbeeld, groot: de foto's, de tekst als artikel, de
 *                  poll met zijn keuzes, of het beeld van de link
 *   rechts (440)   de velden, voor wie, concept en Deel
 *
 * Alleen de soorten die de app kan plaatsen, zoals op de telefoon.
 */

const SOORTEN = [
  ["foto", "Foto", "Eén foto of een album"],
  ["tekst", "Tekst", "Kort of lang, als een artikel"],
  ["poll", "Poll", "Een vraag met keuzes"],
  ["muziek", "Muziek", "Een nummer, met een link"],
  ["link", "Link", "Een pagina op het web"],
] as const;
type Soort = (typeof SOORTEN)[number][0];

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="S dim">{label}</span>
      {children}
    </label>
  );
}

export function NieuwDesktop({ c, sluit }: { c: Compose; sluit: () => void }) {
  const soort: Soort = (SOORTEN.map((s) => s[0]) as string[]).includes(c.kind) ? (c.kind as Soort) : "foto";
  const fotos = c.imageUris;
  const veld = (waarde: string, zet: (v: string) => void, plaatshouder: string, lang = false) =>
    lang ? (
      <textarea className="field lang" value={waarde} placeholder={plaatshouder} onChange={(e) => zet(e.target.value)} rows={soort === "tekst" ? 12 : 4} />
    ) : (
      <input className="field" value={waarde} placeholder={plaatshouder} onChange={(e) => zet(e.target.value)} />
    );

  return (
    <div className="grid" style={{ gridTemplateColumns: "300px minmax(0,1fr) 440px" }} data-meet="nieuw">
      {/* de soorten */}
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div className="strip">
          <Spec
            rijen={[
              ["Nieuw", `bijdrage № ${c.number}`],
              ["Soort", soort],
            ]}
          />
        </div>
        {SOORTEN.map(([k, naam, uitleg]) => (
          <a
            key={k}
            className="tile"
            aria-current={soort === k ? "true" : undefined}
            style={{ height: 72, flex: "none", justifyContent: "center", gap: 4 }}
            {...klikbaar(() => c.setKind(k))}
            data-meet="soort"
          >
            <span style={{ fontSize: 20 }}>{naam}</span>
            <span className="S dim">{uitleg}</span>
          </a>
        ))}
        <span style={{ flex: 1, background: "var(--g)" }} />
      </section>

      {/* het voorbeeld */}
      <section className="scroll" style={{ background: "var(--g)", minWidth: 0, minHeight: 0, padding: "40px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }} data-meet="voorbeeld">
        {soort === "foto" ? (
          fotos.length ? (
            <div style={{ width: "100%", maxWidth: 760, display: "grid", gridTemplateColumns: fotos.length > 1 ? "repeat(auto-fill,minmax(200px,1fr))" : "1fr", gap: 12 }}>
              {fotos.map((u, i) => (
                <span key={u} style={{ position: "relative", background: "var(--ph)", aspectRatio: fotos.length > 1 ? "4 / 5" : undefined, overflow: "hidden" }}>
                  <img src={u} alt="" style={fotos.length > 1 ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } : { width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
                  {i === 0 && fotos.length > 1 ? (
                    <span className="S" style={{ position: "absolute", left: 8, top: 8, background: "var(--card)", padding: "2px 6px" }}>
                      Omslag
                    </span>
                  ) : null}
                  <button className="ib" aria-label="Haal deze foto weg" style={{ position: "absolute", right: 4, top: 4, background: "var(--card)", width: 36, height: 36, fontSize: 14 }} onClick={() => c.removePhoto(i)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <button
              onClick={c.addPhotos}
              style={{ width: 360, height: 450, border: "1px dashed var(--k)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
              className="S"
            >
              Kies een of meer foto&apos;s
            </button>
          )
        ) : soort === "tekst" ? (
          <article className="artikel" style={{ paddingTop: 0 }}>
            <header>
              <span className="S dim">tekst · voorbeeld</span>
              <h1 className="T" style={{ color: c.title ? undefined : "var(--dim)" }}>
                {c.title || "Titel"}
              </h1>
            </header>
            <div className="lijf">
              {(c.body || "Wat wil je zeggen?")
                .split("\n")
                .map((r) => r.trim())
                .filter(Boolean)
                .map((r, i) => (
                  <p key={i} className={i === 0 ? "eerste" : undefined} style={{ color: c.body ? undefined : "var(--dim)" }}>
                    {r}
                  </p>
                ))}
            </div>
          </article>
        ) : soort === "poll" ? (
          <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="T" style={{ fontSize: 44, marginBottom: 20, color: c.title ? undefined : "var(--dim)" }}>
              {c.title || "Wat wil je weten?"}
            </span>
            {c.pollOptions.map((o, i) => (
              <span key={i} style={{ height: 56, background: "var(--card)", display: "flex", alignItems: "center", padding: "0 16px", color: o ? undefined : "var(--dim)" }}>
                {o || `Keuze ${i + 1}`}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
            {c.slotImage ? <img src={c.slotImage} alt="" style={{ width: "100%", maxHeight: "50vh", objectFit: "cover" }} /> : null}
            <span className="T" style={{ fontSize: 44, color: c.title ? undefined : "var(--dim)" }}>
              {c.title || (soort === "muziek" ? "Een nummer" : "Een pagina")}
            </span>
            <span className="S dim">{c.url || "https://"}</span>
          </div>
        )}
        {soort === "foto" && fotos.length ? (
          <button className="btn S ghost" onClick={c.addPhotos}>
            Voeg foto&apos;s toe
          </button>
        ) : null}
      </section>

      {/* de velden */}
      <aside className="panel" style={{ height: "auto" }} data-meet="nieuw-velden">
        <div className="strip" style={{ background: "var(--card)", padding: "0 6px 0 20px" }}>
          <Spec
            rijen={[
              ["Nieuw", soort],
              ["Zichtbaar", c.audienceLabel],
            ]}
          />
          <button className="ib" aria-label="Sluit" onClick={sluit}>
            ✕
          </button>
        </div>
        <div className="scroll" style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18, borderTop: "2px solid var(--g)" }}>
          {soort === "poll" ? (
            <>
              <Veld label="Vraag">{veld(c.title, c.setTitle, "Wat wil je weten?")}</Veld>
              {c.pollOptions.map((o, i) => (
                <Veld key={i} label={`Keuze ${i + 1}`}>
                  {veld(o, (v) => c.setPollOption(i, v), `Keuze ${i + 1}`)}
                </Veld>
              ))}
              {c.pollOptions.length < 4 ? (
                <button className="S link" style={{ alignSelf: "flex-start" }} onClick={c.addPollOption}>
                  + Nog een keuze
                </button>
              ) : null}
            </>
          ) : (
            <>
              {soort === "link" || soort === "muziek" ? <Veld label="Adres">{veld(c.url, c.setUrl, "https://")}</Veld> : null}
              <Veld label="Titel">{veld(c.title, c.setTitle, "Titel")}</Veld>
              {soort === "tekst" ? (
                <Veld label="Tekst">{veld(c.body, c.setBody, "Wat wil je zeggen? Een nieuwe regel is een nieuwe alinea.", true)}</Veld>
              ) : (
                <Veld label="Bijschrift">{veld(c.caption, c.setCaption, "Schrijf er iets bij", true)}</Veld>
              )}
            </>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="S dim">Voor wie</span>
            {soort === "poll" ? (
              <span style={{ padding: "12px 0" }}>Al je lincs</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, background: "var(--g)", padding: 2 }}>
                {c.audiences.map((a) => (
                  <button
                    key={a.id ?? "alle"}
                    role="radio"
                    aria-checked={c.audience === a.id}
                    onClick={() => c.setAudience(a.id)}
                    style={{ height: 48, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", background: c.audience === a.id ? "var(--card)" : "var(--g)" }}
                  >
                    <span>{a.label}</span>
                    <span className="S dim">
                      {a.n} {a.n === 1 ? "linc" : "lincs"} {c.audience === a.id ? " ✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {c.error ? <span className="S" style={{ color: "var(--gevaar)" }}>{c.error}</span> : null}
        </div>
        <div style={{ flex: "none", display: "flex", gap: 8, padding: "10px 20px 16px", borderTop: "2px solid var(--g)" }}>
          {c.dirty && !c.published ? (
            <button className="btn S ghost" onClick={c.keep}>
              {c.kept ? "Bewaard" : "Bewaar als concept"}
            </button>
          ) : null}
          <button className="btn S" style={{ flex: 1, justifyContent: "center", opacity: c.canSubmit && !c.published ? 1 : 0.4 }} disabled={!c.canSubmit || c.published} onClick={c.publish} data-meet="deel">
            {c.published ? "Gedeeld" : c.submitting ? "Bezig" : "Deel"}
          </button>
        </div>
      </aside>
    </div>
  );
}
