import type {AuthService} from './authService';
import type {LocalDatabase} from '../infrastructure/localDatabase';
import {variantAttributesLabel} from '../domain/catalog';
import {formatMoney} from '../domain/money';
import {isStale} from '../domain/heldBills';

export type AppNotification={id:string;tone:'danger'|'warning'|'info';title:string;detail:string;href:string};

const dayKey=(time:number)=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

/** Things that need attention, built from the local data the signed-in person may see. */
export class NotificationService{
  constructor(private readonly database:LocalDatabase,private readonly auth:AuthService){}
  async load():Promise<AppNotification[]>{
    if(!this.auth.getSnapshot())return [];
    const data=await this.database.snapshot(),out:AppNotification[]=[];
    if(this.auth.can('VIEW_STOCK_RECORDS')){
      for(const product of data.products){if(product.tracksStock===false)continue;for(const variant of product.variants){if(variant.stock>variant.lowStockThreshold)continue;const label=`${product.name}${variantAttributesLabel(variant)?` (${variantAttributesLabel(variant)})`:''}`;out.push(variant.stock<=0?{id:`out:${variant.id}`,tone:'danger',title:`${label} is out of stock`,detail:'Restock or reorder this item.',href:'/stock/alerts'}:{id:`low:${variant.id}:${variant.stock}`,tone:'warning',title:`${label} is running low`,detail:`Only ${variant.stock} left (alert level ${variant.lowStockThreshold}).`,href:'/stock/alerts'});}}
      const today=dayKey(Date.now()),limitDate=new Date();limitDate.setDate(limitDate.getDate()+(data.shop?.expiryWarningDays??30));const limit=dayKey(limitDate.getTime()),names=new Map(data.products.flatMap(p=>p.variants.map(v=>[v.id,p.name])));
      for(const batch of data.stockBatches){if(batch.quantity<=0||!batch.expiryDate||batch.expiryDate>limit)continue;const name=names.get(batch.variantId)??'A product',expired=batch.expiryDate<today;out.push({id:`exp:${batch.id}:${expired?'x':'s'}`,tone:expired?'danger':'warning',title:expired?`${name} batch has expired`:`${name} expires soon`,detail:`${batch.batchNumber?`Batch ${batch.batchNumber} · `:''}${batch.quantity} left · expiry ${batch.expiryDate}`,href:'/stock/expiring'});}
    }
    if(this.auth.can('MANAGE_CUSTOMERS')){
      for(const customer of data.customers){const balance=BigInt(customer.balancePaise);if(balance<=0n)continue;const limit=customer.creditLimitPaise===null?null:BigInt(customer.creditLimitPaise);if(limit!==null&&balance>limit)out.push({id:`limit:${customer.id}:${customer.balancePaise}`,tone:'danger',title:`${customer.name} is over the credit limit`,detail:`Owes ${formatMoney(balance)} against a limit of ${formatMoney(limit)}.`,href:`/customers?customer=${customer.id}`});}
    }
    if(this.auth.can('SELL')){const stale=data.heldBills.filter(bill=>isStale(bill));if(stale.length)out.push({id:`held:${stale.map(b=>b.id).sort().join(',')}`,tone:'info',title:`${stale.length} held bill${stale.length===1?'':'s'} waiting`,detail:'Resume or discard old held bills.',href:'/pos?held=1'});}
    return out;
  }
}
