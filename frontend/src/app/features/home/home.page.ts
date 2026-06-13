import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ProductCardComponent } from '../../shared/product-card.component';
import { Product, ProductService } from '../../core/services/product.service';

@Component({
  standalone: true,
  imports: [TranslateModule, ProductCardComponent],
  template: `
    <section class="min-h-[78vh] bg-[url('https://images.unsplash.com/photo-1496747611176-843222e1e57c')] bg-cover bg-center">
      <div class="section flex min-h-[78vh] items-center">
        <div class="max-w-2xl text-cream drop-shadow">
          <h1 class="font-serif text-5xl font-bold sm:text-7xl">{{ 'home.hero' | translate }}</h1>
          <p class="mt-5 text-lg">{{ 'home.lead' | translate }}</p>
          <a class="btn-primary mt-8" href="/search">{{ 'home.cta' | translate }}</a>
        </div>
      </div>
    </section>
    <section class="section">
      <h2 class="font-serif text-4xl">{{ 'home.featured' | translate }}</h2>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        @for (product of products(); track product.id) { <app-product-card [product]="product" /> }
      </div>
    </section>
  `
})
export class HomePage {
  private readonly productsApi = inject(ProductService);
  readonly products = signal<Product[]>([]);
  constructor() { this.productsApi.list({ sort: 'newest', page_size: 8 }).subscribe((page) => this.products.set(page.items)); }
}
