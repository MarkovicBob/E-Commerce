import { Component, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { LanguageService } from './core/services/language.service';
import { WishlistService } from './core/services/wishlist.service';
import { FooterComponent } from './shared/footer.component';
import { HeaderComponent } from './shared/header.component';
import { ToastComponent } from './shared/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastComponent],
  template: `
    <a class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:btn-primary" href="#main">
      Skip to content
    </a>
    <app-header />
    <main id="main" class="min-h-[60vh]"><router-outlet /></main>
    <app-footer />
    <app-toast />
  `
})
export class AppComponent {
  private readonly language = inject(LanguageService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);

  constructor() {
    this.language.init();
    // The header badge and cart names follow every language change, including
    // the initial language restored from local storage.
    effect(
      () => {
        this.language.lang();
        this.cart.load().subscribe({ error: () => undefined });
      },
      { allowSignalWrites: true }
    );
    if (this.auth.isAuthenticated()) {
      this.wishlist.loadIds().subscribe({ error: () => undefined });
    }
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }
}
