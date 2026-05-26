import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Backwards-compat redirect: older shared links used `/add/{username}`.
 * Everyone now lands on the canonical user-profile screen.
 */
export default function AddRedirect() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <Redirect href={`/user/${username ?? ""}`} />;
}
