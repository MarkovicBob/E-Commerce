import { inject, Injectable } from '@angular/core';
import { LanguageService } from './language.service';
import { ApiService } from './api.service';

export interface Page<T> { items: T[]; total: number; page: number; page_size: number; }
export interface Product { id: number; slug: string; name: string; description: string; price: number; discount_price?: number; brand: string; stock_quantity: number; average_rating: number; images: { image_url: string }[]; variants: { id: number; size?: string; color?: string; stock_quantity: number }[]; }

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);
  list(params: Record<string, unknown> = {}) { return this.api.get<Page<Product>>('/products', { ...params, lang: this.language.lang() }); }
  detail(slug: string) { return this.api.get<Product>(`/products/${slug}`, { lang: this.language.lang() }); }
  related(id: number) { return this.api.get<Product[]>(`/products/${id}/related`, { lang: this.language.lang() }); }
  suggestions(q: string) { return this.api.get<string[]>('/products/search-suggestions', { q }); }
  brands() { return this.api.get<string[]>('/products/brands'); }
  categories() { return this.api.get<{ id: number; name: string; slug: string; image_url?: string }[]>('/categories', { lang: this.language.lang() }); }
}
