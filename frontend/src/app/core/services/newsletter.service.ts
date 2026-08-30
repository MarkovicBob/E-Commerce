import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly api = inject(ApiService);
  subscribe(email: string) {
    return this.api.post<{ detail: string }>('/newsletter/subscribe', { email });
  }
}
