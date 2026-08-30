import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { WishlistService } from '../../core/services/wishlist.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="section-y max-w-md">
      <h1 class="font-serif text-4xl">{{ 'auth.login' | translate }}</h1>

      <form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.email' | translate }}
          </span>
          <input
            class="field mt-1"
            type="email"
            autocomplete="email"
            formControlName="email"
            [class.field-error]="invalid('email')"
          />
          @if (invalid('email')) { <p class="form-error">{{ 'validation.email' | translate }}</p> }
        </label>

        <label>
          <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
            {{ 'auth.password' | translate }}
          </span>
          <input
            class="field mt-1"
            type="password"
            autocomplete="current-password"
            formControlName="password"
            [class.field-error]="invalid('password')"
          />
          @if (invalid('password')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
        </label>

        <button class="btn-primary" type="submit" [disabled]="busy()">{{ 'auth.login' | translate }}</button>

        <div class="flex justify-between text-sm">
          <a class="text-gold hover:underline" routerLink="/forgot-password">{{ 'auth.forgot' | translate }}</a>
          <a class="hover:underline" routerLink="/register" [queryParams]="{ returnUrl: returnUrl }">
            {{ 'auth.noAccount' | translate }}
          </a>
        </div>
      </form>
    </div>
  `
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly busy = signal(false);
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/account';
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  invalid(control: 'email' | 'password') {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.toast.show(this.translate.instant('auth.loginSuccess'));
        this.wishlist.loadIds().subscribe({ error: () => undefined });
        // Fold whatever the visitor collected as a guest into their account cart.
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
