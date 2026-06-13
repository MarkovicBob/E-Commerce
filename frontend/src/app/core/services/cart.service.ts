import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from './api.service';

export interface Cart { items: { id: number; name: string; quantity: number; unit_price: number; line_total: number }[]; subtotal: number; total: number; promo_code?: string; }

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiService);
  readonly cart = signal<Cart | null>(null);
  readonly count = computed(() => this.cart()?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0);
  load() { return this.api.get<Cart>('/cart').pipe(tap((cart) => this.cart.set(cart))); }
  add(product_id: number, variant_id?: number, quantity = 1) { return this.api.post<Cart>('/cart/items', { product_id, variant_id, quantity }).pipe(tap((cart) => this.cart.set(cart))); }
  update(itemId: number, quantity: number) { return this.api.put('/cart/items/' + itemId, { quantity }).pipe(tap(() => this.load().subscribe())); }
  remove(itemId: number) { return this.api.delete('/cart/items/' + itemId).pipe(tap(() => this.load().subscribe())); }
  applyPromo(code: string) { return this.api.post<Cart>('/cart/apply-promo', { code }).pipe(tap((cart) => this.cart.set(cart))); }
  merge() { return this.api.post<Cart>('/cart/merge', {}).pipe(tap((cart) => this.cart.set(cart))); }
}
