import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from './api.service';

export interface User { id: number; email: string; full_name: string; role: 'customer' | 'admin'; referral_code: string; }
export interface AuthResponse { access_token: string; refresh_token: string; user: User; }

/** Corrupt storage must not stop the app from booting. */
function readStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') ?? 'null') as User | null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly accessToken = signal<string | null>(sessionStorage.getItem('access_token'));
  readonly refreshToken = signal<string | null>(localStorage.getItem('refresh_token'));
  readonly user = signal<User | null>(readStoredUser());
  readonly isAuthenticated = computed(() => Boolean(this.accessToken() && this.user()));

  login(email: string, password: string) { return this.api.post<AuthResponse>('/auth/login', { email, password }).pipe(tap((res) => this.save(res))); }
  register(body: unknown) { return this.api.post<AuthResponse>('/auth/register', body).pipe(tap((res) => this.save(res))); }
  refresh() { return this.api.post<AuthResponse>('/auth/refresh', { refresh_token: this.refreshToken() }).pipe(tap((res) => this.save(res))); }
  me() { return this.api.get<User>('/auth/me').pipe(tap((user) => this.user.set(user))); }
  logout() { this.accessToken.set(null); this.refreshToken.set(null); this.user.set(null); sessionStorage.clear(); localStorage.removeItem('refresh_token'); localStorage.removeItem('user'); }

  private save(res: AuthResponse) {
    this.accessToken.set(res.access_token);
    this.refreshToken.set(res.refresh_token);
    this.user.set(res.user);
    sessionStorage.setItem('access_token', res.access_token);
    localStorage.setItem('refresh_token', res.refresh_token);
    localStorage.setItem('user', JSON.stringify(res.user));
  }
}
