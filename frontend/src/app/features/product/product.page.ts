import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Product, ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { StarRatingComponent } from '../../shared/ui.component';

@Component({
  standalone: true,
  imports: [ProductCardComponent, StarRatingComponent],
  template: `
    @if (product(); as p) {
      <section class="section grid gap-10 lg:grid-cols-2">
        <div class="grid gap-3 sm:grid-cols-4">
          <img class="col-span-4 aspect-[4/5] w-full rounded object-cover" [src]="heroImage(p)" [alt]="p.name">
          @for (image of p.images; track image.image_url) { <img class="aspect-square rounded object-cover" [src]="image.image_url" [alt]="p.name"> }
        </div>
        <div>
          <p class="text-sm uppercase text-charcoal/60">{{ p.brand }}</p>
          <h1 class="mt-2 font-serif text-5xl">{{ p.name }}</h1>
          <app-star-rating [value]="p.average_rating" />
          <p class="mt-5 text-2xl font-semibold">{{ p.discount_price || p.price }} RSD</p>
          <p class="mt-6 leading-7 text-charcoal/75">{{ p.description }}</p>
          <p class="mt-4 text-sm">Stock: {{ p.stock_quantity }}</p>
          <div class="mt-8 flex gap-3"><button class="btn-primary" (click)="cart.add(p.id).subscribe()">Add to cart</button><button class="btn-secondary" (click)="wishlist.add(p.id).subscribe()">Wishlist</button></div>
        </div>
      </section>
      <section class="section"><h2 class="font-serif text-3xl">Related</h2><div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">@for (item of related(); track item.id) { <app-product-card [product]="item" /> }</div></section>
    }
  `
})
export class ProductPage {
  private readonly route = inject(ActivatedRoute);
  private readonly products = inject(ProductService);
  readonly cart = inject(CartService);
  readonly wishlist = inject(WishlistService);
  readonly product = signal<Product | null>(null);
  readonly related = signal<Product[]>([]);
  constructor() {
    this.route.paramMap.subscribe((params) => this.products.detail(params.get('slug')!).subscribe((p) => { this.product.set(p); this.products.related(p.id).subscribe((r) => this.related.set(r)); }));
  }
  heroImage(product: Product) { return product.images.length ? product.images[0].image_url : 'https://images.unsplash.com/900x1200/?luxury,product'; }
}
