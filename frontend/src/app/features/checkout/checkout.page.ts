import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Address } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { PricePipe } from '../../shared/price.pipe';
import { EmptyStateComponent } from '../../shared/ui.component';

type Step = 0 | 1 | 2 | 3;

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, PricePipe, EmptyStateComponent],
  template: `
    <div class="section-y">
      <h1 class="font-serif text-4xl">{{ 'checkout.title' | translate }}</h1>

      @if (cart.isEmpty()) {
        <app-empty-state class="mt-8 block" [title]="'checkout.emptyCart' | translate">
          <a class="btn-primary" routerLink="/search">{{ 'cart.emptyCta' | translate }}</a>
        </app-empty-state>
      } @else {
        <ol class="mt-8 flex flex-wrap gap-2 text-sm">
          @for (label of stepLabels; track label; let i = $index) {
            <li class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-2 rounded px-3 py-2 transition"
                [class]="i === step() ? 'bg-charcoal text-cream' : i < step() ? 'text-gold' : 'text-charcoal/40'"
                [disabled]="i > step()"
                (click)="goTo(i)"
              >
                <span
                  class="grid h-6 w-6 place-items-center rounded-full border text-xs"
                  [class]="i <= step() ? 'border-current' : 'border-charcoal/25'"
                >
                  {{ i + 1 }}
                </span>
                {{ label | translate }}
              </button>
              @if (i < 3) { <span class="text-charcoal/25">→</span> }
            </li>
          }
        </ol>

        <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div class="card">
            @switch (step()) {
              @case (0) {
                <h2 class="font-serif text-2xl">{{ 'checkout.stepAddress' | translate }}</h2>

                @if (addresses().length) {
                  <div class="mt-4 space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'checkout.savedAddresses' | translate }}
                    </p>
                    @for (address of addresses(); track address.id) {
                      <label
                        class="flex cursor-pointer items-start gap-3 rounded border p-3 transition"
                        [class]="selectedAddressId() === address.id ? 'border-gold bg-gold/5' : 'border-charcoal/15'"
                      >
                        <input
                          type="radio"
                          class="mt-1 accent-gold"
                          name="saved-address"
                          [checked]="selectedAddressId() === address.id"
                          (change)="useAddress(address)"
                        />
                        <span class="text-sm">
                          <span class="font-semibold">{{ address.label || address.full_name }}</span>
                          <span class="block text-charcoal/60">
                            {{ address.street }}, {{ address.postal_code }} {{ address.city }}, {{ address.country }}
                          </span>
                        </span>
                      </label>
                    }
                    <label
                      class="flex cursor-pointer items-center gap-3 rounded border p-3 transition"
                      [class]="selectedAddressId() === null ? 'border-gold bg-gold/5' : 'border-charcoal/15'"
                    >
                      <input
                        type="radio"
                        class="accent-gold"
                        name="saved-address"
                        [checked]="selectedAddressId() === null"
                        (change)="useNewAddress()"
                      />
                      <span class="text-sm font-semibold">{{ 'checkout.newAddress' | translate }}</span>
                    </label>
                  </div>
                }

                <form class="mt-5 grid gap-4 sm:grid-cols-2" [formGroup]="addressForm">
                  <label class="sm:col-span-2">
                    <span class="label-text">{{ 'address.fullName' | translate }}</span>
                    <input class="field mt-1" formControlName="full_name" [class.field-error]="invalid('full_name')" />
                    @if (invalid('full_name')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
                  </label>
                  <label class="sm:col-span-2">
                    <span class="label-text">{{ 'address.street' | translate }}</span>
                    <input class="field mt-1" formControlName="street" [class.field-error]="invalid('street')" />
                    @if (invalid('street')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
                  </label>
                  <label>
                    <span class="label-text">{{ 'address.city' | translate }}</span>
                    <input class="field mt-1" formControlName="city" [class.field-error]="invalid('city')" />
                    @if (invalid('city')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
                  </label>
                  <label>
                    <span class="label-text">{{ 'address.postalCode' | translate }}</span>
                    <input class="field mt-1" formControlName="postal_code" [class.field-error]="invalid('postal_code')" />
                    @if (invalid('postal_code')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
                  </label>
                  <label>
                    <span class="label-text">{{ 'address.country' | translate }}</span>
                    <input class="field mt-1" formControlName="country" [class.field-error]="invalid('country')" />
                    @if (invalid('country')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
                  </label>
                  <label>
                    <span class="label-text">{{ 'address.phone' | translate }}</span>
                    <input class="field mt-1" formControlName="phone" [class.field-error]="invalid('phone')" />
                    @if (invalid('phone')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
                  </label>
                  @if (!auth.isAuthenticated()) {
                    <label class="sm:col-span-2">
                      <span class="label-text">{{ 'checkout.contactEmail' | translate }}</span>
                      <input class="field mt-1" type="email" formControlName="contact_email" />
                      @if (invalid('contact_email')) { <p class="form-error">{{ 'validation.email' | translate }}</p> }
                    </label>
                  } @else if (selectedAddressId() === null) {
                    <label class="flex items-center gap-2 text-sm sm:col-span-2">
                      <input type="checkbox" class="accent-gold" formControlName="save_address" />
                      {{ 'checkout.saveAddress' | translate }}
                    </label>
                  }
                </form>
              }

              @case (1) {
                <h2 class="font-serif text-2xl">{{ 'checkout.stepShipping' | translate }}</h2>
                <div class="mt-4 space-y-3">
                  @for (option of shippingOptions; track option.value) {
                    <label
                      class="flex cursor-pointer items-center justify-between gap-3 rounded border p-4 transition"
                      [class]="shippingMethod() === option.value ? 'border-gold bg-gold/5' : 'border-charcoal/15'"
                    >
                      <span class="flex items-center gap-3">
                        <input
                          type="radio"
                          class="accent-gold"
                          name="shipping"
                          [checked]="shippingMethod() === option.value"
                          (change)="setShipping(option.value)"
                        />
                        <span>
                          <span class="block font-semibold">{{ option.label | translate }}</span>
                          <span class="block text-xs text-charcoal/55">{{ option.note | translate }}</span>
                        </span>
                      </span>
                      <span class="font-semibold">{{ option.cost | price }}</span>
                    </label>
                  }
                </div>
              }

              @case (2) {
                <h2 class="font-serif text-2xl">{{ 'checkout.stepPayment' | translate }}</h2>
                <div class="mt-4 space-y-3">
                  @for (option of paymentOptions; track option.value) {
                    <label
                      class="flex cursor-pointer items-center gap-3 rounded border p-4 transition"
                      [class]="paymentMethod() === option.value ? 'border-gold bg-gold/5' : 'border-charcoal/15'"
                    >
                      <input
                        type="radio"
                        class="accent-gold"
                        name="payment"
                        [checked]="paymentMethod() === option.value"
                        (change)="paymentMethod.set(option.value)"
                      />
                      <span>
                        <span class="block font-semibold">{{ option.label | translate }}</span>
                        <span class="block text-xs text-charcoal/55">{{ option.note | translate }}</span>
                      </span>
                    </label>
                  }
                </div>
              }

              @case (3) {
                <h2 class="font-serif text-2xl">{{ 'checkout.reviewTitle' | translate }}</h2>
                <dl class="mt-4 space-y-4 text-sm">
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'checkout.stepAddress' | translate }}
                    </dt>
                    <dd class="mt-1 text-charcoal/80">
                      {{ addressForm.value.full_name }}<br />
                      {{ addressForm.value.street }}<br />
                      {{ addressForm.value.postal_code }} {{ addressForm.value.city }}, {{ addressForm.value.country }}<br />
                      {{ addressForm.value.phone }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'checkout.stepShipping' | translate }}
                    </dt>
                    <dd class="mt-1 text-charcoal/80">
                      {{ (shippingMethod() === 'express' ? 'checkout.shippingExpress' : 'checkout.shippingStandard') | translate }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'checkout.stepPayment' | translate }}
                    </dt>
                    <dd class="mt-1 text-charcoal/80">
                      {{ (paymentMethod() === 'card' ? 'checkout.paymentCard' : 'checkout.paymentCod') | translate }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'account.orderItems' | translate }}
                    </dt>
                    <dd class="mt-2 space-y-2">
                      @for (item of cart.items(); track item.id) {
                        <div class="flex justify-between gap-3">
                          <span class="text-charcoal/80">{{ item.quantity }} × {{ item.name }}</span>
                          <span>{{ item.line_total | price }}</span>
                        </div>
                      }
                    </dd>
                  </div>
                </dl>
              }
            }

            <div class="mt-8 flex justify-between gap-3">
              <button type="button" class="btn-secondary" [disabled]="step() === 0" (click)="back()">
                {{ 'checkout.back' | translate }}
              </button>
              @if (step() < 3) {
                <button type="button" class="btn-primary" (click)="next()">{{ 'checkout.continue' | translate }}</button>
              } @else {
                <button type="button" class="btn-primary" [disabled]="submitting()" (click)="placeOrder()">
                  {{ 'checkout.placeOrder' | translate }}
                </button>
              }
            </div>
          </div>

          <aside class="card h-fit lg:sticky lg:top-24">
            <h2 class="font-serif text-2xl">{{ 'cart.summary' | translate }}</h2>
            <dl class="mt-4 space-y-2 text-sm">
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
            <a class="btn-secondary mt-6 w-full" routerLink="/cart">{{ 'nav.cart' | translate }}</a>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .label-text {
        @apply block text-xs font-semibold uppercase tracking-wide text-charcoal/50;
      }
    `
  ]
})
export class CheckoutPage {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly step = signal<Step>(0);
  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<number | null>(null);
  readonly shippingMethod = signal<'standard' | 'express'>('standard');
  readonly paymentMethod = signal<'card' | 'cash_on_delivery'>('card');
  readonly submitting = signal(false);

