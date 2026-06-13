import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';
import { LanguageService, Lang } from '../core/services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  template: `
    <header class="sticky top-0 z-40 border-b border-charcoal/10 bg-cream/95 backdrop-blur">
      <div class="section flex items-center justify-between py-4">
        <a routerLink="/" class="font-serif text-2xl font-bold tracking-normal">Luxe Commerce</a>
        <nav class="hidden items-center gap-6 text-sm font-medium md:flex">
          <a routerLink="/search">{{ 'nav.shop' | translate }}</a>
          <a routerLink="/blog">{{ 'nav.blog' | translate }}</a>
          <a routerLink="/account">{{ 'nav.account' | translate }}</a>
          @if (auth.user()?.role === 'admin') { <a routerLink="/admin">Admin</a> }
        </nav>
        <div class="flex items-center gap-3">
          <select class="field w-20 py-1" [value]="language.lang()" (change)="language.use($any($event.target).value)">
            <option value="sr">SR</option><option value="en">EN</option><option value="de">DE</option>
          </select>
          <a routerLink="/cart" class="btn-secondary px-3 py-2" [attr.aria-label]="'nav.cart' | translate">Cart {{ cart.count() }}</a>
          @if (auth.isAuthenticated()) { <button class="btn-secondary px-3 py-2" (click)="auth.logout()">Logout</button> } @else { <a routerLink="/login" class="btn-primary px-3 py-2">Login</a> }
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly language = inject(LanguageService);
  use(lang: Lang) { this.language.use(lang); }
}
