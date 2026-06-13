import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CartService } from './cart.service';

describe('CartService', () => {
  it('starts with zero items', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const service = TestBed.inject(CartService);
    expect(service.count()).toBe(0);
  });
});
