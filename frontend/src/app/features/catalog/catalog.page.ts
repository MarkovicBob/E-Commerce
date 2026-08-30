import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, debounceTime } from 'rxjs';
import { CategoryDetail, CategoryNode, Facets, Product } from '../../core/models';
import { LanguageService } from '../../core/services/language.service';
import { ProductService } from '../../core/services/product.service';
import { PricePipe } from '../../shared/price.pipe';
import { ProductCardComponent } from '../../shared/product-card.component';
import { EmptyStateComponent, PaginationComponent, SkeletonLoaderComponent } from '../../shared/ui.component';

const PAGE_SIZE = 12;

@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ProductCardComponent,
    PaginationComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
    PricePipe
  ],
  template: `
    <div class="section-y">
      <nav class="flex flex-wrap items-center gap-2 text-xs text-charcoal/50" aria-label="Breadcrumb">
        <a routerLink="/" class="hover:text-gold">{{ 'brand' | translate }}</a>
        @for (crumb of category()?.breadcrumb ?? []; track crumb.id) {
          <span>/</span>
          <a class="hover:text-gold" [routerLink]="['/category', crumb.slug]">{{ crumb.name }}</a>
        }
        @if (category(); as current) {
          <span>/</span><span class="text-charcoal">{{ current.name }}</span>
        }
      </nav>

      <header class="mt-3">
        <h1 class="font-serif text-4xl">
          @if (category(); as current) {
            {{ current.name }}
          } @else if (searchTerm()) {
            {{ 'catalog.searchFor' | translate: { query: searchTerm() } }}
          } @else {
            {{ 'catalog.title' | translate }}
          }
        </h1>
        @if (category()?.description; as description) {
          <p class="mt-2 max-w-2xl text-charcoal/60">{{ description }}</p>
        }
      </header>

      @if ((category()?.children ?? []).length) {
        <div class="mt-6 flex flex-wrap gap-2">
          @for (child of category()?.children ?? []; track child.id) {
            <a class="chip" [routerLink]="['/category', child.slug]">{{ child.name }}</a>
          }
        </div>
      }

      <div class="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside class="lg:sticky lg:top-24 lg:self-start">
          <button
            type="button"
            class="btn-secondary mb-4 w-full lg:hidden"
            [attr.aria-expanded]="filtersOpen()"
            (click)="filtersOpen.set(!filtersOpen())"
          >
            {{ 'catalog.filters' | translate }}
          </button>

          <div [class.hidden]="!filtersOpen()" class="space-y-6 lg:block">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-xl">{{ 'catalog.filters' | translate }}</h2>
              @if (hasActiveFilters()) {
                <button type="button" class="text-xs text-gold hover:underline" (click)="clearFilters()">
                  {{ 'catalog.clearFilters' | translate }}
                </button>
              }
            </div>

            <form [formGroup]="filters" class="space-y-6">
              <fieldset>
                <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  {{ 'catalog.category' | translate }}
                </legend>
                <ul class="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
                  <li>
                    <a class="block py-1 text-sm hover:text-gold" routerLink="/search">{{ 'nav.allCategories' | translate }}</a>
                  </li>
                  @for (root of tree(); track root.id) {
                    <li>
                      <a
                        class="block py-1 text-sm hover:text-gold"
                        [class.font-semibold]="isCurrent(root.slug)"
                        [routerLink]="['/category', root.slug]"
                      >
                        {{ root.name }} <span class="text-xs text-charcoal/40">({{ root.product_count }})</span>
                      </a>
                      @if (isInBranch(root)) {
                        <ul class="ml-3 border-l border-charcoal/10 pl-3">
                          @for (child of root.children; track child.id) {
                            <li>
                              <a
                                class="block py-1 text-sm text-charcoal/70 hover:text-gold"
                                [class.font-semibold]="isCurrent(child.slug)"
                                [routerLink]="['/category', child.slug]"
                              >
                                {{ child.name }} <span class="text-xs text-charcoal/40">({{ child.product_count }})</span>
                              </a>
                              @if (isCurrent(child.slug) || isInBranch(child)) {
                                <ul class="ml-3 border-l border-charcoal/10 pl-3">
                                  @for (leaf of child.children; track leaf.id) {
                                    <li>
                                      <a
                                        class="block py-1 text-xs text-charcoal/60 hover:text-gold"
                                        [class.font-semibold]="isCurrent(leaf.slug)"
                                        [routerLink]="['/category', leaf.slug]"
                                      >
                                        {{ leaf.name }}
                                      </a>
                                    </li>
                                  }
                                </ul>
                              }
                            </li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ul>
              </fieldset>

              <fieldset>
                <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  {{ 'catalog.price' | translate }}
                </legend>
                <div class="mt-2 flex items-center gap-2">
                  <input
                    class="field"
                    type="number"
                    min="0"
                    formControlName="min_price"
                    [placeholder]="'catalog.priceFrom' | translate"
                    [attr.aria-label]="'catalog.priceFrom' | translate"
                  />
                  <span class="text-charcoal/40">–</span>
                  <input
                    class="field"
                    type="number"
                    min="0"
                    formControlName="max_price"
                    [placeholder]="'catalog.priceTo' | translate"
                    [attr.aria-label]="'catalog.priceTo' | translate"
                  />
                </div>
                @if (facets(); as data) {
                  <p class="mt-1 text-xs text-charcoal/45">
                    {{ data.min_price | price }} – {{ data.max_price | price }}
                  </p>
                }
              </fieldset>

              @if ((facets()?.brands ?? []).length) {
                <fieldset>
                  <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'catalog.brand' | translate }}
                  </legend>
                  <div class="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                    @for (brand of facets()?.brands ?? []; track brand.value) {
                      <label class="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          class="accent-gold"
                          [checked]="selectedBrands().includes(brand.value)"
                          (change)="toggleMulti('brand', brand.value)"
                        />
                        <span class="flex-1">{{ brand.value }}</span>
                        <span class="text-xs text-charcoal/40">{{ brand.count }}</span>
                      </label>
                    }
                  </div>
                </fieldset>
              }

              @if ((facets()?.sizes ?? []).length) {
                <fieldset>
                  <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'catalog.size' | translate }}
                  </legend>
                  <div class="mt-2 flex flex-wrap gap-2">
                    @for (size of facets()?.sizes ?? []; track size) {
                      <button
                        type="button"
                        class="chip"
                        [class.chip-active]="selectedSizes().includes(size)"
                        [attr.aria-pressed]="selectedSizes().includes(size)"
                        (click)="toggleMulti('size', size)"
                      >
                        {{ size }}
                      </button>
                    }
                  </div>
                </fieldset>
              }

              @if ((facets()?.colors ?? []).length) {
                <fieldset>
                  <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'catalog.color' | translate }}
                  </legend>
                  <div class="mt-2 flex flex-wrap gap-2">
                    @for (color of facets()?.colors ?? []; track color) {
                      <button
                        type="button"
                        class="chip"
                        [class.chip-active]="selectedColors().includes(color)"
                        [attr.aria-pressed]="selectedColors().includes(color)"
                        (click)="toggleMulti('color', color)"
                      >
                        {{ color }}
                      </button>
                    }
                  </div>
                </fieldset>
              }

              <fieldset>
                <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  {{ 'catalog.rating' | translate }}
                </legend>
                <div class="mt-2 flex flex-wrap gap-2">
                  @for (rating of ratings; track rating) {
                    <button
                      type="button"
                      class="chip"
                      [class.chip-active]="filters.value.min_rating === String(rating)"
                      (click)="setRating(rating)"
                    >
                      {{ 'catalog.ratingAndUp' | translate: { count: rating } }}
                    </button>
                  }
                </div>
              </fieldset>

              <fieldset>
                <legend class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  {{ 'catalog.availability' | translate }}
                </legend>
                <label class="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" class="accent-gold" formControlName="in_stock" />
                  {{ 'catalog.inStockOnly' | translate }}
                </label>
                <label class="mt-1 flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" class="accent-gold" formControlName="on_sale" />
                  {{ 'catalog.onSaleOnly' | translate }}
                </label>
              </fieldset>
            </form>
          </div>
        </aside>

        <div>
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
            <p class="text-sm text-charcoal/60">
              @if (!loading()) {
                {{ 'catalog.results' | translate: { count: total() } }}
              } @else {
                {{ 'common.loading' | translate }}
              }
            </p>
            <label class="flex items-center gap-2 text-sm">
              <span class="text-charcoal/60">{{ 'catalog.sort' | translate }}</span>
              <select class="field w-48" [value]="sort()" (change)="setSort($any($event.target).value)">
                <option value="newest">{{ 'catalog.sortNewest' | translate }}</option>
                <option value="popular">{{ 'catalog.sortPopular' | translate }}</option>
                <option value="price_asc">{{ 'catalog.sortPriceAsc' | translate }}</option>
                <option value="price_desc">{{ 'catalog.sortPriceDesc' | translate }}</option>
                <option value="rating">{{ 'catalog.sortRating' | translate }}</option>
                <option value="name_asc">{{ 'catalog.sortName' | translate }}</option>
              </select>
            </label>
          </div>

          @if (loading()) {
            <div class="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              @for (item of skeletons; track item) {
                <app-skeleton-loader [height]="300" />
              }
            </div>
          } @else if (products().length === 0) {
            <app-empty-state
              class="mt-8 block"
              [title]="'catalog.noResults' | translate"
              [hint]="'catalog.noResultsHint' | translate"
            >
              <button type="button" class="btn-secondary" (click)="clearFilters()">
                {{ 'catalog.clearFilters' | translate }}
              </button>
            </app-empty-state>
          } @else {
            <div class="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              @for (product of products(); track product.id) {
                <app-product-card [product]="product" />
              }
            </div>
            <p class="mt-8 text-center text-xs text-charcoal/50">
              {{ 'catalog.showing' | translate: { from: rangeFrom(), to: rangeTo(), total: total() } }}
            </p>
            <app-pagination [page]="page()" [pages]="pages()" (changed)="setPage($event)" />
          }
        </div>
      </div>
    </div>
  `
})
export class CatalogPage {
  private readonly api = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly language = inject(LanguageService);

