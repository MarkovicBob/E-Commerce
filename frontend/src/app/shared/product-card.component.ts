import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/services/product.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="fade-in group">
      <a [routerLink]="['/product', product.slug]" class="block overflow-hidden rounded bg-white">
        <img class="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" [src]="imageUrl" [alt]="product.name">
      </a>
      <div class="mt-3">
        <p class="text-xs uppercase text-charcoal/60">{{ product.brand }}</p>
        <h3 class="font-serif text-xl">{{ product.name }}</h3>
        <p class="mt-1 font-semibold">{{ product.discount_price || product.price }} RSD</p>
      </div>
    </article>
  `
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  get imageUrl() { return this.product.images.length ? this.product.images[0].image_url : 'https://images.unsplash.com/900x1200/?luxury,product'; }
}
