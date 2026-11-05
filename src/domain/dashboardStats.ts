import type {BillingCustomer,InvoiceRecord} from './billing';
import type {Product} from './catalog';

export type RangePreset='TODAY'|'LAST_7_DAYS'|'THIS_WEEK'|'THIS_MONTH'|'LAST_3_MONTHS'|'LAST_6_MONTHS'|'LAST_YEAR'|'ALL_TIME'|'CUSTOM';
export const RANGE_LABELS:Record<RangePreset,string>={TODAY:'Today',LAST_7_DAYS:'Last 7 Days',THIS_WEEK:'Weekly',THIS_MONTH:'Monthly',LAST_3_MONTHS:'Last 3 Months',LAST_6_MONTHS:'Last 6 Months',LAST_YEAR:'Last 1 Year',ALL_TIME:'All Time',CUSTOM:'Custom Range'};
export const COMPARE_LABELS:Record<RangePreset,string>={TODAY:'vs yesterday',LAST_7_DAYS:'vs previous 7 days',THIS_WEEK:'vs last week',THIS_MONTH:'vs last month',LAST_3_MONTHS:'vs previous 3 months',LAST_6_MONTHS:'vs previous 6 months',LAST_YEAR:'vs previous year',ALL_TIME:'',CUSTOM:'vs previous period'};
export type Bucket='HOUR'|'DAY'|'WEEK'|'MONTH';
/** Half-open time window [start,end) in local time, with the window it is compared against. */
export type DateRange={preset:RangePreset;start:number;end:number;previous:{start:number;end:number}|null;bucket:Bucket};

const startOfDay=(time:number)=>{const d=new Date(time);d.setHours(0,0,0,0);return d.getTime();};
const addDays=(time:number,days:number)=>{const d=new Date(time);d.setDate(d.getDate()+days);return d.getTime();};
/** Calendar-month shift that keeps the day where possible (31 Mar - 1 month = 28/29 Feb). */
const addMonths=(time:number,months:number)=>{const d=new Date(time),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d.getTime();};
const parseDay=(text:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);if(!m)throw new Error('Choose a valid date.');const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));if(d.getMonth()!==Number(m[2])-1)throw new Error('Choose a valid date.');return d.getTime();};
const bucketFor=(start:number,end:number):Bucket=>{const days=(end-start)/86400000;return days<=1.05?'HOUR':days<=62?'DAY':days<=200?'WEEK':'MONTH';};

/**
 * Builds the selected window. Ranges that end "now" are compared with the same
 * stretch of the previous period (today so far vs yesterday up to the same time).
 */
export function dateRange(preset:RangePreset,now=Date.now(),custom?:{from:string;to:string},firstActivity?:number):DateRange{
  const today=startOfDay(now);
  const shifted=(start:number,shift:(t:number)=>number)=>({start:shift(start),end:shift(now)});
  switch(preset){
    case 'TODAY':return {preset,start:today,end:now,previous:shifted(today,t=>addDays(t,-1)),bucket:'HOUR'};
    case 'LAST_7_DAYS':{const start=addDays(today,-6);return {preset,start,end:now,previous:shifted(start,t=>addDays(t,-7)),bucket:'DAY'};}
    case 'THIS_WEEK':{const back=(new Date(today).getDay()+6)%7,start=addDays(today,-back);return {preset,start,end:now,previous:shifted(start,t=>addDays(t,-7)),bucket:'DAY'};}
    case 'THIS_MONTH':{const d=new Date(today);d.setDate(1);const start=d.getTime();return {preset,start,end:now,previous:shifted(start,t=>addMonths(t,-1)),bucket:'DAY'};}
    case 'LAST_3_MONTHS':case 'LAST_6_MONTHS':case 'LAST_YEAR':{const months=preset==='LAST_3_MONTHS'?3:preset==='LAST_6_MONTHS'?6:12,start=addDays(addMonths(today,-months),1);return {preset,start,end:now,previous:shifted(start,t=>addMonths(t,-months)),bucket:months===3?'WEEK':'MONTH'};}
    case 'ALL_TIME':{const start=startOfDay(Math.min(firstActivity??today,today));return {preset,start,end:now,previous:null,bucket:bucketFor(start,now)==='HOUR'?'DAY':bucketFor(start,now)};}
    case 'CUSTOM':{if(!custom)throw new Error('Choose a start and end date.');const from=parseDay(custom.from),to=parseDay(custom.to);if(to<from)throw new Error('The end date must be on or after the start date.');const end=Math.min(addDays(to,1),Math.max(now,from+1)),days=Math.round((addDays(to,1)-from)/86400000);return {preset,start:from,end,previous:{start:addDays(from,-days),end:addDays(end,-days)},bucket:bucketFor(from,addDays(to,1))};}
  }
}

export type Change={kind:'UP'|'DOWN'|'SAME'|'NEW'|'NONE';percent:number};
/** Percentage change that never divides by zero. */
export function change(current:bigint|number,previous:bigint|number|null):Change{
  if(previous===null)return {kind:'NONE',percent:0};
  const cur=Number(current),prev=Number(previous);
  if(prev===0)return cur===0?{kind:'SAME',percent:0}:{kind:'NEW',percent:0};
  const percent=Math.round(((cur-prev)/Math.abs(prev))*1000)/10;
  return {kind:percent>0?'UP':percent<0?'DOWN':'SAME',percent:Math.abs(percent)};
}

