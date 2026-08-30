import { inject, Injectable } from '@angular/core';
import { CategoryDetail, CategoryNode, Facets, Page, Product, Suggestion } from '../models';
import { ApiService, QueryParams } from './api.service';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  list(params: QueryParams = {}) {
    return this.api.get<Page<Product>>('/products', { ...params, lang: this.language.lang() });
  }
  detail(slug: string) {
    return this.api.get<Product>(`/products/${slug}`, { lang: this.language.lang() });
  }
  related(id: number) {
    return this.api.get<Product[]>(`/products/${id}/related`, { lang: this.language.lang() });
  }
  suggestions(q: string) {
    return this.api.get<Suggestion[]>('/products/search-suggestions', { q, lang: this.language.lang() });
  }
  brands(category?: string) {
    return this.api.get<string[]>('/products/brands', { category });
  }
  facets(params: QueryParams = {}) {
    return this.api.get<Facets>('/products/facets', params);
  }
  categoryTree() {
    return this.api.get<CategoryNode[]>('/categories', { tree: true, lang: this.language.lang() });
  }
  category(slug: string) {
    return this.api.get<CategoryDetail>(`/categories/${slug}`, { lang: this.language.lang() });
  }
}
