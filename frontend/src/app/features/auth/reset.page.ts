import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

function strongPassword(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null;
  return value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value) ? null : { weak: true };
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="section-y max-w-md">
      <h1 class="font-serif text-4xl">{{ 'auth.resetTitle' | translate }}</h1>
      <p class="mt-3 text-sm text-charcoal/60">{{ 'auth.resetLead' | translate }}</p>

      @if (done()) {
        <div class="card mt-8">
          <p class="text-sm">{{ 'auth.resetDone' | translate }}</p>
          <a class="btn-primary mt-6 w-full" routerLink="/login">{{ 'auth.login' | translate }}</a>
        </div>
      } @else {
        <form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
              {{ 'auth.resetToken' | translate }}
            </span>
            <input class="field mt-1" formControlName="token" [class.field-error]="invalid('token')" />
            @if (invalid('token')) { <p class="form-error">{{ 'validation.required' | translate }}</p> }
          </label>

          <label>
            <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
              {{ 'auth.newPassword' | translate }}
            </span>
            <input
              class="field mt-1"
              type="password"
              autocomplete="new-password"
              formControlName="new_password"
              [class.field-error]="invalid('new_password')"
            />
            @if (invalid('new_password')) { <p class="form-error">{{ 'validation.passwordWeak' | translate }}</p> }
          </label>

          <button class="btn-primary" type="submit" [disabled]="busy()">{{ 'auth.resetSubmit' | translate }}</button>
        </form>
      }
    </div>
  `
})
export class ResetPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly busy = signal(false);
  readonly done = signal(false);
  readonly form = this.fb.nonNullable.group({
    // Prefilled from the link in the reset email (?token=...).
    token: [this.route.snapshot.queryParamMap.get('token') ?? '', Validators.required],
    new_password: ['', [Validators.required, strongPassword]]
  });

  invalid(control: 'token' | 'new_password') {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const { token, new_password: newPassword } = this.form.getRawValue();

    this.auth.resetPassword(token.trim(), newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (error: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.toast.error(error.error?.detail ?? this.translate.instant('common.error'));
      }
    });
  }
}
