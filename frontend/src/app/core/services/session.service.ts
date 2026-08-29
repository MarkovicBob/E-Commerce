import { Injectable } from '@angular/core';

const STORAGE_KEY = 'session_id';

/** Stable per-browser id so a guest cart belongs to one visitor instead of being shared. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly sessionId = this.load();

  private load(): string {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const created = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch {
      // Private mode / storage disabled: fall back to a per-tab id.
      return crypto.randomUUID();
    }
  }
}
