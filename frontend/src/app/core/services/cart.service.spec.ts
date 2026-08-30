import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Cart } from '../models';
import { CartService } from './cart.service';
import { LanguageService } from './language.service';

function cartFixture(overrides: Partial<Cart> = {}): Cart {
  return {
    id: 1,
    promo_code: null,
    promo_invalid: false,
    items: [
      {
        id: 10,
        product_id: 5,
        variant_id: 2,
        name: 'Meridian sat',
        slug: 'meridian-sat',
        brand: 'Maison Aurea',
        image_url: 'https://example.test/a.jpg',
        size: '40 mm',
        color: 'Čelik',
        quantity: 2,
        unit_price: 1500,
        line_total: 3000,
        stock_quantity: 5,
        in_stock: true
      }
    ],
    item_count: 2,
    subtotal: 3000,
    discount_total: 0,
    shipping_cost: 500,
    shipping_method: 'standard',
    total: 3500,
    has_stock_issue: false,
    ...overrides
  };
}

describe('CartService', () => {
  let service: CartService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LanguageService, useValue: { lang: () => 'en' } }
      ]
    });
    service = TestBed.inject(CartService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts empty', () => {
    expect(service.count()).toBe(0);
    expect(service.isEmpty()).toBeTrue();
  });

  it('counts units rather than lines', () => {
    service.load().subscribe();
    http.expectOne((req) => req.url === `${environment.apiBaseUrl}/cart`).flush(cartFixture());

    expect(service.count()).toBe(2);
    expect(service.items().length).toBe(1);
    expect(service.isEmpty()).toBeFalse();
  });

  it('sends the variant id when adding a configured product', () => {
    service.add(5, 2, 3).subscribe();
    const request = http.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/cart/items` && req.params.get('lang') === 'en'
    );

    expect(request.request.body).toEqual({ product_id: 5, variant_id: 2, quantity: 3 });
    request.flush(cartFixture());
    expect(service.count()).toBe(2);
  });

  it('reflects the promo returned by the server', () => {
    service.applyPromo('LUXE10').subscribe();
    http
      .expectOne((req) => req.url === `${environment.apiBaseUrl}/cart/apply-promo` && req.params.get('lang') === 'en')
      .flush(cartFixture({ promo_code: 'LUXE10', discount_total: 300, total: 3200 }));

    expect(service.cart()?.promo_code).toBe('LUXE10');
    expect(service.cart()?.discount_total).toBe(300);
  });

  it('clears local state on reset', () => {
    service.load().subscribe();
    http.expectOne((req) => req.url === `${environment.apiBaseUrl}/cart`).flush(cartFixture());
    service.reset();

    expect(service.cart()).toBeNull();
    expect(service.count()).toBe(0);
  });
});
