/** Access may be denied by browser policy. Callers retain their own read,
 * validation, conflict and explicit-write rules. No storage is migrated here. */
export function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
