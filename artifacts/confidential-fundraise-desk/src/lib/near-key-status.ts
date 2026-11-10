export class NearKeyStatusUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      'Could not confirm whether this NEAR wallet key is registered. Check your connection and retry authentication. No key registration, Intents session, or quote was requested.',
      { cause },
    );
    this.name = 'NearKeyStatusUnavailableError';
  }
}

export function parseNearViewResponse(body: unknown, methodName: string): unknown {
  if (
    !body ||
    typeof body !== 'object' ||
    !('result' in body) ||
    !body.result ||
    typeof body.result !== 'object' ||
    !('result' in body.result) ||
    !Array.isArray(body.result.result) ||
    !body.result.result.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    throw new Error(`NEAR RPC returned an unreadable response for ${methodName}.`);
  }

  return JSON.parse(new TextDecoder().decode(Uint8Array.from(body.result.result)));
}

export async function checkNearKeyRegistrationStatus(
  accountId: string,
  publicKey: string | undefined,
  callViewMethod: (
    methodName: string,
    args: Record<string, string>,
  ) => Promise<unknown>,
): Promise<boolean> {
  if (/^[0-9a-f]{64}$/i.test(accountId)) return true;
  if (!publicKey) {
    throw new Error('This NEAR wallet did not provide a public key to verify its demo account.');
  }

  const formattedPublicKey = publicKey.startsWith('ed25519:')
    ? publicKey
    : `ed25519:${publicKey}`;
  try {
    const isRegistered = await callViewMethod('has_public_key', {
      account_id: accountId,
      public_key: formattedPublicKey,
    });
    if (typeof isRegistered !== 'boolean') {
      throw new NearKeyStatusUnavailableError();
    }
    return isRegistered;
  } catch (cause) {
    if (cause instanceof NearKeyStatusUnavailableError) throw cause;
    throw new NearKeyStatusUnavailableError(cause);
  }
}
