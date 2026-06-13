import { Component, Input } from '@angular/core';

@Component({ selector: 'app-skeleton-loader', standalone: true, template: `<div class="h-40 animate-pulse rounded bg-charcoal/10"></div>` })
export class SkeletonLoaderComponent {}

@Component({ selector: 'app-modal', standalone: true, template: `<div class="fixed inset-0 grid place-items-center bg-black/40"><div class="rounded bg-cream p-6"><ng-content /></div></div>` })
export class ModalComponent {}

@Component({ selector: 'app-star-rating', standalone: true, template: `<span class="text-gold">{{ stars }}</span>` })
export class StarRatingComponent { @Input() value = 0; get stars() { return '★★★★★'.slice(0, Math.round(this.value)); } }

@Component({ selector: 'app-confirm-dialog', standalone: true, template: `<button class="btn-secondary"><ng-content /></button>` })
export class ConfirmDialogComponent {}