  readonly products = signal<Product[]>([]);
  readonly tree = signal<CategoryNode[]>([]);
  readonly category = signal<CategoryDetail | null>(null);
  readonly facets = signal<Facets | null>(null);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly page = signal(1);
  readonly sort = signal('newest');
  readonly searchTerm = signal('');
  readonly loading = signal(true);
  readonly filtersOpen = signal(false);
  readonly ratings = [4, 3, 2];
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly String = String;

  readonly filters = this.fb.nonNullable.group({
    min_price: [''],
    max_price: [''],
    brand: [''],
    size: [''],
    color: [''],
    min_rating: [''],
    in_stock: [false],
    on_sale: [false]
  });

  readonly selectedBrands = computed(() => this.split(this.filtersValue().brand));
  readonly selectedSizes = computed(() => this.split(this.filtersValue().size));
  readonly selectedColors = computed(() => this.split(this.filtersValue().color));
  readonly hasActiveFilters = computed(() => {
    const value = this.filtersValue();
    return Boolean(
      value.min_price || value.max_price || value.brand || value.size || value.color || value.min_rating ||
        value.in_stock || value.on_sale
    );
  });

  /** Mirrors the form into a signal so computed values recalculate on every change. */
  private readonly filtersValue = signal(this.filters.getRawValue());
  readonly rangeFrom = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly rangeTo = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  private categorySlug: string | null = null;
  /** Non-reactive record of the language the current results were fetched in. */
  private lastLang: string | null = null;
  private syncing = false;

