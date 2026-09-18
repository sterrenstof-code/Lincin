import { supabase } from "../supabase/client";

/**
 * Roep de Edge Function invite-by-email aan. De function valideert dat de
 * caller ingelogd is, stuurt een Supabase-invite naar het opgegeven adres,
 * en schrijft een pending_invite zodat de invitee automatisch vriend wordt
 * zodra hij/zij zich aanmeldt.
 */
export async function sendEmailInvite(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("invite-by-email", {
    body: { email },
  });
  if (error) {
    // Supabase functions wrap server errors; probeer de eigen error message te halen
    const message =
      (data as any)?.error ??
      (error as any)?.context?.error ??
      error.message ??
      "Kon uitnodiging niet versturen.";
    throw new Error(message);
  }
  if (data && (data as any).error) {
    throw new Error((data as any).error);
  }
}
