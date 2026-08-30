import { inject, Injectable } from '@angular/core';
import { Review, ReviewPage } from '../models';
import { ApiService } from './api.service';
import { LanguageService } from './language.service';

export interface Eligibility {
  can_review: boolean;
  order_ids: number[];
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  list(productId: number, page = 1) {
    return this.api.get<ReviewPage>(`/products/${productId}/reviews`, {
      page,
      page_size: 10,
      lang: this.language.lang()
    });
  }
  /** Tells the product page whether to render the review form at all. */
  eligibility(productId: number) {
    return this.api.get<Eligibility>(`/products/${productId}/reviews/eligibility`);
  }
  create(productId: number, body: { order_id: number; rating: number; comment: string | null }) {
    return this.api.post<Review>(`/products/${productId}/reviews`, {
      ...body,
      language_code: this.language.lang()
    });
  }
}
