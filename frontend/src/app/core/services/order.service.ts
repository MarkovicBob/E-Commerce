import { inject, Injectable } from '@angular/core';
import { Address, AddressInput, Order, Page } from '../models';
import { ApiService } from './api.service';
import { LanguageService } from './language.service';

export interface OrderInput {
  shipping_address: Omit<AddressInput, 'label' | 'is_default'>;
  shipping_method: string;
  payment_method: string;
  contact_email?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  create(body: OrderInput) {
    return this.api.post<Order>('/orders', body, { lang: this.language.lang() });
  }
  mine(page = 1) {
    return this.api.get<Page<Order>>('/orders', { page, page_size: 20, lang: this.language.lang() });
  }
  /** `email` is only needed for a guest receipt, where there is no account to check against. */
  detail(orderNumber: string, email?: string) {
    return this.api.get<Order>(`/orders/${orderNumber}`, { email, lang: this.language.lang() });
  }
  cancel(orderNumber: string) {
    return this.api.post<Order>(`/orders/${orderNumber}/cancel`, {}, { lang: this.language.lang() });
  }

  addresses() {
    return this.api.get<Address[]>('/addresses');
  }
  createAddress(body: AddressInput) {
    return this.api.post<Address>('/addresses', body);
  }
  updateAddress(id: number, body: AddressInput) {
    return this.api.put<Address>(`/addresses/${id}`, body);
  }
  makeDefaultAddress(id: number) {
    return this.api.put<Address>(`/addresses/${id}/default`);
  }
  deleteAddress(id: number) {
    return this.api.delete<{ detail: string }>(`/addresses/${id}`);
  }
}
