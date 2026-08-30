import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  template: `
    <div class="animate-pulse space-y-3">
      <div class="rounded bg-charcoal/10" [style.height.px]="height"></div>
      @if (lines > 0) {
        @for (line of placeholders; track line) {
          <div class="h-3 rounded bg-charcoal/10" [style.width]="line === lines - 1 ? '66%' : '100%'"></div>
        }
      }
    </div>
  `
})
export class SkeletonLoaderComponent {
  @Input() height = 240;
  @Input() lines = 2;
  get placeholders() {
    return Array.from({ length: this.lines }, (_, index) => index);
  }
}

@Component({
  selector: 'app-star-rating',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-1" [attr.aria-label]="value + ' / 5'">
      <span class="text-gold" aria-hidden="true">
        @for (star of stars; track star) {
          <span [class.opacity-25]="star > rounded">★</span>
        }
      </span>
      @if (showValue) {
        <span class="text-xs text-charcoal/60">{{ value.toFixed(1) }}@if (count !== null) { ({{ count }}) }</span>
      }
    </span>
  `
})
export class StarRatingComponent {
  @Input() value = 0;
  @Input() count: number | null = null;
  @Input() showValue = true;
  readonly stars = [1, 2, 3, 4, 5];
  get rounded() {
    return Math.round(this.value);
  }
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslateModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-charcoal/50 p-4" (click)="cancelled.emit()">
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="font-serif text-2xl">{{ title }}</h2>
          <p class="mt-3 text-sm text-charcoal/70">{{ message }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn-secondary" (click)="cancelled.emit()">
              {{ 'common.cancel' | translate }}
            </button>
            <button type="button" class="btn-danger" (click)="confirmed.emit()">
              {{ 'common.confirm' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [TranslateModule],
  template: `
    @if (pages > 1) {
      <nav class="mt-10 flex flex-wrap items-center justify-center gap-2" [attr.aria-label]="'catalog.page' | translate">
        <button type="button" class="page-btn" [disabled]="page <= 1" (click)="changed.emit(page - 1)">
          {{ 'catalog.previous' | translate }}
        </button>
        @for (item of visiblePages; track item) {
          @if (item === -1) {
            <span class="px-2 text-charcoal/40">…</span>
          } @else {
            <button
              type="button"
              class="page-btn"
              [class.page-btn-active]="item === page"
              [attr.aria-current]="item === page ? 'page' : null"
              (click)="changed.emit(item)"
            >
              {{ item }}
            </button>
          }
        }
        <button type="button" class="page-btn" [disabled]="page >= pages" (click)="changed.emit(page + 1)">
          {{ 'catalog.next' | translate }}
        </button>
      </nav>
    }
  `
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() pages = 1;
  @Output() changed = new EventEmitter<number>();

  /** Window of pages around the current one; -1 renders an ellipsis. */
  get visiblePages(): number[] {
    const total = this.pages;
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    const window = new Set<number>([1, total, this.page, this.page - 1, this.page + 1]);
    const sorted = [...window].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
    const result: number[] = [];
    sorted.forEach((value, index) => {
      if (index > 0 && value - sorted[index - 1] > 1) result.push(-1);
      result.push(value);
    });
    return result;
  }
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="rounded-lg border border-dashed border-charcoal/20 bg-white/60 px-6 py-16 text-center">
      <p class="font-serif text-2xl">{{ title }}</p>
      @if (hint) {
        <p class="mx-auto mt-2 max-w-md text-sm text-charcoal/60">{{ hint }}</p>
      }
      <div class="mt-6"><ng-content /></div>
    </div>
  `
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() hint = '';
}
