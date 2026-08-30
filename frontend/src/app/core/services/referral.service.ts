import { inject, Injectable } from '@angular/core';
import { Referral } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly api = inject(ApiService);
  me() {
    return this.api.get<Referral>('/referrals/me');
  }
}
