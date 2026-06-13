import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: httpParams });
  }
  post<T>(path: string, body: unknown) { return this.http.post<T>(`${this.baseUrl}${path}`, body); }
  put<T>(path: string, body: unknown) { return this.http.put<T>(`${this.baseUrl}${path}`, body); }
  delete<T>(path: string) { return this.http.delete<T>(`${this.baseUrl}${path}`); }
}
