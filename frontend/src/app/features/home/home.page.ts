import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CategoryNode, Product } from '../../core/models';
import { LanguageService } from '../../core/services/language.service';
import { ProductService } from '../../core/services/product.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { SkeletonLoaderComponent } from '../../shared/ui.component';

interface Testimonial {
  quote: string;
  author: string;
  city: string;
}

@Component({
  standalone: true,
  imports: [RouterLink, TranslateModule, ProductCardComponent, SkeletonLoaderComponent],
  template: `
    <section class="relative isolate overflow-hidden bg-charcoal">
      <img
        class="absolute inset-0 h-full w-full object-cover opacity-55"
        src="/assets/images/product-placeholder.svg"
        alt=""
        aria-hidden="true"
      />
      <div class="section relative flex min-h-[70vh] items-center py-20">
        <div class="max-w-2xl text-cream">
          <p class="text-xs uppercase tracking-[0.3em] text-gold">{{ 'brand' | translate }}</p>
          <h1 class="mt-4 font-serif text-5xl font-bold leading-tight sm:text-7xl">{{ 'home.hero' | translate }}</h1>
          <p class="mt-5 max-w-xl text-lg text-cream/85">{{ 'home.lead' | translate }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a class="btn-primary" routerLink="/search">{{ 'home.cta' | translate }}</a>
            <a class="btn-secondary border-cream/60 text-cream hover:border-gold" routerLink="/search" fragment="categories">
              {{ 'home.ctaSecondary' | translate }}
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="border-b border-charcoal/10 bg-white">
      <div class="section grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        @for (benefit of benefits; track benefit) {
          <div>
            <h3 class="font-serif text-lg">{{ 'home.' + benefit + 'Title' | translate }}</h3>
            <p class="mt-1 text-sm text-charcoal/60">{{ 'home.' + benefit + 'Text' | translate }}</p>
          </div>
        }
      </div>
    </section>

    <section class="section-y" id="categories">
      <h2 class="font-serif text-4xl">{{ 'home.categories' | translate }}</h2>
      <p class="mt-2 text-charcoal/60">{{ 'home.categoriesLead' | translate }}</p>
      <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @if (categories().length === 0) {
          @for (item of skeletons; track item) {
            <app-skeleton-loader [height]="180" [lines]="1" />
          }
        }
        @for (category of categories(); track category.id) {
          <a
            class="fade-in group relative block overflow-hidden rounded-lg bg-charcoal"
            [routerLink]="['/category', category.slug]"
          >
            <img
              class="h-52 w-full object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-85"
              [src]="category.image_url"
              [alt]="category.name"
              loading="lazy"
            />
            <div class="absolute inset-x-0 bottom-0 p-4 text-cream">
              <h3 class="font-serif text-xl">{{ category.name }}</h3>
              <p class="text-xs text-cream/70">
                {{ 'catalog.results' | translate: { count: category.product_count } }}
                @if (category.children.length) {
                  · {{ category.children.length }} {{ 'catalog.subcategories' | translate }}
                }
              </p>
            </div>
          </a>
        }
      </div>
    </section>

    <section class="bg-white py-14">
      <div class="section">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-serif text-4xl">{{ 'home.featured' | translate }}</h2>
            <p class="mt-2 text-charcoal/60">{{ 'home.featuredLead' | translate }}</p>
          </div>
          <a class="text-sm font-semibold text-gold hover:underline" routerLink="/search">
            {{ 'nav.viewAll' | translate }} →
          </a>
        </div>
        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (product of featured(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      </div>
    </section>

    <section class="section-y">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="font-serif text-4xl">{{ 'home.newArrivals' | translate }}</h2>
          <p class="mt-2 text-charcoal/60">{{ 'home.newArrivalsLead' | translate }}</p>
        </div>
        <a class="text-sm font-semibold text-gold hover:underline" routerLink="/search" [queryParams]="{ sort: 'newest' }">
          {{ 'nav.viewAll' | translate }} →
        </a>
      </div>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        @for (product of newArrivals(); track product.id) {
          <app-product-card [product]="product" />
        }
      </div>
    </section>

    <section class="bg-white py-14">
      <div class="section">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-serif text-4xl">{{ 'home.bestsellers' | translate }}</h2>
            <p class="mt-2 text-charcoal/60">{{ 'home.bestsellersLead' | translate }}</p>
          </div>
          <a class="text-sm font-semibold text-gold hover:underline" routerLink="/search" [queryParams]="{ sort: 'popular' }">
            {{ 'nav.viewAll' | translate }} →
          </a>
        </div>
        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (product of bestsellers(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      </div>
    </section>

    <section class="section-y">
      <h2 class="font-serif text-4xl">{{ 'home.testimonials' | translate }}</h2>
      <div class="mt-8 grid gap-6 md:grid-cols-3">
        @for (item of testimonials; track item.author) {
          <figure class="card">
            <blockquote class="text-charcoal/80">“{{ item.quote }}”</blockquote>
            <figcaption class="mt-4 text-sm font-semibold">
              {{ item.author }} <span class="font-normal text-charcoal/50">· {{ item.city }}</span>
            </figcaption>
          </figure>
        }
      </div>
    </section>
  `
})
export class HomePage {
  private readonly api = inject(ProductService);
  private readonly language = inject(LanguageService);
  readonly categories = signal<CategoryNode[]>([]);
  readonly featured = signal<Product[]>([]);
  readonly newArrivals = signal<Product[]>([]);
  readonly bestsellers = signal<Product[]>([]);
  readonly benefits = ['benefit1', 'benefit2', 'benefit3', 'benefit4'];
  readonly skeletons = [1, 2, 3, 4];

  readonly testimonials: Testimonial[] = [
    { quote: 'Isporuka je stigla za dva dana, pakovanje besprekorno.', author: 'Jelena M.', city: 'Beograd' },
    { quote: 'Kvalitet kože je odličan, torbu nosim svakodnevno već godinu dana.', author: 'Nikola P.', city: 'Novi Sad' },
    { quote: 'Zamena veličine je prošla bez ijednog pitanja. Preporučujem.', author: 'Milica S.', city: 'Niš' }
  ];

  constructor() {
    // Reading the language signal inside an effect reloads the localized copy
    // when the switcher changes it, with no page reload.
    effect(() => {
      this.language.lang();
      this.load();
    }, { allowSignalWrites: true });
  }

  private load() {
    this.api.categoryTree().subscribe({ next: (tree) => this.categories.set(tree), error: () => undefined });
    this.api
      .list({ featured: true, page_size: 4, in_stock: true })
      .subscribe({ next: (page) => this.featured.set(page.items), error: () => undefined });
    this.api
      .list({ sort: 'newest', page_size: 4 })
      .subscribe({ next: (page) => this.newArrivals.set(page.items), error: () => undefined });
    this.api
      .list({ sort: 'popular', page_size: 4 })
      .subscribe({ next: (page) => this.bestsellers.set(page.items), error: () => undefined });
  }
}
