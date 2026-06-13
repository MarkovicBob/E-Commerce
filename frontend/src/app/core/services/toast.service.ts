import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  show(message: string) { this.message.set(message); setTimeout(() => this.message.set(null), 2500); }
}
