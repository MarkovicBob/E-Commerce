import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="section max-w-3xl">
      <h1 class="font-serif text-4xl">Checkout</h1>
      <form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <input class="field" formControlName="full_name" placeholder="Full name">
        <input class="field" formControlName="street" placeholder="Street">
        <div class="grid gap-4 sm:grid-cols-2"><input class="field" formControlName="city" placeholder="City"><input class="field" formControlName="postal_code" placeholder="Postal code"></div>
        <input class="field" formControlName="country" placeholder="Country">
        <input class="field" formControlName="phone" placeholder="Phone">
        <select class="field" formControlName="shipping_method"><option value="standard">Standard</option><option value="express">Express</option></select>
        <select class="field" formControlName="payment_method"><option value="card">Card mock</option><option value="cash_on_delivery">Cash on delivery</option></select>
        <button class="btn-primary">Place order</button>
      </form>
    </section>
  `
})
export class CheckoutPage {
  private readonly fb = inject(FormBuilder);
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  readonly form = this.fb.nonNullable.group({
    full_name: ['', Validators.required], street: ['', Validators.required], city: ['', Validators.required], postal_code: ['', Validators.required], country: ['', Validators.required], phone: ['', Validators.required],
    shipping_method: ['standard'], payment_method: ['card']
  });
  submit() {
    if (this.form.invalid) return;
    const { shipping_method, payment_method, ...shipping_address } = this.form.getRawValue();
    this.orders.create({ shipping_address, shipping_method, payment_method }).subscribe((order) => this.router.navigate(['/order-confirmation', order.order_number]));
  }
}
