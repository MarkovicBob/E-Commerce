import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_IMAGE_FALLBACK, ImageFallbackDirective } from './image-fallback.directive';

@Component({
  standalone: true,
  imports: [ImageFallbackDirective],
  template: '<img appImageFallback [src]="source" alt="Product" />'
})
class TestHostComponent {
  source = 'https://images.example.test/missing.jpg';
}

describe('ImageFallbackDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('switches a failed product image to the bundled local fallback', () => {
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');
    image.dispatchEvent(new Event('error'));

    expect(image.src).toBe(new URL(DEFAULT_IMAGE_FALLBACK, document.baseURI).href);
  });

  it('does not loop when the fallback itself reports an error', () => {
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');
    image.dispatchEvent(new Event('error'));
    const fallback = image.src;
    image.dispatchEvent(new Event('error'));

    expect(image.src).toBe(fallback);
  });
});
