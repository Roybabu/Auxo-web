import type { CartLine, DiscountDraft } from './billing';
import { parseMoney } from './money';

export const DEFAULT_TABLES=10,MAX_TABLES=99,LABEL_MAX=40,STALE_HOURS=2;
export type HeldBill={id:string;label:string;createdAt:number;updatedAt:number;itemCount:number;totalPaise:string;tableNumber:number|null;tokenNumber:number|null;lines:CartLine[];discount:DiscountDraft;interState:boolean;customerId:string;buyerName?:string;buyerPhone?:string;buyerGstin?:string};
export type HeldBillDraft=Omit<HeldBill,'id'|'createdAt'|'updatedAt'|'tokenNumber'>;
export type SplitSelection={remaining:CartLine[];moved:CartLine[]};
export function cleanHeldLabel(label:string){return label.replace(/\s+/g,' ').trim().slice(0,LABEL_MAX);}
export function parseTableCount(text:string){const value=text.trim();if(!/^\d{1,2}$/.test(value))return null;const n=Number(value);return n>=1&&n<=MAX_TABLES?n:null;}
export function busyTables(bills:readonly HeldBill[],exceptId?:string){return new Set(bills.filter(b=>b.id!==exceptId&&b.tableNumber!==null).map(b=>b.tableNumber as number));}
export function nextToken(bills:readonly HeldBill[],exceptId?:string){const used=new Set(bills.filter(b=>b.id!==exceptId).map(b=>b.tokenNumber).filter((v):v is number=>v!==null));let n=1;while(used.has(n))n++;return n;}
export function isStale(bill:HeldBill,now=Date.now()){return now-bill.updatedAt>=STALE_HOURS*60*60*1000;}
export function splitBillByItems(lines:readonly CartLine[],selection:Record<string,number>,hasBillDiscount:boolean):SplitSelection{
  if(hasBillDiscount)throw new Error('Remove the bill discount before splitting by item.');
  const known=new Set(lines.map(l=>l.variantId));if(Object.keys(selection).some(id=>!known.has(id)))throw new Error('Selected item is no longer on this bill.');
  const moved:CartLine[]=[],remaining:CartLine[]=[];
  const halfUp=(n:bigint,d:bigint)=>(n+d/2n)/d;
  for(const line of lines){const qty=selection[line.variantId]??0;if(!Number.isInteger(qty)||qty<0||qty>line.quantity)throw new Error('Selected quantity is invalid.');if(line.stockUnit!=='UNIT'&&qty!==0&&qty!==line.quantity)throw new Error('Weighted items must be split as a whole line.');if(!qty){remaining.push(line);continue;}if(qty===line.quantity){moved.push(line);continue;}
    let movingDiscount=line.lineDiscount,remainingDiscount=line.lineDiscount;
    if(line.lineDiscount?.kind==='AMOUNT'){
      const amount=parseMoney(line.lineDiscount.value);if(amount===null)throw new Error('Line discount is invalid.');const share=halfUp(amount*BigInt(qty),BigInt(line.quantity));
      const reason=line.lineDiscount.reason;movingDiscount=share>0n?{kind:'AMOUNT',value:`${share/100n}.${String(share%100n).padStart(2,'0')}`,reason}:null;
      const rest=amount-share;remainingDiscount=rest>0n?{kind:'AMOUNT',value:`${rest/100n}.${String(rest%100n).padStart(2,'0')}`,reason}:null;
    }
    remaining.push({...line,quantity:line.quantity-qty,lineDiscount:remainingDiscount});moved.push({...line,quantity:qty,lineDiscount:movingDiscount});
  }
  if(!moved.length)throw new Error('Choose at least one item to move to another bill.');if(!remaining.length)throw new Error('At least one item must stay on the current bill.');return {remaining,moved};
}
export function equalBillShares(totalPaise:bigint,people:number){if(!Number.isInteger(people)||people<2||people>20)throw new Error('Choose between 2 and 20 people.');const share=totalPaise/BigInt(people),remainder=Number(totalPaise%BigInt(people));return Array.from({length:people},(_,i)=>share+(i<remainder?1n:0n));}
