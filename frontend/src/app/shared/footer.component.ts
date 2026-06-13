import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NewsletterService } from '../core/services/newsletter.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  template: `
    <footer class="mt-16 bg-charcoal text-cream">
      <div class="section grid gap-8 md:grid-cols-[1fr_1fr]">
        <div><h2 class="font-serif text-3xl">Luxe Commerce</h2><p class="mt-3 max-w-md text-cream/70">{{ 'footer.copy' | translate }}</p></div>
        <form class="flex gap-2 self-end" [formGroup]="form" (ngSubmit)="submit()">
          <input class="field text-charcoal" type="email" formControlName="email" placeholder="newsletter@example.com">
          <button class="btn-primary" type="submit">{{ 'newsletter.submit' | translate }}</button>
        </form>
      </div>
    </footer>
  `
})
export class FooterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly newsletter = inject(NewsletterService);
  private readonly toast = inject(ToastService);
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  submit() {
    if (this.form.invalid) return;
    this.newsletter.subscribe(this.form.getRawValue().email).subscribe(() => this.toast.show('Subscribed'));
  }
}
