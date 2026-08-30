import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const RESPONSE = {
  access_token: 'access-123',
  refresh_token: 'refresh-456',
  user: {
    id: 1,
    email: 'ana@example.com',
    full_name: 'Ana Kovac',
    phone: null,
    role: 'customer' as const,
    referral_code: 'LUXE0001'
  }
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.isAdmin()).toBeFalse();
  });

  it('stores tokens after a successful login', () => {
    service.login('ana@example.com', 'Secret123').subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(RESPONSE);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.user()?.email).toBe('ana@example.com');
    // The access token is per-tab; only the refresh token survives a browser restart.
    expect(sessionStorage.getItem('access_token')).toBe('access-123');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-456');
  });

  it('recognises an admin', () => {
    service.login('admin@example.com', 'Secret123').subscribe();
    http
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ ...RESPONSE, user: { ...RESPONSE.user, role: 'admin' } });

    expect(service.isAdmin()).toBeTrue();
  });

  it('clears its own storage keys on logout but leaves others alone', () => {
    service.login('ana@example.com', 'Secret123').subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(RESPONSE);
    localStorage.setItem('lang', 'de');
    sessionStorage.setItem('unrelated', 'keep-me');

    service.logout();
    http.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush({ detail: 'Logged out' });

    expect(service.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('lang')).toBe('de');
    expect(sessionStorage.getItem('unrelated')).toBe('keep-me');
  });

  it('survives a corrupt stored user', () => {
    localStorage.setItem('user', '{not json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fresh = TestBed.inject(AuthService);

    expect(fresh.user()).toBeNull();
    expect(fresh.isAuthenticated()).toBeFalse();
    TestBed.inject(HttpTestingController).verify();
  });
});
