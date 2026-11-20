import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal";
import { usePageTitle } from "@/lib/page-title";

export default function PrivacyScreen() {
  usePageTitle("Privacybeleid");
  return <LegalPage titel="Privacybeleid" secties={PRIVACY} />;
}
