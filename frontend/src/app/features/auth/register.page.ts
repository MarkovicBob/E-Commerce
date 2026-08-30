import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';

/** Mirrors the backend rule: at least 8 characters mixing letters and digits. */
function strongPassword(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null;
  if (value.length < 8) return { weak: true };
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  return hasLetter && hasDigit ? null : { weak: true };
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="section-y max-w-md">
      <h1 class="font-serif text-4xl">{{ 'auth.register' | translate }}</h1>

      <form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.fullName' | translate }}
          </span>
          <input class="field mt-1" autocomplete="name" formControlName="full_name" [class.field-error]="invalid('full_name')" />
          @if (invalid('full_name')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
        </label>

        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.email' | translate }}
          </span>
          <input class="field mt-1" type="email" autocomplete="email" formControlName="email" [class.field-error]="invalid('email')" />
          @if (invalid('email')) { <p class="form-error">{{ 'validation.email' | translate }}</p> }
        </label>

        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.password' | translate }}
          </span>
          <input
            class="field mt-1"
            type="password"
            autocomplete="new-password"
            formControlName="password"
            [class.field-error]="invalid('password')"
          />
          @if (invalid('password')) { <p class="form-error">{{ 'validation.passwordWeak' | translate }}</p> }
        </label>

        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.phone' | translate }}
          </span>
          <input class="field mt-1" autocomplete="tel" formControlName="phone" />
        </label>

        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.referralCode' | translate }}
          </span>
          <input class="field mt-1" formControlName="referral_code" />
        </label>

        <button class="btn-primary" type="submit" [disabled]="busy()">{{ 'auth.createAccount' | translate }}</button>

        <p class="text-sm">
          {{ 'auth.hasAccount' | translate }}
          <a class="text-gold hover:underline" routerLink="/login">{{ 'auth.login' | translate }}</a>
        </p>
      </form>
    </div>
  `
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly busy = signal(false);
  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/account';

  readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, strongPassword]],
    phone: [''],
    // Prefilled from /register?ref=CODE so a shared referral link just works.
    referral_code: [this.route.snapshot.queryParamMap.get('ref') ?? '']
  });

  invalid(control: 'full_name' | 'email' | 'password') {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const value = this.form.getRawValue();

    this.auth
      .register({
        full_name: value.full_name,
        email: value.email,
        password: value.password,
        phone: value.phone || null,
        referral_code: value.referral_code.trim() || null
      })
      .subscribe({
        next: () => {
          this.toast.show(this.translate.instant('auth.registerSuccess'));
          this.cart.merge().subscribe({
            next: () => this.finish(),
            error: () => this.finish()
          });
        },
        error: (error: { error?: { detail?: string } }) => {
          this.busy.set(false);
          this.toast.error(error.error?.detail ?? this.translate.instant('common.error'));
        }
      });
  }

  private finish() {
    this.busy.set(false);
    this.router.navigateByUrl(this.returnUrl);
  }
}
