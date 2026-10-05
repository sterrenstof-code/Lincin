import { router } from "expo-router";

import { BackupView } from "@/components/KeyGate";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/** Instellingen → Herstelcode: een nieuwe code, de oude vervalt (0094). */
function RecoveryCodeBody() {
  const { session } = useAuth();
  const back = () => safeBack(router, "/settings");
  return <BackupView userId={session!.user.id} renew onBack={back} onDone={back} />;
}

export default function RecoveryCodeScreen() {
  usePageTitle("Herstelcode");
  return (
    <RequireSession>
      <RecoveryCodeBody />
    </RequireSession>
  );
}
