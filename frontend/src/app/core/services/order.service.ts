import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);
  create(body: unknown) { return this.api.post<{ order_number: string }>('/orders', body); }
  mine() { return this.api.get<unknown[]>('/orders'); }
  detail(orderNumber: string) { return this.api.get<unknown>(`/orders/${orderNumber}`); }
}
