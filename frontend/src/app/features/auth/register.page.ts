import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({ standalone: true, imports: [ReactiveFormsModule], template: `<section class="section max-w-md"><h1 class="font-serif text-4xl">Register</h1><form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()"><input class="field" formControlName="full_name" placeholder="Full name"><input class="field" formControlName="email" type="email" placeholder="Email"><input class="field" formControlName="password" type="password" placeholder="Password"><input class="field" formControlName="referral_code" placeholder="Referral code"><button class="btn-primary">Create account</button></form></section>` })
export class RegisterPage {
  private readonly fb = inject(FormBuilder); private readonly auth = inject(AuthService); private readonly router = inject(Router);
  readonly form = this.fb.nonNullable.group({ full_name: ['', Validators.required], email: ['', [Validators.required, Validators.email]], password: ['', Validators.required], referral_code: [''] });
  submit() { if (this.form.invalid) return; this.auth.register(this.form.getRawValue()).subscribe(() => this.router.navigate(['/account'])); }
}
