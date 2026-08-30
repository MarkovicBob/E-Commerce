import { Component, inject, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Product } from '../core/models';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { WishlistService } from '../core/services/wishlist.service';
import { DEFAULT_IMAGE_FALLBACK, ImageFallbackDirective } from './image-fallback.directive';
import { PricePipe } from './price.pipe';
import { StarRatingComponent } from './ui.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, TranslateModule, PricePipe, StarRatingComponent, ImageFallbackDirective],
  template: `
    <article class="fade-in group flex h-full flex-col">
      <div class="relative overflow-hidden rounded-lg bg-white">
        <a [routerLink]="['/product', product.slug]" class="block">
          <img
            class="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
            [src]="imageUrl"
            [alt]="product.name"
            appImageFallback
            loading="lazy"
          />
        </a>
        @if (product.discount_percent > 0) {
          <span class="absolute left-3 top-3 rounded bg-charcoal px-2 py-1 text-xs font-semibold text-cream">
            −{{ product.discount_percent }}%
          </span>
        }
        @if (!product.in_stock) {
          <span class="absolute right-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-semibold">
            {{ 'product.outOfStock' | translate }}
          </span>
        }
        <button
          type="button"
          class="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white"
          [attr.aria-label]="(saved ? 'product.wishlistRemove' : 'product.wishlistAdd') | translate"
          [attr.aria-pressed]="saved"
          (click)="toggleWishlist()"
        >
          <span [class]="saved ? 'text-gold' : 'text-charcoal/40'">{{ saved ? '♥' : '♡' }}</span>
        </button>
      </div>

      <div class="mt-3 flex flex-1 flex-col">
        <p class="text-xs uppercase tracking-wide text-charcoal/50">{{ product.brand }}</p>
        <h3 class="mt-1 font-serif text-lg leading-snug">
          <a [routerLink]="['/product', product.slug]" class="hover:text-gold">{{ product.name }}</a>
        </h3>
        @if (product.review_count > 0) {
          <app-star-rating class="mt-1" [value]="product.average_rating" [count]="product.review_count" />
        }
        <div class="mt-auto flex items-baseline gap-2 pt-3">
          <span class="font-semibold">{{ product.effective_price | price }}</span>
          @if (product.discount_price !== null) {
            <span class="text-sm text-charcoal/45 line-through">{{ product.price | price }}</span>
          }
        </div>
      </div>
    </article>
  `
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;

  private readonly wishlist = inject(WishlistService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  get imageUrl() {
    return this.product.images[0]?.image_url || DEFAULT_IMAGE_FALLBACK;
  }

  get saved() {
    return this.wishlist.has(this.product.id);
  }

  toggleWishlist() {
    if (!this.auth.isAuthenticated()) {
      this.toast.error(this.translate.instant('product.wishlistLogin'));
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const wasSaved = this.saved;
    const request = wasSaved ? this.wishlist.remove(this.product.id) : this.wishlist.add(this.product.id);
    request.subscribe({
      next: () =>
        this.toast.show(this.translate.instant(wasSaved ? 'product.wishlistRemoved' : 'product.wishlistAdded')),
      error: () => this.toast.error(this.translate.instant('common.error'))
    });
  }
}
