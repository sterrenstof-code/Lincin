import { clearIdentity } from "../crypto/keys";
import { supabase } from "../supabase/client";

/**
 * Je account voorgoed weg (0105): bestanden, berichten, bijdragen, alles.
 * De Edge Function `delete-account` wist op de server; hier daarna de
 * sleutel van dit toestel, want er is geen account meer om hem bij te
 * horen. Uitloggen doet de aanroeper (`signOut` uit useAuth).
 */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error || !data?.ok) throw new Error("Verwijderen lukte niet. Probeer het opnieuw.");
  await clearIdentity();
}
