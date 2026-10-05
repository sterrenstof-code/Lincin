import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";

import { supabase } from "./supabase/client";

// JaaS AppID — gratis tier: 10.000 min/maand.
// We gebruiken 8x8.vc (JaaS) i.p.v. meet.jit.si omdat meet.jit.si inmiddels
// een ingelogde moderator vereist om een vergadering te starten. JaaS heeft
// die beperking niet op de free tier: de eerste persoon die binnenkomt wordt
// automatisch moderator, ook zonder JWT.
const JAAS_APP_ID = "vpaas-magic-cookie-eaf3718655db436ca8e5535b6a565a84";

/**
 * De kamer van een gesprek (0096): een willekeurige naam die alleen leden
 * kunnen lezen, en die verandert als iemand vertrekt. Vroeger was het
 * `lincin-<chat-id>`, en een chat-id kennen ook wie geen lid (meer) is.
 */
export async function getCallRoom(chatId: string): Promise<string> {
  const { data, error } = await supabase.from("chats").select("call_room").eq("id", chatId).single();
  if (error) throw error;
  return data.call_room;
}

/** Iframe-embedbare URL voor JaaS (8x8.vc). */
export function buildJitsiEmbedUrl(callRoom: string): string {
  return `https://8x8.vc/${JAAS_APP_ID}/lincin-${callRoom}`;
}

/** De URL voor een open belscherm; `null` zolang de kamer nog geladen wordt. */
export function useCallUrl(chatId: string, enabled: boolean): string | null {
  const q = useQuery({
    queryKey: ["call-room", chatId],
    queryFn: () => getCallRoom(chatId),
    enabled,
    // Na een ledenwissel kan hij veranderd zijn: elke keer opnieuw vragen.
    staleTime: 0,
  });
  return q.data ? buildJitsiEmbedUrl(q.data) : null;
}

/**
 * Open een JaaS call in de browser (native fallback).
 * Op iOS/Android opent dit in Safari/Chrome; de in-app modal is web-only.
 */
export async function openJitsiCall(chatId: string): Promise<void> {
  await Linking.openURL(buildJitsiEmbedUrl(await getCallRoom(chatId)));
}
