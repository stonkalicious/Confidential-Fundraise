export function isTemporaryNearSessionRefreshFailure(error: unknown): boolean {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 401
  ) {
    return false;
  }
  return true;
}
