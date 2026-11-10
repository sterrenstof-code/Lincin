import { openLightbox } from "@/components/lincin/Lightbox";
import type { AttachmentInfo } from "@/lib/api/messages";
import { useAttachmentUris } from "@/lib/attachment-cache";

/**
 * Het beeld dat in een gesprek gedeeld is, in de zijkolom van Gesprekken
 * (catalogus, desktop): drie per rij, vierkant, nieuwste eerst. Een klik
 * opent de lichtbak op die foto, met alle andere om doorheen te bladeren.
 *
 * De beelden zijn versleuteld; `useAttachmentUris` haalt en ontsleutelt ze,
 * uit dezelfde cache als de draad (lib/attachment-cache.ts).
 */
export function GedeeldeBeelden({ media, naam }: { media: AttachmentInfo[]; naam: string }) {
  const uris = useAttachmentUris(media);
  const klaar = uris.filter((u): u is string => !!u);
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridAutoRows: "auto" }} data-meet="gedeeld">
      {media.map((a, i) => {
        const uri = uris[i];
        return (
          <button
            key={a.path}
            aria-label={`Gedeeld beeld ${i + 1} van ${media.length}`}
            style={{ aspectRatio: "1", background: "var(--ph)", position: "relative", overflow: "hidden", cursor: uri ? "zoom-in" : "default" }}
            disabled={!uri}
            onClick={() => {
              if (!uri) return;
              openLightbox({ uris: klaar, index: Math.max(0, klaar.indexOf(uri)), author: naam, kind: "foto", time: "", title: "" });
            }}
          >
            {uri ? <img src={uri} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          </button>
        );
      })}
      {/* De rest van de laatste rij: vlak, geen gat in de naad. */}
      {Array.from({ length: (3 - (media.length % 3)) % 3 }, (_, i) => (
        <span key={`leeg${i}`} style={{ background: "var(--g)" }} />
      ))}
    </div>
  );
}
