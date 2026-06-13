import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({ standalone: true, imports: [RouterLink], template: `<section class="section text-center"><h1 class="font-serif text-5xl">Order confirmed</h1><p class="mt-4">Order {{ route.snapshot.paramMap.get('orderNumber') }}</p><a class="btn-primary mt-8" routerLink="/">Continue shopping</a></section>` })
export class OrderConfirmationPage { constructor(public route: ActivatedRoute) {} }
