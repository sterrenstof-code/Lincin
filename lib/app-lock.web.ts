/**
 * Op web geen app-vergrendeling: de browser heeft geen Face ID voor ons,
 * en een slot dat je met een nieuw tabblad omzeilt is geen slot. De
 * schakelaar in Instellingen verschijnt hier daarom niet.
 */
export type Biometry = { available: boolean; label: string };

export function loadAppLock(): Promise<boolean> {
  return Promise.resolve(false);
}
export async function getBiometry(): Promise<Biometry> {
  return { available: false, label: "" };
}
export async function authenticate(_reason: string): Promise<boolean> {
  return false;
}
export async function setAppLock(_on: boolean): Promise<boolean> {
  return false;
}
export async function clearAppLock() {}
export function isAuthenticating(): boolean {
  return false;
}
export async function offerAppLockOnce() {}
export function useAppLock(): { enabled: boolean | null; biometry: Biometry | null } {
  return { enabled: false, biometry: { available: false, label: "" } };
}
