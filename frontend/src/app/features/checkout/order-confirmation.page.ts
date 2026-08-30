import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Order } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { OrderService } from '../../core/services/order.service';
import { PricePipe } from '../../shared/price.pipe';

@Component({
  standalone: true,
  imports: [RouterLink, TranslateModule, PricePipe, DatePipe],
  template: `
    <div class="section-y max-w-3xl">
      <div class="text-center">
        <p class="text-4xl">✓</p>
        <h1 class="mt-3 font-serif text-4xl">{{ 'confirmation.title' | translate }}</h1>
        <p class="mt-3 text-charcoal/60">{{ 'confirmation.lead' | translate }}</p>
        <p class="mt-4 text-sm">
          {{ 'confirmation.orderNumber' | translate }}:
          <span class="font-mono font-semibold">{{ orderNumber }}</span>
        </p>
      </div>

      @if (order(); as o) {
        <div class="card mt-8">
          <div class="flex flex-wrap justify-between gap-3 text-sm">
            <span class="text-charcoal/60">{{ o.created_at | date: 'medium' }}</span>
            <span class="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-cream">
              {{ 'status.' + o.status | translate }}
            </span>
          </div>

          <ul class="mt-5 divide-y divide-charcoal/10">
            @for (item of o.items; track item.id) {
              <li class="flex items-center gap-4 py-3">
                @if (item.image_url) {
                  <img class="h-16 w-14 rounded object-cover" [src]="item.image_url" [alt]="item.name" />
                }
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">{{ item.name }}</p>
                  <p class="text-xs text-charcoal/55">
                    {{ item.quantity }} × {{ item.unit_price | price }}
                    @if (item.size) { · {{ item.size }} }
                    @if (item.color) { · {{ item.color }} }
                  </p>
                </div>
                <p class="font-semibold">{{ item.line_total | price }}</p>
              </li>
            }
          </ul>

          <dl class="mt-5 space-y-2 border-t border-charcoal/10 pt-4 text-sm">
            <div class="flex justify-between">
              <dt class="text-charcoal/60">{{ 'cart.subtotal' | translate }}</dt>
              <dd>{{ o.subtotal | price }}</dd>
            </div>
            @if (o.discount_total > 0) {
              <div class="flex justify-between text-green-700">
                <dt>{{ 'cart.discount' | translate }} @if (o.promo_code_used) { ({{ o.promo_code_used }}) }</dt>
                <dd>−{{ o.discount_total | price }}</dd>
              </div>
            }
            <div class="flex justify-between">
              <dt class="text-charcoal/60">{{ 'cart.shipping' | translate }}</dt>
              <dd>{{ o.shipping_cost | price }}</dd>
            </div>
            <div class="flex justify-between border-t border-charcoal/10 pt-2 text-base font-semibold">
              <dt>{{ 'cart.grandTotal' | translate }}</dt>
              <dd>{{ o.total | price }}</dd>
            </div>
          </dl>

          <div class="mt-6 text-sm text-charcoal/70">
            <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
              {{ 'checkout.stepAddress' | translate }}
            </p>
            <p class="mt-1">
              {{ o.shipping_address['full_name'] }}<br />
              {{ o.shipping_address['street'] }}<br />
              {{ o.shipping_address['postal_code'] }} {{ o.shipping_address['city'] }}, {{ o.shipping_address['country'] }}
            </p>
          </div>
        </div>
      } @else if (error()) {
        <p class="mt-8 text-center text-sm text-charcoal/60">{{ error() }}</p>
      }

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a class="btn-primary" routerLink="/search">{{ 'confirmation.continueShopping' | translate }}</a>
        @if (auth.isAuthenticated()) {
          <a class="btn-secondary" routerLink="/account" [queryParams]="{ tab: 'orders' }">
            {{ 'confirmation.viewOrders' | translate }}
          </a>
        }
      </div>
    </div>
  `
})
export class OrderConfirmationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrderService);
  private readonly language = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly order = signal<Order | null>(null);
  readonly error = signal<string | null>(null);
  readonly orderNumber = this.route.snapshot.paramMap.get('orderNumber') ?? '';

  constructor() {
    if (!this.orderNumber) return;
    // A guest receipt needs the email the order was placed with; the API refuses without it.
    const email = this.route.snapshot.queryParamMap.get('email') ?? undefined;
    effect(
      () => {
        this.language.lang();
        this.api.detail(this.orderNumber, email).subscribe({
          next: (order) => this.order.set(order),
          error: (err: { error?: { detail?: string } }) => this.error.set(err.error?.detail ?? null)
        });
      },
      { allowSignalWrites: true }
    );
  }
}
