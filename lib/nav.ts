import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Go back if there's something in the navigation stack, otherwise replace
 * the current route with a fallback. Use this everywhere instead of
 * `router.back()` directly so deep-links and refreshes don't end up in a
 * stuck state with no back-history.
 */
export function safeBack(router: Router, fallback: string = "/"): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
