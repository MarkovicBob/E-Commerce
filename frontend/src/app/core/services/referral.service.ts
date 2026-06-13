import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly api = inject(ApiService);
  me() { return this.api.get<{ referral_code: string; referral_link: string; completed_referrals: number; coupons: unknown[] }>('/referrals/me'); }
}
