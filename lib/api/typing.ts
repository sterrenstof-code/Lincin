import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";

/**
 * Ephemeral typing-indicator channel. Uses Supabase Realtime broadcast (no DB
 * writes). Each chat has its own channel; clients send a "typing" event
 * throttled to ~once per 2s while the user is composing, and clear themselves
 * on the receiver side after 4s of inactivity.
 */

export type TypingEvent = {
  user_id: string;
  name: string;
};

export type TypingHandle = {
  channel: RealtimeChannel;
  /** Send a typing event from the current user; throttled to once per 2 seconds. */
  sendTyping(name: string): void;
  /** Cleanly unsubscribe. */
  unsubscribe(): void;
};

const SEND_THROTTLE_MS = 2000;

/** Re-export of the receiver indicator's expiration (in ms) for use in UIs. */
export const TYPING_EXPIRY_MS = 4000;

export function subscribeToTyping(
  chatId: string,
  myUserId: string,
  onTyping: (event: TypingEvent) => void
): TypingHandle {
  const channel = supabase.channel(`chat-typing:${chatId}`, {
    config: { broadcast: { self: false } },
  });

  channel
    .on("broadcast", { event: "typing" }, (payload) => {
      const evt = (payload.payload ?? {}) as TypingEvent;
      if (!evt.user_id || evt.user_id === myUserId) return;
      onTyping(evt);
    })
    .subscribe();

  let lastSent = 0;

  return {
    channel,
    sendTyping(name: string) {
      const now = Date.now();
      if (now - lastSent < SEND_THROTTLE_MS) return;
      lastSent = now;
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: myUserId, name },
      });
    },
    unsubscribe() {
      // removeChannel haalt de channel uit Supabase's interne registry,
      // niet enkel uit subscribed-state. Voorkomt de "cannot add callbacks
      // after subscribe()" race onder React StrictMode.
      supabase.removeChannel(channel);
    },
  };
}
