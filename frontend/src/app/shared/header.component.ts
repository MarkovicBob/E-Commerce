import { Component, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { CategoryNode, Lang, Suggestion } from '../core/models';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';
import { LanguageService } from '../core/services/language.service';
import { ProductService } from '../core/services/product.service';
import { ToastService } from '../core/services/toast.service';
import { WishlistService } from '../core/services/wishlist.service';
import { PricePipe } from './price.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ReactiveFormsModule, TranslateModule, PricePipe],
  template: `
    <header class="sticky top-0 z-40 border-b border-charcoal/10 bg-cream/95 backdrop-blur">
      <div class="section flex items-center gap-4 py-4">
        <button
          type="button"
          class="rounded p-2 text-xl md:hidden"
          [attr.aria-label]="'nav.menu' | translate"
          [attr.aria-expanded]="mobileOpen()"
          (click)="mobileOpen.set(!mobileOpen())"
        >
          ☰
        </button>

        <a routerLink="/" class="font-serif text-2xl font-bold tracking-tight">{{ 'brand' | translate }}</a>

        <nav class="hidden flex-1 items-center gap-6 text-sm font-medium md:flex">
          <div class="relative" (mouseenter)="megaOpen.set(true)" (mouseleave)="megaOpen.set(false)">
            <button type="button" class="flex items-center gap-1 py-2 hover:text-gold" (click)="megaOpen.set(!megaOpen())">
              {{ 'nav.categories' | translate }} <span class="text-xs">▾</span>
            </button>
            @if (megaOpen()) {
              <div
                class="fade-in absolute left-1/2 top-full z-50 w-[min(64rem,90vw)] -translate-x-1/2 rounded-b-lg border border-charcoal/10 bg-white p-6 shadow-xl"
              >
                <div class="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
                  @for (category of tree(); track category.id) {
                    <div>
                      <a
                        class="font-serif text-base hover:text-gold"
                        [routerLink]="['/category', category.slug]"
                        (click)="megaOpen.set(false)"
                      >
                        {{ category.name }}
                        <span class="ml-1 text-xs text-charcoal/40">{{ category.product_count }}</span>
                      </a>
                      <ul class="mt-2 space-y-1">
                        @for (child of category.children.slice(0, 5); track child.id) {
                          <li>
                            <a
                              class="text-sm text-charcoal/65 hover:text-gold"
                              [routerLink]="['/category', child.slug]"
                              (click)="megaOpen.set(false)"
                            >
                              {{ child.name }}
                            </a>
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>
                <a
                  class="mt-6 inline-block text-sm font-semibold text-gold hover:underline"
                  routerLink="/search"
                  (click)="megaOpen.set(false)"
                >
                  {{ 'nav.allCategories' | translate }} →
                </a>
              </div>
            }
          </div>
          <a routerLink="/search" routerLinkActive="text-gold" class="py-2 hover:text-gold">{{ 'nav.shop' | translate }}</a>
          <a routerLink="/blog" routerLinkActive="text-gold" class="py-2 hover:text-gold">{{ 'nav.blog' | translate }}</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="text-gold" class="py-2 hover:text-gold">{{ 'nav.admin' | translate }}</a>
          }
        </nav>

        <div class="relative ml-auto hidden lg:block" [formGroup]="searchForm">
          <input
            class="field w-64 pr-8"
            type="search"
            formControlName="q"
            [placeholder]="'nav.search' | translate"
            [attr.aria-label]="'nav.search' | translate"
            (keydown.enter)="submitSearch()"
            (focus)="suggestOpen.set(true)"
          />
          @if (suggestOpen() && suggestions().length) {
            <ul class="fade-in absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-charcoal/10 bg-white shadow-xl">
              @for (item of suggestions(); track item.slug) {
                <li>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-cream"
                    (click)="goToSuggestion(item)"
                  >
                    <img class="h-12 w-10 rounded object-cover" [src]="item.image_url" [alt]="item.name" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm">{{ item.name }}</span>
                      <span class="block text-xs text-charcoal/50">{{ item.brand }}</span>
                    </span>
                    <span class="text-xs font-semibold">{{ item.price | price }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <div class="flex items-center gap-2">
          <select
            class="field w-[4.5rem] px-2 py-1 text-sm"
            [value]="language.lang()"
            [attr.aria-label]="'nav.menu' | translate"
            (change)="switchLanguage($any($event.target).value)"
          >
            @for (option of language.available; track option) {
              <option [value]="option">{{ option.toUpperCase() }}</option>
            }
          </select>

          <a
            routerLink="/account"
            class="hidden rounded p-2 text-sm hover:text-gold sm:block"
            [attr.aria-label]="'nav.account' | translate"
          >
            {{ 'nav.account' | translate }}
          </a>

          <a
            routerLink="/account"
            [queryParams]="{ tab: 'wishlist' }"
            class="relative rounded p-2 text-lg hover:text-gold"
            [attr.aria-label]="'nav.wishlist' | translate"
          >
            ♡
            @if (wishlist.count() > 0) {
              <span class="badge">{{ wishlist.count() }}</span>
            }
          </a>

          <a
            routerLink="/cart"
            class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal transition hover:bg-gold/15 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            [attr.aria-label]="'nav.cart' | translate"
          >
            <svg
              class="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 3h2l2.15 10.3a2 2 0 0 0 1.96 1.59h7.78a2 2 0 0 0 1.94-1.51L20.5 7H6" />
              <circle cx="9.5" cy="20" r="1.25" />
              <circle cx="17.5" cy="20" r="1.25" />
            </svg>
            @if (cart.count() > 0) {
              <span class="badge">{{ cart.count() }}</span>
            }
          </a>

          @if (auth.isAuthenticated()) {
            <button type="button" class="btn-secondary hidden px-3 py-2 text-xs sm:inline-flex" (click)="signOut()">
              {{ 'auth.logout' | translate }}
            </button>
          } @else {
            <a routerLink="/login" class="btn-primary hidden px-3 py-2 text-xs sm:inline-flex">
              {{ 'auth.login' | translate }}
            </a>
          }
        </div>
      </div>

      @if (mobileOpen()) {
        <nav class="fade-in border-t border-charcoal/10 bg-white px-4 py-4 md:hidden">
          <div [formGroup]="searchForm" class="mb-4">
            <input
              class="field w-full"
              type="search"
              formControlName="q"
              [placeholder]="'nav.search' | translate"
              (keydown.enter)="submitSearch()"
            />
          </div>
          <a class="block py-2" routerLink="/search" (click)="mobileOpen.set(false)">{{ 'nav.shop' | translate }}</a>
          <a class="block py-2" routerLink="/blog" (click)="mobileOpen.set(false)">{{ 'nav.blog' | translate }}</a>
          <a class="block py-2" routerLink="/account" (click)="mobileOpen.set(false)">{{ 'nav.account' | translate }}</a>
          @if (auth.isAdmin()) {
            <a class="block py-2" routerLink="/admin" (click)="mobileOpen.set(false)">{{ 'nav.admin' | translate }}</a>
          }
          <details class="py-2">
            <summary class="cursor-pointer">{{ 'nav.categories' | translate }}</summary>
            <ul class="mt-2 space-y-1 pl-3">
              @for (category of tree(); track category.id) {
                <li>
                  <a class="block py-1 text-sm" [routerLink]="['/category', category.slug]" (click)="mobileOpen.set(false)">
                    {{ category.name }}
                  </a>
                </li>
              }
            </ul>
          </details>
          @if (auth.isAuthenticated()) {
            <button type="button" class="btn-secondary mt-3 w-full" (click)="signOut()">{{ 'auth.logout' | translate }}</button>
          } @else {
            <a class="btn-primary mt-3 w-full" routerLink="/login" (click)="mobileOpen.set(false)">
              {{ 'auth.login' | translate }}
            </a>
          }
        </nav>
      }
    </header>
  `
})
export class HeaderComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly wishlist = inject(WishlistService);
  readonly language = inject(LanguageService);
  private readonly products = inject(ProductService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly tree = signal<CategoryNode[]>([]);
  readonly suggestions = signal<Suggestion[]>([]);
  readonly megaOpen = signal(false);
  readonly mobileOpen = signal(false);
  readonly suggestOpen = signal(false);
  readonly searchForm = this.fb.nonNullable.group({ q: [''] });

  constructor() {
    this.loadTree();
    this.searchForm.controls.q.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.products.suggestions(term.trim()))
      )
      .subscribe({
        next: (items) => this.suggestions.set(items),
        error: () => this.suggestions.set([])
      });
  }

  private loadTree() {
    this.products.categoryTree().subscribe({
      next: (tree) => this.tree.set(tree),
      error: () => this.tree.set([])
    });
  }

  /** Category names come from the API, so the menu is refetched when the language changes. */
  switchLanguage(lang: Lang) {
    this.language.use(lang);
    this.loadTree();
  }

  submitSearch() {
    const q = this.searchForm.getRawValue().q.trim();
    this.suggestOpen.set(false);
    this.mobileOpen.set(false);
    this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }

  goToSuggestion(item: Suggestion) {
    this.suggestOpen.set(false);
    this.searchForm.controls.q.setValue('', { emitEvent: false });
    this.suggestions.set([]);
    this.router.navigate(['/product', item.slug]);
  }

  signOut() {
    this.auth.logout();
    this.cart.reset();
    this.wishlist.reset();
    this.mobileOpen.set(false);
    this.cart.load().subscribe({ error: () => undefined });
    this.toast.show(this.translate.instant('auth.loggedOut'));
    this.router.navigate(['/']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Close the autocomplete when the click lands outside the header.
    if (!(event.target as HTMLElement).closest('app-header')) {
      this.suggestOpen.set(false);
      this.megaOpen.set(false);
    }
  }
}
