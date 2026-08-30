import { inject, Injectable } from '@angular/core';
import { BlogPost, Page } from '../models';
import { ApiService } from './api.service';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  list(category?: string, page = 1) {
    return this.api.get<Page<BlogPost>>('/blog', { category, page, lang: this.language.lang() });
  }
  categories() {
    return this.api.get<{ value: string; count: number }[]>('/blog/categories');
  }
  detail(slug: string) {
    return this.api.get<BlogPost>(`/blog/${slug}`, { lang: this.language.lang() });
  }
}
