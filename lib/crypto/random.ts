/**
 * Importing this module installs a cryptographically secure
 * `globalThis.crypto.getRandomValues` polyfill on React Native (Hermes).
 * On web it's a no-op — the browser already provides it.
 *
 * Every other module under lib/crypto/ imports this first so that
 * @stablelib's default RandomSource picks up real entropy.
 */
import "react-native-get-random-values";

// Re-export randomBytes for convenience.
export { randomBytes } from "@stablelib/random";

/** Kept for backwards compatibility with earlier scaffolding; no-op now. */
export function initCryptoRandom(): void {
  /* polyfill is loaded by import side-effect above */
}
