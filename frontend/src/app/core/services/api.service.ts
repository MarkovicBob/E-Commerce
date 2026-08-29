import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  readonly baseUrl = environment.apiBaseUrl;

  private get headers() {
    return new HttpHeaders({ 'X-Session-Id': this.session.sessionId });
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: httpParams, headers: this.headers });
  }
  post<T>(path: string, body: unknown) { return this.http.post<T>(`${this.baseUrl}${path}`, body, { headers: this.headers }); }
  put<T>(path: string, body: unknown) { return this.http.put<T>(`${this.baseUrl}${path}`, body, { headers: this.headers }); }
  delete<T>(path: string) { return this.http.delete<T>(`${this.baseUrl}${path}`, { headers: this.headers }); }
}
