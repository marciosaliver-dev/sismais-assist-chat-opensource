/**
 * Meta WhatsApp 24h Window Helper
 *
 * Per Meta Business Policy, businesses can only send free-form messages
 * within 24 hours of the last customer message. Outside this window,
 * only approved HSM templates are allowed.
 */

export interface WindowStatus {
  isOpen: boolean;
  expiresAt: string | null;
  remainingMs: number;
  requiresTemplate: boolean;
}

export function check24hWindow(lastCustomerMessageAt: string | null): WindowStatus {
  if (!lastCustomerMessageAt) {
    return { isOpen: false, expiresAt: null, remainingMs: 0, requiresTemplate: true };
  }
  const expiry = new Date(lastCustomerMessageAt).getTime() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = Math.max(0, expiry - now);
  return {
    isOpen: remainingMs > 0,
    expiresAt: new Date(expiry).toISOString(),
    remainingMs,
    requiresTemplate: remainingMs <= 0,
  };
}