  readonly stepLabels = ['checkout.stepAddress', 'checkout.stepShipping', 'checkout.stepPayment', 'checkout.stepReview'];
  readonly shippingOptions = [
    { value: 'standard' as const, label: 'checkout.shippingStandard', note: 'checkout.shippingStandardNote', cost: 500 },
    { value: 'express' as const, label: 'checkout.shippingExpress', note: 'checkout.shippingExpressNote', cost: 1200 }
  ];
  readonly paymentOptions = [
    { value: 'card' as const, label: 'checkout.paymentCard', note: 'checkout.paymentCardNote' },
    { value: 'cash_on_delivery' as const, label: 'checkout.paymentCod', note: 'checkout.paymentCodNote' }
  ];

  readonly addressForm = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    street: ['', [Validators.required, Validators.minLength(2)]],
    city: ['', Validators.required],
    postal_code: ['', Validators.required],
    country: ['Srbija', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(4)]],
    contact_email: ['', this.auth.isAuthenticated() ? [] : [Validators.required, Validators.email]],
    save_address: [false]
  });

  readonly addressValid = computed(() => this.addressForm.valid);

  constructor() {
    this.cart.load(this.shippingMethod()).subscribe({ error: () => undefined });
    if (this.auth.isAuthenticated()) {
      this.orders.addresses().subscribe({
        next: (list) => {
          this.addresses.set(list);
          const preferred = list.find((item) => item.is_default) ?? list[0];
          if (preferred) this.useAddress(preferred);
        },
        error: () => undefined
      });
      const user = this.auth.user();
      if (user) this.addressForm.patchValue({ full_name: user.full_name, phone: user.phone ?? '' });
    }
  }

  invalid(control: keyof typeof this.addressForm.controls) {
    const field = this.addressForm.controls[control];
    return field.touched && field.invalid;
  }

  useAddress(address: Address) {
    this.selectedAddressId.set(address.id);
    this.addressForm.patchValue({
      full_name: address.full_name,
      street: address.street,
      city: address.city,
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone,
      save_address: false
    });
  }

  useNewAddress() {
    this.selectedAddressId.set(null);
    this.addressForm.patchValue({ street: '', city: '', postal_code: '' });
  }

  setShipping(method: 'standard' | 'express') {
    this.shippingMethod.set(method);
    // Reload so the summary quotes the cost the order will actually charge.
    this.cart.load(method).subscribe({ error: () => undefined });
  }

  goTo(step: number) {
    if (step <= this.step()) this.step.set(step as Step);
  }

  next() {
    if (this.step() === 0) {
      this.addressForm.markAllAsTouched();
      if (this.addressForm.invalid) return;
    }
    this.step.set(Math.min(this.step() + 1, 3) as Step);
  }

  back() {
    this.step.set(Math.max(this.step() - 1, 0) as Step);
  }

  placeOrder() {
    if (this.addressForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    const value = this.addressForm.getRawValue();
    const shippingAddress = {
      full_name: value.full_name,
      street: value.street,
      city: value.city,
      postal_code: value.postal_code,
      country: value.country,
      phone: value.phone
    };

    const place = () =>
      this.orders
        .create({
          shipping_address: shippingAddress,
          shipping_method: this.shippingMethod(),
          payment_method: this.paymentMethod(),
          contact_email: value.contact_email || null
        })
        .subscribe({
          next: (order) => {
            this.submitting.set(false);
            this.cart.load().subscribe({ error: () => undefined });
            this.router.navigate(['/order-confirmation', order.order_number]);
          },
          error: (error: { error?: { detail?: string } }) => {
            this.submitting.set(false);
            this.toast.error(error.error?.detail ?? this.translate.instant('checkout.orderFailed'));
          }
        });

    // Saving the address is a convenience; a failure there must not block the order.
    if (this.auth.isAuthenticated() && this.selectedAddressId() === null && value.save_address) {
      this.orders
        .createAddress({ ...shippingAddress, label: null, is_default: this.addresses().length === 0 })
        .subscribe({ next: () => place(), error: () => place() });
    } else {
      place();
    }
  }
}
