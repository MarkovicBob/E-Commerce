import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

type Currency = 'RSD' | 'USD' | 'EUR';

const LANGUAGE_CURRENCY: Record<string, Currency> = { sr: 'RSD', en: 'USD', de: 'EUR' };
const CURRENCY_LOCALE: Record<Currency, string> = { RSD: 'sr-Latn-RS', USD: 'en-US', EUR: 'de-DE' };

/** Converts the RSD source amount into the currency of the currently selected language. */
@Pipe({ name: 'price', standalone: true, pure: false })
export class PricePipe implements PipeTransform {
  transform(value: number | null | undefined, currency?: Currency): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '';
    const language = document.documentElement.lang.split('-')[0] || 'sr';
    const target = currency ?? LANGUAGE_CURRENCY[language] ?? 'RSD';
    const converted = target === 'EUR'
      ? amount / environment.rsdEurRate
      : target === 'USD'
        ? amount / environment.rsdUsdRate
        : amount;
    return new Intl.NumberFormat(CURRENCY_LOCALE[target], {
      style: 'currency',
      currency: target,
      currencyDisplay: target === 'RSD' ? 'code' : 'symbol',
      minimumFractionDigits: target === 'RSD' ? 0 : 2,
      maximumFractionDigits: target === 'RSD' ? 0 : 2
    }).format(converted);
  }
}
