import {describe,expect,it} from 'vitest';
import {change,dateRange,salesSeries,topSellers,totals} from './dashboardStats';
import type {BillingCustomer,InvoiceRecord} from './billing';

const at=(y:number,m:number,d:number,h=0,min=0)=>new Date(y,m-1,d,h,min).getTime();
const line=(variantId:string,name:string,quantity:number,total:string,stockUnit:'UNIT'|'GRAM'='UNIT')=>({productId:'p-'+variantId,variantId,name,variantLabel:'',barcode:'',quantity,unitPricePaise:total,mrpPaise:null,stockUnit,lineDiscountPaise:'0',billDiscountSharePaise:'0',discountPaise:'0',discountReason:null,taxablePaise:total,gstRateBasisPoints:0,cgstPaise:'0',sgstPaise:'0',igstPaise:'0',totalPaise:total});
const invoice=(id:string,createdAt:number,total:string,lines:ReturnType<typeof line>[],type:'SALE'|'RETURN'='SALE')=>({id,number:id,createdAt,lines,grandTotalPaise:total,type} as unknown as InvoiceRecord);
const customer=(id:string,createdAt:number)=>({id,name:id,phone:null,creditLimitPaise:null,balancePaise:'0',onHold:false,createdAt} as BillingCustomer);

describe('dashboard date ranges',()=>{
  const now=at(2026,11,5,14,30);
  it('compares today so far with yesterday up to the same time',()=>{const r=dateRange('TODAY',now);expect(r.start).toBe(at(2026,11,5));expect(r.end).toBe(now);expect(r.previous).toEqual({start:at(2026,11,4),end:at(2026,11,4,14,30)});expect(r.bucket).toBe('HOUR');});
  it('starts weeks on Monday and months on the 1st',()=>{expect(dateRange('THIS_WEEK',now).start).toBe(at(2026,11,2));const m=dateRange('THIS_MONTH',now);expect(m.start).toBe(at(2026,11,1));expect(m.previous!.start).toBe(at(2026,10,1));expect(m.previous!.end).toBe(at(2026,10,5,14,30));});
  it('keeps month shifts on real dates',()=>{const r=dateRange('THIS_MONTH',at(2026,3,31,10));expect(r.previous!.end).toBe(at(2026,2,28,10));});
  it('builds inclusive custom ranges and rejects reversed ones',()=>{const r=dateRange('CUSTOM',now,{from:'2026-10-01',to:'2026-10-10'});expect(r.start).toBe(at(2026,10,1));expect(r.end).toBe(at(2026,10,11));expect(r.previous).toEqual({start:at(2026,9,21),end:at(2026,10,1)});expect(()=>dateRange('CUSTOM',now,{from:'2026-10-10',to:'2026-10-01'})).toThrow(/on or after/);expect(()=>dateRange('CUSTOM',now,{from:'2026-02-30',to:'2026-03-01'})).toThrow(/valid date/);});
  it('has no comparison for all time',()=>{expect(dateRange('ALL_TIME',now,undefined,at(2025,1,1)).previous).toBeNull();});
});

describe('dashboard figures',()=>{
  const day=at(2026,11,5),range={start:day,end:at(2026,11,6)};
  const rows=[invoice('a',at(2026,11,5,9),'10000',[line('rice','Rice',2,'10000')]),invoice('b',at(2026,11,5,11),'5000',[line('sugar','Sugar',1,'5000'),line('dal','Dal',750,'9000','GRAM')]),invoice('r',at(2026,11,5,12),'5000',[line('rice','Rice',1,'5000')],'RETURN'),invoice('old',at(2026,11,4,9),'99900',[line('rice','Rice',9,'99900')])];
  it('nets returns out of sales and items but not bills',()=>{expect(totals(rows,[customer('x',at(2026,11,5,8)),customer('y',at(2026,11,1))],range)).toEqual({salesPaise:10000n,bills:2,items:3,newCustomers:1});});
  it('never divides by zero',()=>{expect(change(10n,0n)).toEqual({kind:'NEW',percent:0});expect(change(0,0)).toEqual({kind:'SAME',percent:0});expect(change(150n,100n)).toEqual({kind:'UP',percent:50});expect(change(50,200)).toEqual({kind:'DOWN',percent:75});expect(change(5,null).kind).toBe('NONE');});
  it('buckets sales by hour for a single day',()=>{const series=salesSeries(rows,{...dateRange('TODAY',at(2026,11,5,13,10))});expect(series).toHaveLength(14);expect(series[9]!.salesPaise).toBe(10000n);expect(series[11]!.salesPaise).toBe(5000n);expect(series[12]!.salesPaise).toBe(-5000n);expect(series.reduce((s,p)=>s+p.salesPaise,0n)).toBe(10000n);});
  it('ranks best sellers by quantity with returns removed',()=>{const top=topSellers(rows,[],range);expect(top.map(t=>[t.name,t.quantity])).toEqual([['Dal',750],['Rice',1],['Sugar',1]]);});
});
