import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);
  stats() { return this.api.get<Record<string, unknown>>('/admin/stats'); }
  users() { return this.api.get<Record<string, unknown>>('/admin/users'); }
  orders() { return this.api.get<Record<string, unknown>>('/admin/orders'); }
  promoCodes() { return this.api.get<unknown[]>('/admin/promo-codes'); }
  reviews() { return this.api.get<unknown[]>('/admin/reviews'); }
}
