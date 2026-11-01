import {expect,it} from 'vitest';
import {DEFAULT_LOYALTY_RULES,maxRedeemable,onTimeBonusPoints,pointsEarned,pointsToReverse,validateLoyaltyRules,type LoyaltyEntry} from './loyalty';
import type {CustomerLedgerEntry} from './billing';
const rules=validateLoyaltyRules(true,'100','1');
it('validates rules and calculates whole points, redemption caps and proportional reversals',()=>{
  expect(rules).toEqual({enabled:true,spendPerPointPaise:'10000',pointValuePaise:'100'});
  expect(pointsEarned(rules,'29999')).toBe(2);expect(maxRedeemable(rules,40,10000n)).toBe(40);expect(maxRedeemable(rules,40,100n)).toBe(0);
  expect(pointsToReverse(9,'10000',5000n,0,9)).toBe(4);expect(pointsToReverse(9,'10000',10000n,4,2)).toBe(2);
  expect(()=>validateLoyaltyRules(true,'10','11')).toThrow(/cannot be worth more/);expect(DEFAULT_LOYALTY_RULES.enabled).toBe(false);
});
it('awards a configured bonus only when a full customer balance is cleared within 30 days',()=>{
  const start=Date.parse('2026-10-01T12:00:00Z'),money:CustomerLedgerEntry[]=[{id:'sale',customerId:'c',type:'SALE',amountPaise:'5000',invoiceId:'i',invoiceNumber:'INV',method:'CREDIT',reference:null,createdAt:start,note:null}];
  expect(onTimeBonusPoints(true,10,money,'5000','5000',start+30*86_400_000)).toBe(10);
  expect(onTimeBonusPoints(true,10,money,'4000','5000',start)).toBe(0);
  expect(onTimeBonusPoints(false,10,money,'5000','5000',start)).toBe(0);
});
