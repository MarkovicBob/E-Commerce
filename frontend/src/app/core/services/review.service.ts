import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly api = inject(ApiService);
  list(productId: number) { return this.api.get<unknown[]>(`/products/${productId}/reviews`); }
  create(productId: number, body: unknown) { return this.api.post(`/products/${productId}/reviews`, body); }
}
