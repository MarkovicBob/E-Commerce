import { Directive, ElementRef, HostListener, Input } from '@angular/core';

export const DEFAULT_IMAGE_FALLBACK = '/assets/images/product-placeholder.svg';

/** Replaces a failed remote/uploaded image without creating an error loop. */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {
  @Input() appImageFallback = DEFAULT_IMAGE_FALLBACK;

  constructor(private readonly host: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  useFallback() {
    const image = this.host.nativeElement;
    const fallback = new URL(this.appImageFallback || DEFAULT_IMAGE_FALLBACK, document.baseURI).href;
    if (image.src !== fallback) image.src = fallback;
  }
}
