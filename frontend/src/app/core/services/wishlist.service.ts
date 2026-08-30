import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Product } from '../models';
import { ApiService } from './api.service';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);
  readonly items = signal<Product[]>([]);
  /** Ids alone are enough to render the heart state on every product card. */
  readonly ids = signal<number[]>([]);
  readonly count = computed(() => this.ids().length);

  load() {
    return this.api.get<Product[]>('/wishlist', { lang: this.language.lang() }).pipe(
      tap((items) => {
        this.items.set(items);
        this.ids.set(items.map((item) => item.id));
      })
    );
  }

  loadIds() {
    return this.api.get<number[]>('/wishlist/ids').pipe(tap((ids) => this.ids.set(ids)));
  }

  has(productId: number) {
    return this.ids().includes(productId);
  }

  add(productId: number) {
    return this.api
      .post<{ product_id: number }>(`/wishlist/${productId}`)
      .pipe(tap(() => this.ids.update((ids) => (ids.includes(productId) ? ids : [...ids, productId]))));
  }

  remove(productId: number) {
    return this.api.delete<{ product_id: number }>(`/wishlist/${productId}`).pipe(
      tap(() => {
        this.ids.update((ids) => ids.filter((id) => id !== productId));
        this.items.update((items) => items.filter((item) => item.id !== productId));
      })
    );
  }

  reset() {
    this.items.set([]);
    this.ids.set([]);
  }
}
