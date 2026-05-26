/**
 * Lincin Service Worker
 *
 * Verantwoordelijk voor:
 *   1. Web Push notifications ontvangen en tonen
 *   2. Notificatie-klik afhandelen → juiste route openen
 *
 * Geregistreerd door lib/push.ts via navigator.serviceWorker.register('/sw.js').
 * Vercel serveert dit bestand zonder cache (zie vercel.json).
 *
 * Payload-formaat (verstuurd door de send-push Edge Function):
 *   { title: string, body: string, data: { chat_id?: string, type: string } }
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Lincin", body: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "Lincin";
  const options = {
    body: payload.body ?? "Nieuw bericht",
    icon: "/assets/images/icon.png",
    badge: "/assets/images/icon.png",
    data: payload.data ?? {},
    // Groepeert notificaties per chat zodat ze niet opstapelen
    tag: payload.data?.chat_id ? `chat-${payload.data.chat_id}` : "lincin",
    renotify: true,
    // Trilt kort op Android
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  let targetPath = "/";
  if (data.chat_id) targetPath = `/chat/${data.chat_id}`;
  else if (data.post_id) targetPath = `/post/${data.post_id}`;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Als er al een Lincin-venster open is: focus het en navigeer.
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            // postMessage zodat expo-router de navigatie oppakt
            client.postMessage({ type: "PUSH_NAV", path: targetPath });
            return;
          }
        }
        // Anders: open een nieuw venster.
        if (clients.openWindow) {
          return clients.openWindow(targetPath);
        }
      })
  );
});

// Activeer de nieuwe SW meteen zonder te wachten op tab-sluiting.
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
