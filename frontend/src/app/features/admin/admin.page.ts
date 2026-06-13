import { Component, inject, signal } from '@angular/core';
import { AdminService } from '../../core/services/admin.service';

@Component({ standalone: true, template: `<section class="section"><h1 class="font-serif text-4xl">Admin dashboard</h1><div class="mt-8 grid gap-4 md:grid-cols-4">@for (item of statEntries(); track item[0]) { <div class="rounded bg-white p-5"><p class="text-sm uppercase text-charcoal/50">{{ item[0] }}</p><p class="mt-2 text-2xl font-semibold">{{ item[1] }}</p></div> }</div><div class="mt-8 rounded bg-white p-5"><h2 class="font-serif text-2xl">CRUD areas</h2><p class="mt-3 text-sm">Products, categories, orders, users, reviews, blog and promo codes use the admin API endpoints and protected guard.</p></div></section>` })
export class AdminPage {
  private readonly admin = inject(AdminService); readonly stats = signal<Record<string, unknown>>({});
  readonly statEntries = () => Object.entries(this.stats()).filter(([, value]) => typeof value !== 'object');
  constructor() { this.admin.stats().subscribe((stats) => this.stats.set(stats)); }
}
