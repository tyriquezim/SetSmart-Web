/** sessionStorage flag set just before signing out after deleting an account, so the sign-in page can confirm it. */
export const ACCOUNT_DELETED_FLAG = 'setsmart.accountDeleted'

export function readAccountDeletedFlag(): boolean {
  try {
    return sessionStorage.getItem(ACCOUNT_DELETED_FLAG) === '1'
  } catch {
    return false
  }
}

export function clearAccountDeletedFlag(): void {
  try {
    sessionStorage.removeItem(ACCOUNT_DELETED_FLAG)
  } catch {
    // Nothing to clear.
  }
}
