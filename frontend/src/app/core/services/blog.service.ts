import { inject, Injectable } from '@angular/core';
import { LanguageService } from './language.service';
import { ApiService } from './api.service';
import { Page } from './product.service';

export interface BlogPost { id: number; slug: string; title: string; excerpt: string; content: string; category: string; cover_image_url?: string; }

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);
  list(category?: string) { return this.api.get<Page<BlogPost>>('/blog', { category, lang: this.language.lang() }); }
  detail(slug: string) { return this.api.get<BlogPost>(`/blog/${slug}`, { lang: this.language.lang() }); }
}
