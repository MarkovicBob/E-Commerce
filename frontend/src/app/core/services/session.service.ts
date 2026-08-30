import { Injectable } from '@angular/core';

const STORAGE_KEY = 'session_id';

/**
 * Generates a v4-shaped id without assuming a secure context.
 *
 * `crypto.randomUUID` only exists on https, localhost and 127.0.0.1. `npm start`
 * serves on 0.0.0.0, so opening the app over a LAN address (or any plain-http
 * host) leaves it undefined — calling it there would throw before the app can
 * boot, since every HTTP call depends on this service.
 */
function uuid(): string {
  const api = globalThis.crypto;
  if (typeof api?.randomUUID === 'function') {
    return api.randomUUID();
  }
  if (typeof api?.getRandomValues === 'function') {
    const bytes = api.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort. Only identifies a guest cart, so collision risk here is acceptable.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable per-browser id so a guest cart belongs to one visitor instead of being shared. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly sessionId = this.load();

  private load(): string {
    let existing: string | null = null;
    try {
      existing = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked (private mode, cookies disabled): fall through to a per-tab id.
    }
    if (existing) return existing;

    const created = uuid();
    try {
      localStorage.setItem(STORAGE_KEY, created);
    } catch {
      // Not persistable; the guest cart then lasts only for this tab.
    }
    return created;
  }
}
