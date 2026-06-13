import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';

@Component({ standalone: true, imports: [ReactiveFormsModule, RouterLink], template: `<section class="section max-w-md"><h1 class="font-serif text-4xl">Login</h1><form class="mt-8 grid gap-4" [formGroup]="form" (ngSubmit)="submit()"><input class="field" formControlName="email" type="email"><input class="field" formControlName="password" type="password"><button class="btn-primary">Login</button><a routerLink="/forgot-password">Forgot password?</a></form></section>` })
export class LoginPage {
  private readonly fb = inject(FormBuilder); private readonly auth = inject(AuthService); private readonly cart = inject(CartService); private readonly router = inject(Router);
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  submit() { if (this.form.invalid) return; this.auth.login(this.form.value.email!, this.form.value.password!).subscribe(() => this.cart.merge().subscribe(() => this.router.navigate(['/account']))); }
}
