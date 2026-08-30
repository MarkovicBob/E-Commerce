import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Address, Order, Referral } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { OrderService } from '../../core/services/order.service';
import { ReferralService } from '../../core/services/referral.service';
import { ToastService } from '../../core/services/toast.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { PricePipe } from '../../shared/price.pipe';
import { ProductCardComponent } from '../../shared/product-card.component';
import { ConfirmDialogComponent, EmptyStateComponent } from '../../shared/ui.component';

type Tab = 'orders' | 'profile' | 'addresses' | 'wishlist' | 'referral';

@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    DatePipe,
    PricePipe,
    ProductCardComponent,
    EmptyStateComponent,
    ConfirmDialogComponent
  ],
  template: `
    <div class="section-y">
      <h1 class="font-serif text-4xl">{{ 'account.title' | translate }}</h1>
      <p class="mt-2 text-charcoal/60">{{ auth.user()?.full_name }} · {{ auth.user()?.email }}</p>

      <div class="mt-8 flex gap-1 overflow-x-auto border-b border-charcoal/15" role="tablist">
        @for (item of tabs; track item) {
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab-active]="tab() === item"
            [attr.aria-selected]="tab() === item"
            (click)="setTab(item)"
          >
            {{ tabLabel(item) | translate }}
          </button>
        }
      </div>

      <div class="py-8">
        @switch (tab()) {
          @case ('orders') {
            @if (orders().length === 0) {
              <app-empty-state [title]="'account.noOrders' | translate">
                <a class="btn-primary" routerLink="/search">{{ 'cart.emptyCta' | translate }}</a>
              </app-empty-state>
            } @else {
              <div class="space-y-4">
                @for (order of orders(); track order.id) {
                  <article class="card">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p class="font-mono font-semibold">{{ order.order_number }}</p>
                        <p class="text-xs text-charcoal/55">{{ order.created_at | date: 'medium' }}</p>
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-cream">
                          {{ 'status.' + order.status | translate }}
                        </span>
                        <span class="font-semibold">{{ order.total | price }}</span>
                      </div>
                    </div>

                    <ul class="mt-4 divide-y divide-charcoal/10">
                      @for (item of order.items; track item.id) {
                        <li class="flex items-center gap-3 py-2">
                          @if (item.image_url) {
                            <img class="h-14 w-12 rounded object-cover" [src]="item.image_url" [alt]="item.name" />
                          }
                          <div class="min-w-0 flex-1">
                            @if (item.slug) {
                              <a class="truncate text-sm hover:text-gold" [routerLink]="['/product', item.slug]">
                                {{ item.name }}
                              </a>
                            } @else {
                              <span class="truncate text-sm">{{ item.name }}</span>
                            }
                            <p class="text-xs text-charcoal/50">{{ item.quantity }} × {{ item.unit_price | price }}</p>
                          </div>
                          <span class="text-sm font-medium">{{ item.line_total | price }}</span>
                        </li>
                      }
                    </ul>

                    @if (order.can_cancel) {
                      <button type="button" class="btn-secondary mt-4 text-xs" (click)="askCancel(order)">
                        {{ 'account.cancelOrder' | translate }}
                      </button>
                    }
                  </article>
                }
              </div>
            }
          }

          @case ('profile') {
            <div class="grid gap-8 lg:grid-cols-2">
              <form class="card" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                <h2 class="font-serif text-2xl">{{ 'account.tabProfile' | translate }}</h2>
                <label class="mt-4 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'auth.fullName' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="full_name" />
                </label>
                <label class="mt-4 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'auth.phone' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="phone" />
                </label>
                <label class="mt-4 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'auth.email' | translate }}
                  </span>
                  <input class="field mt-1 bg-cream" [value]="auth.user()?.email" disabled />
                </label>
                <button class="btn-primary mt-6" type="submit" [disabled]="profileForm.invalid">
                  {{ 'account.profileSave' | translate }}
                </button>
              </form>

              <form class="card" [formGroup]="passwordForm" (ngSubmit)="savePassword()">
                <h2 class="font-serif text-2xl">{{ 'account.passwordChange' | translate }}</h2>
                <label class="mt-4 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'auth.currentPassword' | translate }}
                  </span>
                  <input class="field mt-1" type="password" autocomplete="current-password" formControlName="current_password" />
                </label>
                <label class="mt-4 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'auth.newPassword' | translate }}
                  </span>
                  <input class="field mt-1" type="password" autocomplete="new-password" formControlName="new_password" />
                  @if (passwordForm.controls.new_password.touched && passwordForm.controls.new_password.invalid) {
                    <p class="form-error">{{ 'validation.passwordWeak' | translate }}</p>
                  }
                </label>
                <button class="btn-primary mt-6" type="submit" [disabled]="passwordForm.invalid">
                  {{ 'account.passwordChange' | translate }}
                </button>
              </form>
            </div>
          }

          @case ('addresses') {
            <div class="grid gap-8 lg:grid-cols-[1fr_22rem]">
              <div>
                @if (addresses().length === 0) {
                  <app-empty-state [title]="'account.noAddresses' | translate" />
                } @else {
                  <div class="grid gap-4 sm:grid-cols-2">
                    @for (address of addresses(); track address.id) {
                      <article class="card">
                        <div class="flex items-start justify-between gap-2">
                          <h3 class="font-serif text-lg">{{ address.label || address.full_name }}</h3>
                          @if (address.is_default) {
                            <span class="rounded-full bg-gold/20 px-2 py-1 text-[11px] font-semibold">
                              {{ 'account.addressDefault' | translate }}
                            </span>
                          }
                        </div>
                        <p class="mt-2 text-sm text-charcoal/70">
                          {{ address.full_name }}<br />
                          {{ address.street }}<br />
                          {{ address.postal_code }} {{ address.city }}, {{ address.country }}<br />
                          {{ address.phone }}
                        </p>
                        <div class="mt-4 flex flex-wrap gap-2 text-xs">
                          <button type="button" class="chip" (click)="editAddress(address)">
                            {{ 'account.addressEdit' | translate }}
                          </button>
                          @if (!address.is_default) {
                            <button type="button" class="chip" (click)="makeDefault(address)">
                              {{ 'account.addressMakeDefault' | translate }}
                            </button>
                          }
                          <button type="button" class="chip hover:border-red-600 hover:text-red-700" (click)="askDeleteAddress(address)">
                            {{ 'account.addressDelete' | translate }}
                          </button>
                        </div>
                      </article>
                    }
                  </div>
                }
              </div>

              <form class="card h-fit" [formGroup]="addressForm" (ngSubmit)="saveAddress()">
                <h2 class="font-serif text-2xl">
                  {{ (editingAddressId() ? 'account.addressEdit' : 'account.addressAdd') | translate }}
                </h2>
                <label class="mt-4 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'address.label' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="label" [placeholder]="'address.labelPlaceholder' | translate" />
                </label>
                <label class="mt-3 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'address.fullName' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="full_name" />
                </label>
                <label class="mt-3 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'address.street' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="street" />
                </label>
                <div class="mt-3 grid grid-cols-2 gap-3">
                  <label>
                    <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'address.city' | translate }}
                    </span>
                    <input class="field mt-1" formControlName="city" />
                  </label>
                  <label>
                    <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                      {{ 'address.postalCode' | translate }}
                    </span>
                    <input class="field mt-1" formControlName="postal_code" />
                  </label>
                </div>
                <label class="mt-3 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'address.country' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="country" />
                </label>
                <label class="mt-3 block">
                  <span class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'address.phone' | translate }}
                  </span>
                  <input class="field mt-1" formControlName="phone" />
                </label>
                <label class="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" class="accent-gold" formControlName="is_default" />
                  {{ 'account.addressDefault' | translate }}
                </label>
                <div class="mt-5 flex gap-2">
                  <button class="btn-primary flex-1" type="submit" [disabled]="addressForm.invalid">
                    {{ 'admin.save' | translate }}
                  </button>
                  @if (editingAddressId()) {
                    <button type="button" class="btn-secondary" (click)="resetAddressForm()">
                      {{ 'common.cancel' | translate }}
                    </button>
                  }
                </div>
              </form>
            </div>
          }

          @case ('wishlist') {
            @if (wishlist.items().length === 0) {
              <app-empty-state [title]="'account.emptyWishlist' | translate">
                <a class="btn-primary" routerLink="/search">{{ 'cart.emptyCta' | translate }}</a>
              </app-empty-state>
            } @else {
              <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                @for (product of wishlist.items(); track product.id) {
                  <app-product-card [product]="product" />
                }
              </div>
            }
          }

          @case ('referral') {
            <div class="grid gap-8 lg:grid-cols-2">
              <div class="card">
                <h2 class="font-serif text-2xl">{{ 'account.referralTitle' | translate }}</h2>
                <p class="mt-2 text-sm text-charcoal/60">{{ 'account.referralLead' | translate }}</p>

                <div class="mt-6">
                  <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'account.referralCode' | translate }}
                  </p>
                  <div class="mt-1 flex gap-2">
                    <code class="field bg-cream font-mono">{{ referral()?.referral_code }}</code>
                    <button type="button" class="btn-secondary shrink-0" (click)="copy(referral()?.referral_code ?? '')">
                      {{ 'account.referralCopy' | translate }}
                    </button>
                  </div>
                </div>

                <div class="mt-4">
                  <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                    {{ 'account.referralLink' | translate }}
                  </p>
                  <div class="mt-1 flex gap-2">
                    <code class="field truncate bg-cream text-xs">{{ referralLink() }}</code>
                    <button type="button" class="btn-secondary shrink-0" (click)="copy(referralLink())">
                      {{ 'account.referralCopy' | translate }}
                    </button>
                  </div>
                </div>

                <p class="mt-6 text-sm">
                  {{ 'account.referralCompleted' | translate }}:
                  <span class="font-semibold">{{ referral()?.completed_referrals ?? 0 }}</span>
                </p>
              </div>

              <div class="card">
                <h2 class="font-serif text-2xl">{{ 'account.referralCoupons' | translate }}</h2>
                @if ((referral()?.coupons ?? []).length === 0) {
                  <p class="mt-3 text-sm text-charcoal/60">{{ 'account.noCoupons' | translate }}</p>
                } @else {
                  <ul class="mt-4 space-y-3">
                    @for (coupon of referral()?.coupons ?? []; track coupon.code) {
                      <li class="flex items-center justify-between gap-3 rounded border border-charcoal/15 px-3 py-2">
                        <div>
                          <p class="font-mono text-sm font-semibold">{{ coupon.code }}</p>
                          <p class="text-xs text-charcoal/55">
                            @if (coupon.discount_amount) {
                              −{{ coupon.discount_amount | price }}
                            } @else {
                              −{{ coupon.discount_percent }}%
                            }
                            · {{ coupon.times_used }}/{{ coupon.usage_limit ?? '∞' }}
                          </p>
                        </div>
                        <button type="button" class="chip" (click)="copy(coupon.code)">
                          {{ 'account.referralCopy' | translate }}
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>

    <app-confirm-dialog
      [open]="confirm() !== null"
      [title]="'common.confirm' | translate"
      [message]="confirmMessage()"
      (confirmed)="runConfirm()"
      (cancelled)="confirm.set(null)"
    />
  `
})
export class AccountPage {
  readonly auth = inject(AuthService);
  readonly wishlist = inject(WishlistService);
  private readonly orderApi = inject(OrderService);
  private readonly referralApi = inject(ReferralService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly tabs: Tab[] = ['orders', 'profile', 'addresses', 'wishlist', 'referral'];
  readonly tab = signal<Tab>('orders');
  readonly orders = signal<Order[]>([]);
  readonly addresses = signal<Address[]>([]);
  readonly referral = signal<Referral | null>(null);
  readonly editingAddressId = signal<number | null>(null);
  readonly confirm = signal<{ kind: 'order' | 'address'; id: number | string; label: string } | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['']
  });

  readonly passwordForm = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]]
  });

  readonly addressForm = this.fb.nonNullable.group({
    label: [''],
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    street: ['', [Validators.required, Validators.minLength(2)]],
    city: ['', Validators.required],
    postal_code: ['', Validators.required],
    country: ['Srbija', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(4)]],
    is_default: [false]
  });

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (requested && this.tabs.includes(requested)) this.tab.set(requested);

    const user = this.auth.user();
    if (user) this.profileForm.patchValue({ full_name: user.full_name, phone: user.phone ?? '' });

    this.loadAddresses();
    effect(
      () => {
        this.language.lang();
        this.loadOrders();
        this.wishlist.load().subscribe({ error: () => undefined });
      },
      { allowSignalWrites: true }
    );
    this.referralApi.me().subscribe({ next: (data) => this.referral.set(data), error: () => undefined });
  }

  tabLabel(tab: Tab) {
    return `account.tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
  }

  setTab(tab: Tab) {
    this.tab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  referralLink() {
    const code = this.referral()?.referral_code;
    return code ? `${location.origin}/register?ref=${code}` : '';
  }

  private loadOrders() {
    this.orderApi.mine().subscribe({ next: (page) => this.orders.set(page.items), error: () => undefined });
  }

  private loadAddresses() {
    this.orderApi.addresses().subscribe({ next: (list) => this.addresses.set(list), error: () => undefined });
  }

  private fail(error: { error?: { detail?: string } }) {
    this.toast.error(error.error?.detail ?? this.translate.instant('common.error'));
  }

  saveProfile() {
    if (this.profileForm.invalid) return;
    const value = this.profileForm.getRawValue();
    this.auth.updateProfile({ full_name: value.full_name, phone: value.phone || null }).subscribe({
      next: () => this.toast.show(this.translate.instant('account.profileSaved')),
      error: (error) => this.fail(error)
    });
  }

  savePassword() {
    if (this.passwordForm.invalid) return;
    const value = this.passwordForm.getRawValue();
    this.auth.changePassword(value.current_password, value.new_password).subscribe({
      next: () => {
        this.toast.show(this.translate.instant('account.passwordSaved'));
        this.passwordForm.reset();
      },
      error: (error) => this.fail(error)
    });
  }

  editAddress(address: Address) {
    this.editingAddressId.set(address.id);
    this.addressForm.patchValue({
      label: address.label ?? '',
      full_name: address.full_name,
      street: address.street,
      city: address.city,
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone,
      is_default: address.is_default
    });
  }

  resetAddressForm() {
    this.editingAddressId.set(null);
    this.addressForm.reset({
      label: '',
      full_name: this.auth.user()?.full_name ?? '',
      street: '',
      city: '',
      postal_code: '',
      country: 'Srbija',
      phone: this.auth.user()?.phone ?? '',
      is_default: false
    });
  }

  saveAddress() {
    if (this.addressForm.invalid) return;
    const value = this.addressForm.getRawValue();
    const body = { ...value, label: value.label || null };
    const editingId = this.editingAddressId();
    const request = editingId ? this.orderApi.updateAddress(editingId, body) : this.orderApi.createAddress(body);

    request.subscribe({
      next: () => {
        this.toast.show(this.translate.instant('account.addressSaved'));
        this.resetAddressForm();
        this.loadAddresses();
      },
      error: (error) => this.fail(error)
    });
  }

  makeDefault(address: Address) {
    this.orderApi.makeDefaultAddress(address.id).subscribe({
      next: () => this.loadAddresses(),
      error: (error) => this.fail(error)
    });
  }

  askDeleteAddress(address: Address) {
    this.confirm.set({
      kind: 'address',
      id: address.id,
      label: address.label || address.full_name
    });
  }

  askCancel(order: Order) {
    this.confirm.set({ kind: 'order', id: order.order_number, label: order.order_number });
  }

  confirmMessage() {
    const pending = this.confirm();
    return pending ? this.translate.instant('admin.confirmDelete', { name: pending.label }) : '';
  }

  runConfirm() {
    const pending = this.confirm();
    this.confirm.set(null);
    if (!pending) return;

    if (pending.kind === 'address') {
      this.orderApi.deleteAddress(Number(pending.id)).subscribe({
        next: () => {
          this.toast.show(this.translate.instant('account.addressDeleted'));
          this.loadAddresses();
        },
        error: (error) => this.fail(error)
      });
    } else {
      this.orderApi.cancel(String(pending.id)).subscribe({
        next: () => {
          this.toast.show(this.translate.instant('account.orderCancelled'));
          this.loadOrders();
        },
        error: (error) => this.fail(error)
      });
    }
  }

  copy(value: string) {
    if (!value) return;
    navigator.clipboard
      ?.writeText(value)
      .then(() => this.toast.show(this.translate.instant('account.referralCopied')))
      .catch(() => this.toast.error(this.translate.instant('common.error')));
  }
}
