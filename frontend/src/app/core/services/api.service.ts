import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  readonly baseUrl = environment.apiBaseUrl;

  /** Every request carries the guest session id so an anonymous cart stays with its browser. */
  private get headers() {
    return new HttpHeaders({ 'X-Session-Id': this.session.sessionId });
  }

  private toHttpParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  get<T>(path: string, params?: QueryParams) {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: this.toHttpParams(params), headers: this.headers });
  }
  post<T>(path: string, body: unknown = {}, params?: QueryParams) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { params: this.toHttpParams(params), headers: this.headers });
  }
  put<T>(path: string, body: unknown = {}, params?: QueryParams) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { params: this.toHttpParams(params), headers: this.headers });
  }
  delete<T>(path: string, params?: QueryParams) {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { params: this.toHttpParams(params), headers: this.headers });
  }
}
