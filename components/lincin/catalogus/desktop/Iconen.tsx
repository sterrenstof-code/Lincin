/**
 * De iconen van de bovenbalk, als één familie: op een raster van 24, lijnen
 * van 1,5 in de kleur van de tekst, rechte uiteinden, geen vulling. Zo staan
 * de weergaven, de stand, ✳ en + even zwaar en even groot naast elkaar.
 * (Het hartje en de reactie in Delen volgen hetzelfde raster.)
 */

export type IcoonNaam = "wand" | "gloedraster" | "maan" | "zon" | "ster" | "plus";

const PADEN: Record<IcoonNaam, React.ReactNode> = {
  wand: (
    <>
      <path d="M3 6.5h5v9.5H3zM10 10h4.5v6H10zM16.5 8H21v8h-4.5z" />
      <path d="M2 19.5h20" />
    </>
  ),
  gloedraster: <path d="M3 5.5h18v13H3zM3 12h18M9 5.5v13M15 5.5v13" />,
  maan: <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1z" />,
  zon: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  ster: <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 4v16M4 12h16" />,
};

export function Icoon({ naam, maat = 22 }: { naam: IcoonNaam; maat?: number }) {
  return (
    <svg aria-hidden="true" width={maat} height={maat} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="butt" strokeLinejoin="miter" style={{ flex: "none" }}>
      {PADEN[naam]}
    </svg>
  );
}
