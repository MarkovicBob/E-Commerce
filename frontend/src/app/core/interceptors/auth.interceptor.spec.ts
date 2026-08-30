import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const USER = {
  id: 1,
  email: 'ana@example.com',
  full_name: 'Ana Kovac',
  phone: null,
  role: 'customer' as const,
  referral_code: 'LUXE0001'
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  function signIn() {
    auth.login('ana@example.com', 'Secret123').subscribe();
    backend
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ access_token: 'old-token', refresh_token: 'refresh-1', user: USER });
  }

  it('sends no Authorization header for a guest', () => {
    http.get('/api/v1/cart').subscribe();
    expect(backend.expectOne('/api/v1/cart').request.headers.has('Authorization')).toBeFalse();
  });

  it('attaches the access token once signed in', () => {
    signIn();
    http.get('/api/v1/cart').subscribe();
    expect(backend.expectOne('/api/v1/cart').request.headers.get('Authorization')).toBe('Bearer old-token');
  });

  it('refreshes on 401 and replays the original request', () => {
    signIn();
    let body: unknown = null;
    http.get('/api/v1/cart').subscribe((result) => (body = result));

    // The backend now answers 401 for an expired token instead of silently
    // treating the caller as a guest, which is what makes this recovery possible.
    backend.expectOne('/api/v1/cart').flush({ detail: 'Invalid or expired token' }, { status: 401, statusText: 'Unauthorized' });

    backend
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ access_token: 'new-token', refresh_token: 'refresh-2', user: USER });

    const replay = backend.expectOne('/api/v1/cart');
    expect(replay.request.headers.get('Authorization')).toBe('Bearer new-token');
    replay.flush({ items: [] });

    expect(body).toEqual({ items: [] });
    expect(auth.accessToken()).toBe('new-token');
  });

  it('refreshes only once for a burst of concurrent 401s', () => {
    signIn();
    http.get('/api/v1/cart').subscribe();
    http.get('/api/v1/wishlist').subscribe();

    backend.expectOne('/api/v1/cart').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/wishlist').flush({}, { status: 401, statusText: 'Unauthorized' });

    // One shared refresh, not one per failed request.
    backend
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ access_token: 'new-token', refresh_token: 'refresh-2', user: USER });

    backend.expectOne('/api/v1/cart').flush({});
    backend.expectOne('/api/v1/wishlist').flush({});
    expect(auth.accessToken()).toBe('new-token');
  });

  it('signs the user out when the refresh itself fails', () => {
    signIn();
    let failed = false;
    http.get('/api/v1/cart').subscribe({ error: () => (failed = true) });

    backend.expectOne('/api/v1/cart').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${environment.apiBaseUrl}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush({ detail: 'Logged out' });

    expect(failed).toBeTrue();
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('never tries to refresh a failed login', () => {
    // Without this guard a rejected login would loop through the refresh endpoint.
    auth.login('ana@example.com', 'wrong').subscribe({ error: () => undefined });
    backend
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ detail: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(`${environment.apiBaseUrl}/auth/refresh`);
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('does not attempt a refresh for a guest 401', () => {
    http.get('/api/v1/wishlist').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/wishlist').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(`${environment.apiBaseUrl}/auth/refresh`);
    expect(auth.refreshToken()).toBeNull();
  });
});
