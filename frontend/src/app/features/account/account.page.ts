import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { ReferralService } from '../../core/services/referral.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  standalone: true,
  imports: [ProductCardComponent, JsonPipe],
  template: `
    <section class="section">
      <h1 class="font-serif text-4xl">Account</h1><p class="mt-2">{{ auth.user()?.full_name }} · {{ auth.user()?.email }}</p>
      <div class="mt-8 grid gap-6 lg:grid-cols-3">
        <div class="rounded bg-white p-5"><h2 class="font-serif text-2xl">Orders</h2><pre class="mt-3 whitespace-pre-wrap text-xs">{{ orders() | json }}</pre></div>
        <div class="rounded bg-white p-5"><h2 class="font-serif text-2xl">Referral</h2><p class="mt-3">{{ referral()?.referral_code }}</p><button class="btn-secondary mt-4" (click)="copyReferral()">Copy</button></div>
        <div class="rounded bg-white p-5"><h2 class="font-serif text-2xl">Profile & addresses</h2><p class="mt-3 text-sm">Profile, addresses and reviews tabs live here.</p></div>
      </div>
      <h2 class="mt-10 font-serif text-3xl">Wishlist</h2><div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">@for (product of wishlist.items(); track product.id) { <app-product-card [product]="product" /> }</div>
    </section>
  `
})
export class AccountPage {
  readonly auth = inject(AuthService); readonly wishlist = inject(WishlistService); private readonly orderApi = inject(OrderService); private readonly referralApi = inject(ReferralService);
  readonly orders = signal<unknown[]>([]); readonly referral = signal<{ referral_code: string; referral_link: string } | null>(null);
  constructor() { this.orderApi.mine().subscribe((orders) => this.orders.set(orders)); this.referralApi.me().subscribe((r) => this.referral.set(r)); this.wishlist.load().subscribe(); }
  copyReferral() { navigator.clipboard.writeText(this.referral()?.referral_code ?? ''); }
}
