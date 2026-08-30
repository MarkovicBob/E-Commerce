import { PricePipe } from './price.pipe';

describe('PricePipe', () => {
  const pipe = new PricePipe();

  afterEach(() => document.documentElement.setAttribute('lang', 'sr'));

  it('formats RSD without decimals', () => {
    document.documentElement.setAttribute('lang', 'sr');
    expect(pipe.transform(12500)).toContain('RSD');
    expect(pipe.transform(12500)).toContain('12');
  });

  it('converts to USD when English is selected', () => {
    document.documentElement.setAttribute('lang', 'en');
    expect(pipe.transform(10079.06)).toContain('$100.00');
  });

  it('converts to EUR when German is selected', () => {
    document.documentElement.setAttribute('lang', 'de');
    expect(pipe.transform(11737.07)).toContain('100,00');
    expect(pipe.transform(11737.07)).toContain('€');
  });

  it('treats null and undefined as zero rather than crashing', () => {
    expect(pipe.transform(null)).toContain('0');
    expect(pipe.transform(undefined)).toContain('0');
  });

  it('returns an empty string for a non-finite amount', () => {
    expect(pipe.transform(Number.NaN)).toBe('');
  });
});
