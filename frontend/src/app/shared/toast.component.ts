import { Component, inject } from '@angular/core';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="fade-in pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-xl"
          [class]="toast.kind === 'error' ? 'bg-red-700 text-white' : 'bg-charcoal text-cream'"
          role="status"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button type="button" class="opacity-70 hover:opacity-100" aria-label="Close" (click)="toasts.dismiss(toast.id)">
            ✕
          </button>
        </div>
      }
    </div>
  `
})
export class ToastComponent {
  readonly toasts = inject(ToastService);
}
