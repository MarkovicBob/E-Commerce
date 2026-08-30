import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Lang } from '../models';

const SUPPORTED: Lang[] = ['sr', 'en', 'de'];
const STORAGE_KEY = 'lang';

function stored(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return saved && SUPPORTED.includes(saved) ? saved : 'sr';
  } catch {
    return 'sr';
  }
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly lang = signal<Lang>(stored());
  readonly available = SUPPORTED;

  init() {
    this.translate.addLangs(SUPPORTED);
    this.translate.setDefaultLang('sr');
    this.use(this.lang());
  }

  use(lang: Lang) {
    if (!SUPPORTED.includes(lang)) return;
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage can be unavailable in private mode; the choice then lasts for the session only.
    }
    this.translate.use(lang);
    document.documentElement.lang = lang;
  }
}
