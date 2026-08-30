import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { User } from '../models';
import { ApiService } from './api.service';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  referral_code?: string | null;
}

/** Corrupt storage must not stop the app from booting. */
function readStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') ?? 'null') as User | null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly accessToken = signal<string | null>(read(sessionStorage, 'access_token'));
  readonly refreshToken = signal<string | null>(read(localStorage, 'refresh_token'));
  readonly user = signal<User | null>(readStoredUser());
  readonly isAuthenticated = computed(() => Boolean(this.accessToken() && this.user()));
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password }).pipe(tap((res) => this.save(res)));
  }

  register(body: RegisterInput) {
    return this.api.post<AuthResponse>('/auth/register', body).pipe(tap((res) => this.save(res)));
  }

  refresh(): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/refresh', { refresh_token: this.refreshToken() })
      .pipe(tap((res) => this.save(res)));
  }

  me() {
    return this.api.get<User>('/auth/me').pipe(tap((user) => this.setUser(user)));
  }

  updateProfile(body: { full_name: string; phone: string | null }) {
    return this.api.put<User>('/auth/me', body).pipe(tap((user) => this.setUser(user)));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.put<{ detail: string }>('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  forgotPassword(email: string) {
    return this.api.post<{ detail: string; reset_token?: string }>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string) {
    return this.api.post<{ detail: string }>('/auth/reset-password', { token, new_password: newPassword });
  }

  logout() {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
    // Clear only our own keys; sessionStorage may hold state belonging to other code.
    this.forget(sessionStorage, 'access_token');
    this.forget(localStorage, 'refresh_token');
    this.forget(localStorage, 'user');
    // Best effort: also drops the httpOnly refresh cookie the browser cannot clear itself.
    this.api.post('/auth/logout').subscribe({ error: () => undefined });
  }

  private setUser(user: User) {
    this.user.set(user);
    this.write(localStorage, 'user', JSON.stringify(user));
  }

  private save(res: AuthResponse) {
    this.accessToken.set(res.access_token);
    this.refreshToken.set(res.refresh_token);
    this.user.set(res.user);
    this.write(sessionStorage, 'access_token', res.access_token);
    this.write(localStorage, 'refresh_token', res.refresh_token);
    this.write(localStorage, 'user', JSON.stringify(res.user));
  }

  private write(storage: Storage, key: string, value: string) {
    try {
      storage.setItem(key, value);
    } catch {
      // Private mode: the session simply does not survive a reload.
    }
  }

  private forget(storage: Storage, key: string) {
    try {
      storage.removeItem(key);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }
}