const isReturn=(invoice:InvoiceRecord)=>invoice.type==='RETURN';
const inRange=(time:number,range:{start:number;end:number})=>time>=range.start&&time<range.end;
/** Items count: whole units count by quantity; weighed or measured lines count once. */
const itemCount=(invoice:InvoiceRecord)=>invoice.lines.reduce((sum,line)=>sum+(line.stockUnit==='UNIT'||!line.stockUnit?line.quantity:1),0);

export type Totals={salesPaise:bigint;bills:number;items:number;newCustomers:number};
export function totals(invoices:readonly InvoiceRecord[],customers:readonly BillingCustomer[],range:{start:number;end:number}):Totals{
  let salesPaise=0n,bills=0,items=0;
  for(const invoice of invoices){if(!inRange(invoice.createdAt,range))continue;const sign=isReturn(invoice)?-1:1;salesPaise+=BigInt(sign)*BigInt(invoice.grandTotalPaise);items+=sign*itemCount(invoice);if(!isReturn(invoice))bills++;}
  return {salesPaise,bills,items,newCustomers:customers.filter(c=>inRange(c.createdAt,range)).length};
}

export type SeriesPoint={start:number;end:number;label:string;tooltip:string;salesPaise:bigint};
function bucketStarts(range:DateRange):number[]{
  const out:number[]=[];let t=range.start;
  if(range.bucket==='HOUR'){const end=Math.max(range.end,range.start+1);for(let h=0;h<24;h++){const at=range.start+h*3600000;if(at>=end&&out.length>=1)break;out.push(at);}return out;}
  if(range.bucket==='WEEK'){while(t<range.end){out.push(t);t=addDays(t,7);}return out;}
  if(range.bucket==='MONTH'){const d=new Date(range.start);d.setDate(1);t=d.getTime();while(t<range.end){out.push(t);t=addMonths(t,1);}return out;}
  while(t<range.end){out.push(t);t=addDays(t,1);}return out;
}
/** Net sales grouped by hour, day, week or month across the window. */
export function salesSeries(invoices:readonly InvoiceRecord[],range:DateRange,locale?:string):SeriesPoint[]{
  const starts=bucketStarts(range);
  const points=starts.map((start,i)=>{const next=starts[i+1]??range.end,from=Math.max(start,range.start),d=new Date(start);
    const label=range.bucket==='HOUR'?d.toLocaleTimeString(locale,{hour:'numeric'}):range.bucket==='MONTH'?d.toLocaleDateString(locale,{month:'short',year:starts.length>12?'2-digit':undefined}):d.toLocaleDateString(locale,{day:'numeric',month:'short'});
    const tooltip=range.bucket==='HOUR'?`${d.toLocaleDateString(locale,{day:'numeric',month:'short'})}, ${d.toLocaleTimeString(locale,{hour:'numeric'})}–${new Date(start+3600000).toLocaleTimeString(locale,{hour:'numeric'})}`:range.bucket==='WEEK'?`Week of ${new Date(from).toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'})}`:range.bucket==='MONTH'?d.toLocaleDateString(locale,{month:'long',year:'numeric'}):d.toLocaleDateString(locale,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    return {start:from,end:next,label,tooltip,salesPaise:0n};});
  for(const invoice of invoices){if(!inRange(invoice.createdAt,range))continue;const point=points.find(p=>invoice.createdAt>=p.start&&invoice.createdAt<p.end);if(point)point.salesPaise+=(isReturn(invoice)?-1n:1n)*BigInt(invoice.grandTotalPaise);}
  return points;
}

export type TopItem={key:string;name:string;label:string;quantity:number;rank:number;stockUnit:'UNIT'|'GRAM'|'MILLILITRE';photoId:string|null;revenuePaise:bigint};
/** Best sellers by quantity sold (returns subtracted), most first. */
export function topSellers(invoices:readonly InvoiceRecord[],products:readonly Product[],range:{start:number;end:number},limit=5):TopItem[]{
  const variants=new Map(products.flatMap(p=>p.variants.map(v=>[v.id,{product:p,variant:v}] as const)));
  const byKey=new Map<string,TopItem>();
  for(const invoice of invoices){if(!inRange(invoice.createdAt,range))continue;const sign=isReturn(invoice)?-1:1;for(const line of invoice.lines){const key=line.variantId??`custom:${line.name.toLowerCase()}`;const found=line.variantId?variants.get(line.variantId):undefined;const row=byKey.get(key)??{key,name:line.name,label:line.variantLabel,quantity:0,rank:0,stockUnit:line.stockUnit??'UNIT',photoId:found?(found.variant.photoId??found.product.photoId??null):null,revenuePaise:0n};row.quantity+=sign*line.quantity;row.rank+=sign*(line.stockUnit==='UNIT'||!line.stockUnit?line.quantity:1);row.revenuePaise+=BigInt(sign)*BigInt(line.totalPaise);byKey.set(key,row);}}
  return [...byKey.values()].filter(row=>row.quantity>0&&row.rank>0).sort((a,b)=>b.rank-a.rank||Number(b.revenuePaise-a.revenuePaise)||a.name.localeCompare(b.name)).slice(0,limit);
}
