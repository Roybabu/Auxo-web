import type {InvoiceRecord,CustomerLedgerEntry} from './billing';
import {parseMoney} from './money';

export type LoyaltyRules={enabled:boolean;spendPerPointPaise:string;pointValuePaise:string};
export const DEFAULT_LOYALTY_RULES:LoyaltyRules={enabled:false,spendPerPointPaise:'10000',pointValuePaise:'100'};
export type LoyaltyEntryType='EARNED'|'REDEEMED'|'REVERSED'|'ON_TIME_BONUS';
export type LoyaltyEntry={id:string;customerId:string;type:LoyaltyEntryType;points:number;invoiceId:string|null;sourceInvoiceId:string|null;createdAt:number;note:string|null};
export const POINT_SPEND_MIN=100n,POINT_SPEND_MAX=10_000_000n,POINT_VALUE_MIN=1n,POINT_VALUE_MAX=100_000n,MIN_LEFT_TO_PAY=100n,ON_TIME_DAYS=30;
export function validateLoyaltyRules(enabled:boolean,spendText:string,valueText:string):LoyaltyRules{
  const spend=parseMoney(spendText),value=parseMoney(valueText);
  if(spend===null||spend<POINT_SPEND_MIN||spend>POINT_SPEND_MAX)throw new Error('Spend for one point must be between ₹1 and ₹1,00,000.');
  if(value===null||value<POINT_VALUE_MIN||value>POINT_VALUE_MAX)throw new Error('One point must be worth between ₹0.01 and ₹1,000.');
  if(value>spend)throw new Error('A point cannot be worth more than the spending that earns it.');
  return {enabled,spendPerPointPaise:spend.toString(),pointValuePaise:value.toString()};
}
export function pointsBalance(entries:readonly LoyaltyEntry[]){return entries.reduce((n,e)=>n+e.points,0);}
export function pointsEarned(rules:LoyaltyRules,billTotalPaise:string){if(!rules.enabled)return 0;const points=BigInt(billTotalPaise)/BigInt(rules.spendPerPointPaise);return Number(points>2_147_483_647n?2_147_483_647n:points);}
export function pointValue(rules:LoyaltyRules,points:number){return BigInt(rules.pointValuePaise)*BigInt(Math.max(0,points));}
export function maxRedeemable(rules:LoyaltyRules,balance:number,billBeforePoints:bigint){if(!rules.enabled||balance<=0)return 0;const room=billBeforePoints-MIN_LEFT_TO_PAY;if(room<=0n)return 0;return Math.min(balance,Number(room/BigInt(rules.pointValuePaise)));}
export function pointsToReverse(earned:number,saleTotalPaise:string,creditedAfterPaise:bigint,alreadyReversed:number,available:number){const sale=BigInt(saleTotalPaise);if(earned<=0||sale<=0n||available<=0)return 0;const credited=creditedAfterPaise<0n?0n:creditedAfterPaise>sale?sale:creditedAfterPaise;const target=Number(BigInt(earned)*credited/sale);return Math.min(Math.max(0,target-alreadyReversed),available);}
export function owingSince(entries:readonly CustomerLedgerEntry[]){const rows=entries.filter(e=>e.type==='SALE'||e.type==='PAYMENT'||e.type==='RETURN').sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));let balance=0n;for(const e of rows)balance+=BigInt(e.amountPaise);if(balance<=0n)return null;const open:{time:number;amount:bigint}[]=[];let credit=0n;for(const e of rows){const amount=BigInt(e.amountPaise);if(amount>0n){const used=credit<amount?credit:amount;credit-=used;if(amount>used)open.push({time:e.createdAt,amount:amount-used});}else if(amount<0n){let pay=-amount;while(pay>0n&&open.length){const first=open[0]!;if(first.amount<=pay){pay-=first.amount;open.shift();}else{first.amount-=pay;pay=0n;}}credit+=pay;}}return open[0]?.time??null;}
export function onTimeBonusPoints(enabled:boolean,configured:number,entries:readonly CustomerLedgerEntry[],amountPaise:string,balancePaise:string,now:number){if(!enabled||configured<=0||BigInt(amountPaise)!==BigInt(balancePaise))return 0;const since=owingSince(entries);if(since===null)return 0;return Math.floor((now-since)/86_400_000)<=ON_TIME_DAYS?configured:0;}
export function pointReversalForReturn(entries:readonly LoyaltyEntry[],customerId:string,original:InvoiceRecord,creditNotes:readonly InvoiceRecord[]){const earned=entries.filter(e=>e.customerId===customerId&&e.type==='EARNED'&&e.invoiceId===original.id).reduce((n,e)=>n+e.points,0);const already=entries.filter(e=>e.customerId===customerId&&e.type==='REVERSED'&&e.sourceInvoiceId===original.id).reduce((n,e)=>n-e.points,0);const available=pointsBalance(entries);const credited=creditNotes.filter(i=>i.originalInvoiceId===original.id).reduce((n,i)=>n+BigInt(i.grandTotalPaise),0n);return pointsToReverse(earned,original.grandTotalPaise,credited,already,available);}
