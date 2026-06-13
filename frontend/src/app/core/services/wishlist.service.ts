import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Product } from './product.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly api = inject(ApiService);
  readonly items = signal<Product[]>([]);
  load() { return this.api.get<Product[]>('/wishlist').pipe(tap((items) => this.items.set(items))); }
  add(productId: number) { return this.api.post('/wishlist/' + productId, {}).pipe(tap(() => this.load().subscribe())); }
  remove(productId: number) { return this.api.delete('/wishlist/' + productId).pipe(tap(() => this.load().subscribe())); }
}
