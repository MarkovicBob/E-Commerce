import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  template: `
    <div class="section-y max-w-md">
      <h1 class="font-serif text-4xl">{{ 'auth.forgotTitle' | translate }}</h1>
      <p class="mt-3 text-sm text-charcoal/60">{{ 'auth.forgotLead' | translate }}</p>

      @if (sent()) {
        <div class="card mt-8">
          <p class="text-sm">{{ 'auth.forgotSent' | translate }}</p>
          @if (devToken(); as token) {
            <div class="mt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                {{ 'auth.devToken' | translate }}
              </p>
              <code class="mt-1 block break-all rounded bg-cream p-2 text-xs">{{ token }}</code>
            </div>
          }
          <a class="btn-primary mt-6 w-full" routerLink="/reset-password" [queryParams]="{ token: devToken() }">
            {{ 'auth.resetSubmit' | translate }}
          </a>
        </div>
      } @else {
        <form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span class="block text-xs font-semibold uppercase tracking-wide text-charcoal/50">
              {{ 'auth.email' | translate }}
            </span>
            <input class="field mt-1" type="email" formControlName="email" [class.field-error]="invalid" />
            @if (invalid) { <p class="form-error">{{ 'validation.email' | translate }}</p> }
          </label>
          <button class="btn-primary" type="submit" [disabled]="busy()">{{ 'auth.forgotSubmit' | translate }}</button>
          <a class="text-center text-sm text-gold hover:underline" routerLink="/login">{{ 'auth.login' | translate }}</a>
        </form>
      }
    </div>
  `
})
export class ForgotPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly busy = signal(false);
  readonly sent = signal(false);
  /** Only present when the backend runs with EXPOSE_RESET_TOKEN, i.e. local development. */
  readonly devToken = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  get invalid() {
    const field = this.form.controls.email;
    return field.touched && field.invalid;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.devToken.set(response.reset_token ?? null);
        this.sent.set(true);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.translate.instant('common.error'));
      }
    });
  }
}
