import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'sr' | 'en' | 'de';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly lang = signal<Lang>((localStorage.getItem('lang') as Lang) || 'sr');
  init() { this.translate.addLangs(['sr', 'en', 'de']); this.use(this.lang()); }
  use(lang: Lang) { this.lang.set(lang); localStorage.setItem('lang', lang); this.translate.use(lang); }
}
