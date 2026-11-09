export type NearUserSession = {
  accountId: string;
  accessToken: string;
  expiresAt: number;
};

type RefreshResponse = {
  accountId: string;
  accessToken: string;
  expiresIn: number;
};

// Keep one instance per browser module so restore, quote, and retry callers
// share the same refresh (including when the provider rotates its credentials).
export function createNearSessionRefresher(
  refreshSession: () => Promise<RefreshResponse>,
): () => Promise<NearUserSession> {
  let inFlight: Promise<NearUserSession> | null = null;

  return () => {
    inFlight ??= (async () => {
      const session = await refreshSession();
      return {
        accountId: session.accountId,
        accessToken: session.accessToken,
        expiresAt: Date.now() + session.expiresIn * 1_000,
      };
    })().finally(() => {
      // Neither a resolved token nor a rejected promise should be cached.
      inFlight = null;
    });
    return inFlight;
  };
}
