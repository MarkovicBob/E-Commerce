import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ProductCardComponent } from '../../shared/product-card.component';
import { Product, ProductService } from '../../core/services/product.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, ProductCardComponent],
  template: `
    <section class="section grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside class="space-y-4" [formGroup]="filters">
        <input class="field" placeholder="Search" formControlName="search">
        <input class="field" placeholder="Min price" type="number" formControlName="min_price">
        <input class="field" placeholder="Max price" type="number" formControlName="max_price">
        <select class="field" formControlName="brand"><option value="">Brand</option>@for (brand of brands(); track brand) { <option [value]="brand">{{ brand }}</option> }</select>
        <select class="field" formControlName="sort"><option value="newest">Newest</option><option value="price_asc">Price up</option><option value="price_desc">Price down</option><option value="rating">Rating</option></select>
      </aside>
      <div>
        <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          @for (product of products(); track product.id) { <app-product-card [product]="product" /> }
        </div>
        <div class="mt-8 text-sm">{{ total() }} products</div>
      </div>
    </section>
  `
})
export class CatalogPage {
  private readonly api = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly products = signal<Product[]>([]);
  readonly brands = signal<string[]>([]);
  readonly total = signal(0);
  readonly filters = this.fb.nonNullable.group({ search: [''], min_price: [''], max_price: [''], brand: [''], sort: ['newest'] });
  constructor() {
    this.api.brands().subscribe((brands) => this.brands.set(brands));
    this.filters.valueChanges.pipe(debounceTime(250)).subscribe(() => this.load());
    this.route.paramMap.subscribe(() => this.load());
  }
  load() {
    const category = this.route.snapshot.paramMap.get('slug') ?? undefined;
    this.api.list({ ...this.filters.getRawValue(), category }).subscribe((page) => { this.products.set(page.items); this.total.set(page.total); });
  }
}
