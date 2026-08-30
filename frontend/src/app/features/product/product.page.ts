import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Product, ReviewPage, Variant } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { LanguageService } from '../../core/services/language.service';
import { ProductService } from '../../core/services/product.service';
import { ReviewService } from '../../core/services/review.service';
import { ToastService } from '../../core/services/toast.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { DEFAULT_IMAGE_FALLBACK, ImageFallbackDirective } from '../../shared/image-fallback.directive';
import { PricePipe } from '../../shared/price.pipe';
import { ProductCardComponent } from '../../shared/product-card.component';
import { EmptyStateComponent, SkeletonLoaderComponent, StarRatingComponent } from '../../shared/ui.component';

type Tab = 'description' | 'specs' | 'reviews' | 'shipping';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TranslateModule,
    ProductCardComponent,
    StarRatingComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
    ImageFallbackDirective,
    PricePipe,
    DatePipe
  ],
  template: `
    @if (loading()) {
      <div class="section-y grid gap-10 lg:grid-cols-2">
        <app-skeleton-loader [height]="520" [lines]="0" />
        <app-skeleton-loader [height]="200" [lines]="6" />
      </div>
    } @else {
      @if (product(); as p) {
      <div class="section-y">
        <nav class="flex flex-wrap items-center gap-2 text-xs text-charcoal/50" aria-label="Breadcrumb">
          <a routerLink="/" class="hover:text-gold">{{ 'brand' | translate }}</a>
          @if (p.category_slug) {
            <span>/</span>
            <a class="hover:text-gold" [routerLink]="['/category', p.category_slug]">{{ p.category_name }}</a>
          }
          <span>/</span><span class="text-charcoal">{{ p.name }}</span>
        </nav>

        <div class="mt-6 grid gap-10 lg:grid-cols-2">
          <div>
            <div class="group overflow-hidden rounded-lg bg-white">
              <img
                class="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-110"
                [src]="activeImage()"
                [alt]="p.name"
                appImageFallback
              />
            </div>
            @if (p.images.length > 1) {
              <div class="mt-3 grid grid-cols-4 gap-3">
                @for (image of p.images; track image.id) {
                  <button
                    type="button"
                    class="overflow-hidden rounded border-2 transition"
                    [class]="activeImage() === image.image_url ? 'border-gold' : 'border-transparent hover:border-charcoal/20'"
                    (click)="activeImage.set(image.image_url)"
                  >
                    <img class="aspect-square w-full object-cover" [src]="image.image_url" [alt]="p.name" appImageFallback loading="lazy" />
                  </button>
                }
              </div>
            }
          </div>

          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-charcoal/50">{{ p.brand }}</p>
            <h1 class="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{{ p.name }}</h1>

            @if (p.review_count > 0) {
              <button type="button" class="mt-3 inline-flex" (click)="tab.set('reviews')">
                <app-star-rating [value]="p.average_rating" [count]="p.review_count" />
              </button>
            }

            <div class="mt-5 flex flex-wrap items-baseline gap-3">
              <span class="text-3xl font-semibold">{{ currentPrice() | price }}</span>
              @if (p.discount_price !== null) {
                <span class="text-lg text-charcoal/45 line-through">{{ p.price | price }}</span>
                <span class="rounded bg-charcoal px-2 py-1 text-xs font-semibold text-cream">−{{ p.discount_percent }}%</span>
              }
            </div>
            <p class="mt-6 leading-7 text-charcoal/75">{{ p.description }}</p>

            @if (p.variants.length) {
              <div class="mt-7 space-y-4">
                @if (sizes().length) {
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'product.size' | translate }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      @for (size of sizes(); track size) {
                        <button
                          type="button"
                          class="chip"
                          [class.chip-active]="selectedSize() === size"
                          (click)="selectSize(size)"
                        >
                          {{ size }}
                        </button>
                      }
                    </div>
                  </div>
                }
                @if (colors().length) {
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'product.color' | translate }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      @for (color of colors(); track color) {
                        <button
                          type="button"
                          class="chip"
                          [class.chip-active]="selectedColor() === color"
                          [disabled]="!colorAvailable(color)"
                          [class.opacity-40]="!colorAvailable(color)"
                          (click)="selectColor(color)"
                        >
                          {{ color }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            <div class="mt-6 text-sm">
              @if (availableStock() <= 0) {
                <p class="font-semibold text-red-700">{{ 'product.outOfStock' | translate }}</p>
              } @else if (availableStock() <= 5) {
                <p class="font-semibold text-amber-700">
                  {{ 'product.lowStock' | translate: { count: availableStock() } }}
                </p>
              } @else {
                <p class="text-green-700">{{ 'product.inStock' | translate }}</p>
              }
              @if (selectedVariant(); as variant) {
                <p class="mt-1 text-xs text-charcoal/50">{{ 'product.sku' | translate }}: {{ variant.sku }}</p>
              }
            </div>

            <div class="mt-6 flex flex-wrap items-end gap-3">
              <label class="w-24">
                <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                  {{ 'product.quantity' | translate }}
                </span>
                <input
                  class="field mt-1"
                  type="number"
                  min="1"
                  [max]="availableStock() || 1"
                  [value]="quantity()"
                  (change)="setQuantity($any($event.target).valueAsNumber)"
                />
              </label>
              <button
                type="button"
                class="btn-primary flex-1 sm:flex-none"
                [disabled]="!canAddToCart()"
                (click)="addToCart()"
              >
                {{ (p.variants.length && !selectedVariant() ? 'product.chooseVariant' : 'product.addToCart') | translate }}
              </button>
              <button type="button" class="btn-secondary" (click)="toggleWishlist()">
                {{ (saved() ? 'product.wishlistRemove' : 'product.wishlistAdd') | translate }}
              </button>
            </div>
          </div>
        </div>

        <section class="mt-14">
          <div class="flex gap-1 overflow-x-auto border-b border-charcoal/15" role="tablist">
            @for (item of tabs; track item) {
              <button
                type="button"
                role="tab"
                class="tab"
                [class.tab-active]="tab() === item"
                [attr.aria-selected]="tab() === item"
                (click)="tab.set(item)"
              >
                {{ tabLabel(item) | translate }}
                @if (item === 'reviews' && p.review_count) {
                  <span class="ml-1 text-xs text-charcoal/40">({{ p.review_count }})</span>
                }
              </button>
            }
          </div>

          <div class="py-8">
            @switch (tab()) {
              @case ('description') {
                <p class="max-w-3xl leading-7 text-charcoal/80">{{ p.description }}</p>
              }
              @case ('specs') {
                <dl class="max-w-2xl divide-y divide-charcoal/10">
                  @for (entry of specEntries(); track entry[0]) {
                    <div class="flex justify-between gap-6 py-3 text-sm">
                      <dt class="text-charcoal/55">{{ entry[0] }}</dt>
                      <dd class="text-right font-medium">{{ entry[1] }}</dd>
                    </div>
                  }
                  <div class="flex justify-between gap-6 py-3 text-sm">
                    <dt class="text-charcoal/55">{{ 'product.brand' | translate }}</dt>
                    <dd class="text-right font-medium">{{ p.brand }}</dd>
                  </div>
                </dl>
              }
              @case ('shipping') {
                <div class="max-w-2xl space-y-3 text-charcoal/80">
                  <p>{{ 'product.shippingText' | translate }}</p>
                  <p>{{ 'product.returnsText' | translate }}</p>
                </div>
              }
              @case ('reviews') {
                <div class="grid gap-10 lg:grid-cols-[18rem_1fr]">
                  <div>
                    @if (reviews(); as data) {
                      <p class="font-serif text-5xl">{{ data.average_rating.toFixed(1) }}</p>
                      <app-star-rating [value]="data.average_rating" [showValue]="false" />
                      <p class="mt-1 text-sm text-charcoal/55">
                        {{ 'product.reviewCount' | translate: { count: data.total } }}
                      </p>
                      <div class="mt-4 space-y-1">
                        @for (star of starKeys; track star) {
                          <div class="flex items-center gap-2 text-xs">
                            <span class="w-6 text-charcoal/55">{{ star }}★</span>
                            <div class="h-2 flex-1 overflow-hidden rounded bg-charcoal/10">
                              <div class="h-full bg-gold" [style.width.%]="barWidth(star)"></div>
                            </div>
                            <span class="w-6 text-right text-charcoal/45">{{ data.breakdown[star] || 0 }}</span>
                          </div>
                        }
                      </div>
                    }

                    <div class="mt-8">
                      @if (!auth.isAuthenticated()) {
                        <p class="text-sm text-charcoal/60">{{ 'product.reviewLogin' | translate }}</p>
                        <a class="btn-secondary mt-3" routerLink="/login" [queryParams]="{ returnUrl: '/product/' + p.slug }">
                          {{ 'auth.login' | translate }}
                        </a>
                      } @else if (!canReview()) {
                        <p class="text-sm text-charcoal/60">{{ 'product.reviewNeedsPurchase' | translate }}</p>
                      } @else {
                        <h3 class="font-serif text-xl">{{ 'product.writeReview' | translate }}</h3>
                        <form class="mt-3 space-y-3" [formGroup]="reviewForm" (ngSubmit)="submitReview()">
                          <div>
                            <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                              {{ 'product.reviewRating' | translate }}
                            </span>
                            <div class="mt-1 flex gap-1">
                              @for (star of starChoices; track star) {
                                <button
                                  type="button"
                                  class="text-2xl transition"
                                  [class]="star <= reviewForm.value.rating! ? 'text-gold' : 'text-charcoal/25'"
                                  [attr.aria-label]="star + '/5'"
                                  (click)="reviewForm.patchValue({ rating: star })"
                                >
                                  ★
                                </button>
                              }
                            </div>
                          </div>
                          <label class="block">
                            <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                              {{ 'product.reviewComment' | translate }}
                            </span>
                            <textarea class="field mt-1" rows="4" formControlName="comment"></textarea>
                          </label>
                          <button class="btn-primary w-full" type="submit" [disabled]="reviewForm.invalid">
                            {{ 'product.reviewSubmit' | translate }}
                          </button>
                        </form>
                      }
                    </div>
                  </div>

                  <div>
                    @if ((reviews()?.items ?? []).length === 0) {
                      <app-empty-state [title]="'product.noReviews' | translate" />
                    } @else {
                      <ul class="space-y-6">
                        @for (review of reviews()?.items ?? []; track review.id) {
                          <li class="border-b border-charcoal/10 pb-6 last:border-0">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <p class="font-semibold">{{ review.author }}</p>
                              <span class="text-xs text-charcoal/45">{{ review.created_at | date: 'mediumDate' }}</span>
                            </div>
                            <app-star-rating class="mt-1" [value]="review.rating" [showValue]="false" />
                            @if (review.comment) {
                              <p class="mt-2 text-charcoal/75">{{ review.comment }}</p>
                            }
                          </li>
                        }
                      </ul>
                    }
                  </div>
                </div>
              }
            }
          </div>
        </section>

        @if (related().length) {
          <section class="mt-8">
            <h2 class="font-serif text-3xl">{{ 'product.related' | translate }}</h2>
            <div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              @for (item of related(); track item.id) {
                <app-product-card [product]="item" />
              }
            </div>
          </section>
        }
      </div>
      } @else {
      <div class="section-y">
        <app-empty-state [title]="'product.notFound' | translate">
          <a class="btn-primary" routerLink="/search">{{ 'cart.emptyCta' | translate }}</a>
        </app-empty-state>
      </div>
      }
    }
  `
})
export class ProductPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProductService);
  private readonly reviewApi = inject(ReviewService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly language = inject(LanguageService);
  readonly auth = inject(AuthService);

  readonly product = signal<Product | null>(null);
  readonly related = signal<Product[]>([]);
  readonly reviews = signal<ReviewPage | null>(null);
  readonly loading = signal(true);
  readonly activeImage = signal('');
  readonly selectedSize = signal<string | null>(null);
  readonly selectedColor = signal<string | null>(null);
  readonly quantity = signal(1);
  readonly tab = signal<Tab>('description');
  readonly canReview = signal(false);
  private readonly reviewableOrders = signal<number[]>([]);
  /** Non-reactive: the slug currently on screen, used by the language effect. */
  private loadedSlug: string | null = null;

  readonly tabs: Tab[] = ['description', 'specs', 'reviews', 'shipping'];
  readonly starKeys = ['5', '4', '3', '2', '1'];
  readonly starChoices = [1, 2, 3, 4, 5];

  readonly reviewForm = this.fb.nonNullable.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['']
  });

  readonly sizes = computed(() => this.distinct(this.product()?.variants.map((v) => v.size)));
  readonly colors = computed(() => this.distinct(this.product()?.variants.map((v) => v.color)));

  readonly selectedVariant = computed<Variant | null>(() => {
    const variants = this.product()?.variants ?? [];
    if (!variants.length) return null;
    const size = this.selectedSize();
    const color = this.selectedColor();
    // Only a fully specified combination identifies one variant.
    if (this.sizes().length && !size) return null;
    if (this.colors().length && !color) return null;
    return variants.find((v) => (!size || v.size === size) && (!color || v.color === color)) ?? null;
  });

  readonly currentPrice = computed(() => {
    const product = this.product();
    if (!product) return 0;
    return product.effective_price + (this.selectedVariant()?.extra_price ?? 0);
  });

  readonly availableStock = computed(() => {
    const product = this.product();
    if (!product) return 0;
    const variant = this.selectedVariant();
    // A variant draws from the product's stock, so the tighter of the two applies.
    return variant ? Math.min(product.stock_quantity, variant.stock_quantity) : product.stock_quantity;
  });

  readonly canAddToCart = computed(() => {
    const product = this.product();
    if (!product) return false;
    if (product.variants.length && !this.selectedVariant()) return false;
    return this.availableStock() > 0;
  });

  readonly specEntries = computed(() => Object.entries(this.product()?.specs ?? {}));
  readonly saved = computed(() => {
    const product = this.product();
    return product ? this.wishlist.has(product.id) : false;
  });

  constructor() {
    // Re-fetch on a language switch so the description and specs follow the header.
    // `loadedSlug` is a plain field on purpose: reading the product signal here
    // would re-trigger this effect on every fetch and loop forever.
    effect(
      () => {
        this.language.lang();
        if (this.loadedSlug) this.fetch(this.loadedSlug);
      },
      { allowSignalWrites: true }
    );

    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) return;
      this.fetch(slug);
    });
  }

  private fetch(slug: string) {
    {
      this.loadedSlug = slug;
      this.loading.set(true);
      this.resetSelection();
      this.api.detail(slug).subscribe({
        next: (product) => {
          this.product.set(product);
          this.activeImage.set(product.images[0]?.image_url || DEFAULT_IMAGE_FALLBACK);
          this.preselectVariant(product);
          this.loading.set(false);
          this.api.related(product.id).subscribe({ next: (items) => this.related.set(items), error: () => undefined });
          this.loadReviews(product.id);
          if (this.auth.isAuthenticated()) {
            this.reviewApi.eligibility(product.id).subscribe({
              next: (result) => {
                this.canReview.set(result.can_review);
                this.reviewableOrders.set(result.order_ids);
              },
              error: () => this.canReview.set(false)
            });
          }
        },
        error: () => {
          this.product.set(null);
          this.loading.set(false);
        }
      });
    }
  }

  private resetSelection() {
    this.selectedSize.set(null);
    this.selectedColor.set(null);
    this.quantity.set(1);
    this.tab.set('description');
    this.canReview.set(false);
    this.reviews.set(null);
  }

  /** Preselect the first combination that is actually in stock, so the page is usable at once. */
  private preselectVariant(product: Product) {
    const stocked = product.variants.find((variant) => variant.stock_quantity > 0) ?? product.variants[0];
    if (!stocked) return;
    this.selectedSize.set(stocked.size);
    this.selectedColor.set(stocked.color);
  }

  private distinct(values: (string | null)[] | undefined): string[] {
    return [...new Set((values ?? []).filter((value): value is string => Boolean(value)))];
  }

  private loadReviews(productId: number) {
    this.reviewApi.list(productId).subscribe({
      next: (page) => this.reviews.set(page),
      error: () => this.reviews.set(null)
    });
  }

  tabLabel(tab: Tab) {
    return `product.tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
  }

  barWidth(star: string) {
    const data = this.reviews();
    if (!data || !data.total) return 0;
    const approved = Object.values(data.breakdown).reduce((sum, value) => sum + value, 0);
    return approved ? ((data.breakdown[star] || 0) / approved) * 100 : 0;
  }

  selectSize(size: string) {
    this.selectedSize.set(size);
    // The chosen colour may not be offered in the new size. Without this the
    // combination resolves to no variant and the Add button stays disabled with
    // nothing on screen explaining why, so move to a colour that does exist.
    if (!this.colorAvailable(this.selectedColor() ?? '')) {
      const fallback = (this.product()?.variants ?? []).find((v) => v.size === size && v.stock_quantity > 0)
        ?? (this.product()?.variants ?? []).find((v) => v.size === size);
      this.selectedColor.set(fallback?.color ?? null);
    }
    this.clampQuantity();
  }

  selectColor(color: string) {
    if (!this.colorAvailable(color)) return;
    this.selectedColor.set(color);
    this.clampQuantity();
  }

  /** A colour only counts as available if it exists for the size already chosen. */
  colorAvailable(color: string) {
    const size = this.selectedSize();
    return (this.product()?.variants ?? []).some((v) => v.color === color && (!size || v.size === size));
  }

  setQuantity(value: number) {
    if (!Number.isFinite(value)) return;
    this.quantity.set(Math.max(1, Math.min(Math.trunc(value), Math.max(this.availableStock(), 1))));
  }

  private clampQuantity() {
    this.setQuantity(this.quantity());
  }

  addToCart() {
    const product = this.product();
    if (!product || !this.canAddToCart()) return;
    this.cart.add(product.id, this.selectedVariant()?.id ?? null, this.quantity()).subscribe({
      next: () => this.toast.show(this.translate.instant('product.addedToCart')),
      error: (error: { error?: { detail?: string } }) =>
        this.toast.error(error.error?.detail ?? this.translate.instant('common.error'))
    });
  }

  toggleWishlist() {
    const product = this.product();
    if (!product) return;
    if (!this.auth.isAuthenticated()) {
      this.toast.error(this.translate.instant('product.wishlistLogin'));
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/product/${product.slug}` } });
      return;
    }
    const wasSaved = this.saved();
    const request = wasSaved ? this.wishlist.remove(product.id) : this.wishlist.add(product.id);
    request.subscribe({
      next: () =>
        this.toast.show(this.translate.instant(wasSaved ? 'product.wishlistRemoved' : 'product.wishlistAdded')),
      error: () => this.toast.error(this.translate.instant('common.error'))
    });
  }

  submitReview() {
    const product = this.product();
    const orderId = this.reviewableOrders()[0];
    if (!product || this.reviewForm.invalid || !orderId) return;
    const value = this.reviewForm.getRawValue();
    this.reviewApi
      .create(product.id, { order_id: orderId, rating: value.rating, comment: value.comment.trim() || null })
      .subscribe({
        next: () => {
          this.toast.show(this.translate.instant('product.reviewSent'));
          this.reviewForm.reset({ rating: 5, comment: '' });
          this.canReview.set(false);
          this.loadReviews(product.id);
        },
        error: (error: { error?: { detail?: string } }) =>
          this.toast.error(error.error?.detail ?? this.translate.instant('common.error'))
      });
  }
}
