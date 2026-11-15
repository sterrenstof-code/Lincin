import { router } from "expo-router";
import { useEffect, useState } from "react";

import { PasskeyView } from "@/components/KeyGate";
import { RequireSession } from "@/components/RequireSession";
import { hasPasskeyCopy } from "@/lib/auth/bootstrap";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/** Instellingen → Passkey: je sleutel ook met een passkey bewaren (0101). */
function PasskeyBody() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [has, setHas] = useState(false);
  useEffect(() => {
    hasPasskeyCopy(uid).then(setHas, () => {});
  }, [uid]);
  const back = () => safeBack(router, "/settings");
  return <PasskeyView userId={uid} name={session!.user.email ?? "Lincin"} has={has} onBack={back} onDone={back} />;
}

export default function PasskeyScreen() {
  usePageTitle("Passkey");
  return (
    <RequireSession>
      <PasskeyBody />
    </RequireSession>
  );
}
