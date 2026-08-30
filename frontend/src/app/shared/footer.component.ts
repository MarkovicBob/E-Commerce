import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NewsletterService } from '../core/services/newsletter.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, RouterLink],
  template: `
    <footer class="mt-20 bg-charcoal text-cream">
      <div class="section grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <h2 class="font-serif text-3xl">{{ 'brand' | translate }}</h2>
          <p class="mt-3 max-w-sm text-sm leading-6 text-cream/60">{{ 'footer.copy' | translate }}</p>
        </div>

        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-cream/80">{{ 'footer.shop' | translate }}</h3>
          <ul class="mt-3 space-y-2 text-sm text-cream/60">
            <li><a class="hover:text-gold" routerLink="/search">{{ 'nav.shop' | translate }}</a></li>
            <li><a class="hover:text-gold" routerLink="/blog">{{ 'nav.blog' | translate }}</a></li>
            <li><a class="hover:text-gold" routerLink="/account">{{ 'nav.account' | translate }}</a></li>
          </ul>
        </div>

        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-cream/80">{{ 'footer.help' | translate }}</h3>
          <ul class="mt-3 space-y-2 text-sm text-cream/60">
            <li>{{ 'footer.shipping' | translate }}</li>
            <li>{{ 'footer.returns' | translate }}</li>
            <li>{{ 'footer.contact' | translate }}</li>
          </ul>
        </div>

        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-cream/80">{{ 'newsletter.title' | translate }}</h3>
          <p class="mt-2 text-sm text-cream/60">{{ 'newsletter.lead' | translate }}</p>
          <form class="mt-4 flex flex-col gap-2 sm:flex-row" [formGroup]="form" (ngSubmit)="submit()">
            <label class="sr-only" for="newsletter-email">{{ 'auth.email' | translate }}</label>
            <input
              id="newsletter-email"
              class="field text-charcoal sm:flex-1"
              type="email"
              formControlName="email"
              [placeholder]="'newsletter.placeholder' | translate"
            />
            <button class="btn-primary" type="submit" [disabled]="form.invalid">
              {{ 'newsletter.submit' | translate }}
            </button>
          </form>
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <p class="mt-2 text-xs text-red-300">{{ 'validation.email' | translate }}</p>
          }
        </div>
      </div>

      <div class="border-t border-cream/10 py-5 text-center text-xs text-cream/45">
        © {{ year }} {{ 'brand' | translate }}. {{ 'footer.rights' | translate }}
      </div>
    </footer>
  `
})
export class FooterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly newsletter = inject(NewsletterService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  readonly year = new Date().getFullYear();
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.newsletter.subscribe(this.form.getRawValue().email).subscribe({
      next: () => {
        this.toast.show(this.translate.instant('newsletter.success'));
        this.form.reset();
      },
      error: () => this.toast.error(this.translate.instant('common.error'))
    });
  }
}
