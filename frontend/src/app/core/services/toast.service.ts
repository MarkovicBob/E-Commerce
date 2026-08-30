import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, kind: Toast['kind'] = 'success') {
    const toast: Toast = { id: this.nextId++, message, kind };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), 3500);
  }

  error(message: string) {
    this.show(message, 'error');
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((item) => item.id !== id));
  }
}
