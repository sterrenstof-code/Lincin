import { LegalPage } from "@/components/LegalPage";
import { VOORWAARDEN } from "@/lib/legal";
import { usePageTitle } from "@/lib/page-title";

export default function VoorwaardenScreen() {
  usePageTitle("Voorwaarden");
  return <LegalPage titel="Voorwaarden" secties={VOORWAARDEN} />;
}
