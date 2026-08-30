import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CartItem } from '../../core/models';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { PricePipe } from '../../shared/price.pipe';
import { EmptyStateComponent } from '../../shared/ui.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, PricePipe, EmptyStateComponent],
  template: `
    <div class="section-y">
      <h1 class="font-serif text-4xl">{{ 'cart.title' | translate }}</h1>

      @if (cart.isEmpty()) {
        <app-empty-state class="mt-8 block" [title]="'cart.empty' | translate">
          <a class="btn-primary" routerLink="/search">{{ 'cart.emptyCta' | translate }}</a>
        </app-empty-state>
      } @else {
        @if (cart.cart()?.has_stock_issue) {
          <p class="mt-6 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {{ 'cart.stockIssue' | translate }}
          </p>
        }

        <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div class="space-y-4">
            @for (item of cart.items(); track item.id) {
              <div class="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <a [routerLink]="['/product', item.slug]" class="shrink-0">
                  <img class="h-24 w-20 rounded object-cover" [src]="item.image_url" [alt]="item.name" />
                </a>
                <div class="min-w-0 flex-1">
                  <p class="text-xs uppercase tracking-wide text-charcoal/50">{{ item.brand }}</p>
                  <a class="font-serif text-lg hover:text-gold" [routerLink]="['/product', item.slug]">{{ item.name }}</a>
                  @if (item.size || item.color) {
                    <p class="text-xs text-charcoal/55">
                      @if (item.size) { {{ 'product.size' | translate }}: {{ item.size }} }
                      @if (item.size && item.color) { · }
                      @if (item.color) { {{ 'product.color' | translate }}: {{ item.color }} }
                    </p>
                  }
                  <p class="mt-1 text-sm">{{ item.unit_price | price }}</p>
                  @if (!item.in_stock) {
                    <p class="mt-1 text-xs font-semibold text-red-700">
                      {{ 'product.lowStock' | translate: { count: item.stock_quantity } }}
                    </p>
                  }
                </div>
                <div class="flex items-center gap-3">
                  <label class="sr-only" [attr.for]="'qty-' + item.id">{{ 'cart.quantity' | translate }}</label>
                  <input
                    class="field w-20"
                    type="number"
                    min="1"
                    [id]="'qty-' + item.id"
                    [max]="item.stock_quantity || 1"
                    [value]="item.quantity"
                    [disabled]="busy()"
                    (change)="changeQuantity(item, $any($event.target).valueAsNumber)"
                  />
                  <p class="w-28 text-right font-semibold">{{ item.line_total | price }}</p>
                  <button
                    type="button"
                    class="text-sm text-charcoal/50 transition hover:text-red-700"
                    [attr.aria-label]="'cart.remove' | translate"
                    (click)="remove(item)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            }

            <button type="button" class="btn-secondary" (click)="clear()">{{ 'cart.clear' | translate }}</button>
          </div>

          <aside class="card h-fit lg:sticky lg:top-24">
            <h2 class="font-serif text-2xl">{{ 'cart.summary' | translate }}</h2>

            <form class="mt-5" [formGroup]="promoForm" (ngSubmit)="applyPromo()">
              <label class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50" for="promo">
                {{ 'cart.promo' | translate }}
              </label>
              @if (cart.cart()?.promo_code; as code) {
                <div class="mt-2 flex items-center justify-between rounded border border-gold bg-gold/10 px-3 py-2 text-sm">
                  <span class="font-semibold">{{ code }}</span>
                  <button type="button" class="text-xs text-charcoal/60 hover:text-red-700" (click)="removePromo()">
                    {{ 'cart.promoRemove' | translate }}
                  </button>
                </div>
              } @else {
                <div class="mt-2 flex gap-2">
                  <input
                    id="promo"
                    class="field"
                    formControlName="code"
                    [placeholder]="'cart.promoPlaceholder' | translate"
                  />
                  <button class="btn-secondary shrink-0" type="submit">{{ 'cart.promoApply' | translate }}</button>
                </div>
              }
            </form>

            <dl class="mt-6 space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-charcoal/60">{{ 'cart.subtotal' | translate }}</dt>
                <dd>{{ cart.cart()?.subtotal | price }}</dd>
              </div>
              @if ((cart.cart()?.discount_total ?? 0) > 0) {
                <div class="flex justify-between text-green-700">
                  <dt>{{ 'cart.discount' | translate }}</dt>
                  <dd>−{{ cart.cart()?.discount_total | price }}</dd>
                </div>
              }
              <div class="flex justify-between">
                <dt class="text-charcoal/60">{{ 'cart.shipping' | translate }}</dt>
                <dd>{{ cart.cart()?.shipping_cost | price }}</dd>
              </div>
              <div class="mt-3 flex justify-between border-t border-charcoal/10 pt-3 text-base font-semibold">
                <dt>{{ 'cart.grandTotal' | translate }}</dt>
                <dd>{{ cart.cart()?.total | price }}</dd>
              </div>
            </dl>

            <a class="btn-primary mt-6 w-full" routerLink="/checkout">{{ 'cart.checkout' | translate }}</a>
            <a class="btn-secondary mt-3 w-full" routerLink="/search">{{ 'cart.emptyCta' | translate }}</a>
          </aside>
        </div>
      }
    </div>
  `
})
export class CartPage {
  readonly cart = inject(CartService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  readonly busy = signal(false);
  readonly promoForm = this.fb.nonNullable.group({ code: [''] });

  constructor() {
    this.cart.load().subscribe({ error: () => undefined });
  }

  private fail(error: { error?: { detail?: string } }) {
    this.busy.set(false);
    this.toast.error(error.error?.detail ?? this.translate.instant('common.error'));
    // Re-sync after a rejected change so the inputs show what the server actually holds.
    this.cart.load().subscribe({ error: () => undefined });
  }

  changeQuantity(item: CartItem, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 1) {
      this.cart.load().subscribe({ error: () => undefined });
      return;
    }
    this.busy.set(true);
    this.cart.update(item.id, Math.trunc(quantity)).subscribe({
      next: () => this.busy.set(false),
      error: (error) => this.fail(error)
    });
  }

  remove(item: CartItem) {
    this.cart.remove(item.id).subscribe({
      next: () => this.toast.show(this.translate.instant('cart.removed')),
      error: (error) => this.fail(error)
    });
  }

  clear() {
    this.cart.clear().subscribe({ error: (error) => this.fail(error) });
  }

  applyPromo() {
    const code = this.promoForm.getRawValue().code.trim();
    if (!code) return;
    this.cart.applyPromo(code).subscribe({
      next: () => {
        this.toast.show(this.translate.instant('cart.promoApplied'));
        this.promoForm.reset();
      },
      error: () => this.toast.error(this.translate.instant('cart.promoInvalid'))
    });
  }

  removePromo() {
    this.cart.removePromo().subscribe({ error: (error) => this.fail(error) });
  }
}
