import { Component, inject } from '@angular/core';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `@if (toast.message()) { <div class="fixed bottom-4 right-4 rounded bg-charcoal px-4 py-3 text-sm text-cream shadow-xl">{{ toast.message() }}</div> }`
})
export class ToastComponent { readonly toast = inject(ToastService); }
