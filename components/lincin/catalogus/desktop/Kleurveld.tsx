import { useEffect, useRef, useState } from "react";

/**
 * Het kleurveld van lichtbak en gloedraster (briefing §6): de foto van het
 * gekozen stuk, sterk vervaagd en beeldvullend, met een laag inkt van 30 %
 * erover. Twee lagen die in 0,9 s kruisen als het stuk wisselt.
 */
export function Kleurveld({ beeld }: { beeld: string | null }) {
  // Twee lagen; `aan` is de laag die nu zichtbaar is.
  const [lagen, setLagen] = useState<[string | null, string | null]>([beeld, null]);
  const [aan, setAan] = useState(0);
  const huidig = useRef(beeld);

  useEffect(() => {
    if (beeld === huidig.current) return;
    huidig.current = beeld;
    const volgende = 1 - aan;
    setLagen((l) => {
      const n: [string | null, string | null] = [l[0], l[1]];
      n[volgende] = beeld;
      return n;
    });
    setAan(volgende);
  }, [beeld, aan]);

  return (
    <div className="glow" aria-hidden="true" data-meet="kleurveld">
      {lagen.map((b, i) => (
        <div key={i} className={i === aan && b ? "on" : undefined} style={b ? { backgroundImage: `url("${b}")` } : undefined} />
      ))}
    </div>
  );
}
