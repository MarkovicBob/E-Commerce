import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Cart } from '../models';
import { ApiService } from './api.service';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);
  readonly cart = signal<Cart | null>(null);
  readonly items = computed(() => this.cart()?.items ?? []);
  readonly count = computed(() => this.cart()?.item_count ?? 0);
  readonly isEmpty = computed(() => this.items().length === 0);

  /** Every mutation returns the whole cart, so one signal update keeps the UI in step. */
  private absorb() {
    return tap((cart: Cart) => this.cart.set(cart));
  }

  load(shippingMethod = 'standard') {
    return this.api.get<Cart>('/cart', { shipping_method: shippingMethod, lang: this.language.lang() }).pipe(this.absorb());
  }
  add(productId: number, variantId: number | null = null, quantity = 1) {
    return this.api
      .post<Cart>('/cart/items', { product_id: productId, variant_id: variantId, quantity }, { lang: this.language.lang() })
      .pipe(this.absorb());
  }
  update(itemId: number, quantity: number) {
    return this.api.put<Cart>(`/cart/items/${itemId}`, { quantity }, { lang: this.language.lang() }).pipe(this.absorb());
  }
  remove(itemId: number) {
    return this.api.delete<Cart>(`/cart/items/${itemId}`, { lang: this.language.lang() }).pipe(this.absorb());
  }
  clear() {
    return this.api.delete<Cart>('/cart/items', { lang: this.language.lang() }).pipe(this.absorb());
  }
  applyPromo(code: string) {
    return this.api.post<Cart>('/cart/apply-promo', { code }, { lang: this.language.lang() }).pipe(this.absorb());
  }
  removePromo() {
    return this.api.delete<Cart>('/cart/promo', { lang: this.language.lang() }).pipe(this.absorb());
  }
  merge() {
    return this.api.post<Cart>('/cart/merge', {}, { lang: this.language.lang() }).pipe(this.absorb());
  }
  reset() {
    this.cart.set(null);
  }
}
