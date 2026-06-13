import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="section grid gap-8 lg:grid-cols-[1fr_360px]">
      <div class="space-y-4">@for (item of cart.cart()?.items ?? []; track item.id) { <div class="flex items-center justify-between rounded bg-white p-4"><span>{{ item.name }}</span><input class="field w-20" type="number" [value]="item.quantity" (change)="cart.update(item.id, $any($event.target).valueAsNumber).subscribe()"><button class="btn-secondary" (click)="cart.remove(item.id).subscribe()">Remove</button></div> }</div>
      <aside class="rounded bg-white p-6"><h1 class="font-serif text-3xl">Cart</h1><p class="mt-4">Subtotal {{ cart.cart()?.subtotal || 0 }} RSD</p><form class="mt-4 flex gap-2" [formGroup]="promo" (ngSubmit)="apply()"><input class="field" formControlName="code"><button class="btn-secondary">Apply</button></form><a routerLink="/checkout" class="btn-primary mt-6 w-full">Checkout</a></aside>
    </section>
  `
})
export class CartPage {
  readonly cart = inject(CartService);
  private readonly fb = inject(FormBuilder);
  readonly promo = this.fb.nonNullable.group({ code: [''] });
  constructor() { this.cart.load().subscribe(); }
  apply() { this.cart.applyPromo(this.promo.getRawValue().code).subscribe(); }
}