  constructor() {
    // Category names and product copy are localized server-side, so a language
    // switch has to refetch rather than just re-render.
    effect(
      () => {
        const lang = this.language.lang();
        // untracked: the loaders read page/sort/search signals, and depending on
        // those here would refire this effect on every ordinary navigation.
        untracked(() => {
          this.api.categoryTree().subscribe({ next: (tree) => this.tree.set(tree), error: () => undefined });
          // The route subscription below already loads on first paint; only a
          // genuine language change needs to refetch.
          if (this.lastLang !== null && this.lastLang !== lang) {
            this.loadCategory();
            this.load();
          }
          this.lastLang = lang;
        });
      },
      { allowSignalWrites: true }
    );

    // The URL is the single source of truth: links, back/forward and filters all flow through it.
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      this.categorySlug = params.get('slug');
      this.searchTerm.set(query.get('q') ?? '');
      this.page.set(Number(query.get('page') ?? 1) || 1);
      this.sort.set(query.get('sort') ?? 'newest');

      this.syncing = true;
      this.filters.patchValue(
        {
          min_price: query.get('min_price') ?? '',
          max_price: query.get('max_price') ?? '',
          brand: query.get('brand') ?? '',
          size: query.get('size') ?? '',
          color: query.get('color') ?? '',
          min_rating: query.get('min_rating') ?? '',
          in_stock: query.get('in_stock') === 'true',
          on_sale: query.get('on_sale') === 'true'
        },
        { emitEvent: false }
      );
      this.syncing = false;
      this.filtersValue.set(this.filters.getRawValue());

      this.loadCategory();
      this.loadFacets();
      this.load();
    });

    this.filters.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      if (this.syncing) return;
      this.filtersValue.set(this.filters.getRawValue());
      // Any filter change resets to page 1, or the user can land on an empty page.
      this.navigate({ page: 1 });
    });
  }

  private split(value: string): string[] {
    return value ? value.split(',').filter(Boolean) : [];
  }

  isCurrent(slug: string) {
    return this.categorySlug === slug;
  }

  /** True when the current category is this node or sits anywhere beneath it. */
  isInBranch(node: CategoryNode): boolean {
    if (!this.categorySlug) return false;
    if (node.slug === this.categorySlug) return true;
    return node.children.some((child) => this.isInBranch(child));
  }

  private loadCategory() {
    if (!this.categorySlug) {
      this.category.set(null);
      return;
    }
    this.api.category(this.categorySlug).subscribe({
      next: (detail) => this.category.set(detail),
      error: () => this.category.set(null)
    });
  }

  private loadFacets() {
    this.api
      .facets({ category: this.categorySlug ?? undefined, search: this.searchTerm() || undefined })
      .subscribe({ next: (facets) => this.facets.set(facets), error: () => this.facets.set(null) });
  }

  private load() {
    this.loading.set(true);
    const value = this.filters.getRawValue();
    this.api
      .list({
        category: this.categorySlug ?? undefined,
        search: this.searchTerm() || undefined,
        min_price: value.min_price || undefined,
        max_price: value.max_price || undefined,
        brand: value.brand || undefined,
        size: value.size || undefined,
        color: value.color || undefined,
        min_rating: value.min_rating || undefined,
        in_stock: value.in_stock || undefined,
        on_sale: value.on_sale || undefined,
        sort: this.sort(),
        page: this.page(),
        page_size: PAGE_SIZE
      })
      .subscribe({
        next: (page) => {
          this.products.set(page.items);
          this.total.set(page.total);
          this.pages.set(page.pages);
          this.loading.set(false);
        },
        error: () => {
          this.products.set([]);
          this.total.set(0);
          this.loading.set(false);
        }
      });
  }

  toggleMulti(key: 'brand' | 'size' | 'color', value: string) {
    const current = this.split(this.filters.getRawValue()[key]);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    this.filters.patchValue({ [key]: next.join(',') });
  }

  setRating(rating: number) {
    const current = this.filters.getRawValue().min_rating;
    this.filters.patchValue({ min_rating: current === String(rating) ? '' : String(rating) });
  }

  setSort(sort: string) {
    this.navigate({ sort, page: 1 });
  }

  setPage(page: number) {
    this.navigate({ page });
  }

  clearFilters() {
    this.filters.reset(
      { min_price: '', max_price: '', brand: '', size: '', color: '', min_rating: '', in_stock: false, on_sale: false },
      { emitEvent: false }
    );
    this.filtersValue.set(this.filters.getRawValue());
    this.navigate({ page: 1 });
  }

  /** Writes the whole filter state into the URL; empty values are dropped so links stay short. */
  private navigate(overrides: Params) {
    const value = this.filters.getRawValue();
    const queryParams: Params = {
      q: this.searchTerm() || null,
      sort: this.sort() === 'newest' ? null : this.sort(),
      page: this.page() === 1 ? null : this.page(),
      min_price: value.min_price || null,
      max_price: value.max_price || null,
      brand: value.brand || null,
      size: value.size || null,
      color: value.color || null,
      min_rating: value.min_rating || null,
      in_stock: value.in_stock ? 'true' : null,
      on_sale: value.on_sale ? 'true' : null,
      ...overrides
    };
    if (queryParams['page'] === 1) queryParams['page'] = null;
    if (queryParams['sort'] === 'newest') queryParams['sort'] = null;
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
