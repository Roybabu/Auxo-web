import type {AuthService} from './authService';
import type {BusinessSnapshot} from '../domain/backup';
import type {LocalDatabase} from '../infrastructure/localDatabase';

export type DashboardData={today:string;salesTodayPaise:string;billsToday:number;returnsToday:number;receivablesPaise:string;customers:number;products:number;lowStock:number;expired:number;expiring:number;days:{label:string;date:string;netPaise:string;count:number}[];recentInvoices:BusinessSnapshot['invoices'];activity:BusinessSnapshot['auditLog']};
const dayKey=(time:number)=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const signedTotal=(invoice:BusinessSnapshot['invoices'][number])=>(invoice.type==='RETURN'?-1n:1n)*BigInt(invoice.grandTotalPaise);

export class DashboardService{
  constructor(private readonly database:LocalDatabase,private readonly auth:AuthService){}
  async load():Promise<DashboardData>{
    await this.auth.require('VIEW_DASHBOARD');const data=await this.database.snapshot(),today=dayKey(Date.now()),days=Array.from({length:7},(_,index)=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-(6-index));const key=dayKey(date.getTime());const rows=data.invoices.filter(invoice=>dayKey(invoice.createdAt)===key);return {date:key,label:date.toLocaleDateString(undefined,{weekday:'short'}),netPaise:rows.reduce((total,invoice)=>total+signedTotal(invoice),0n).toString(),count:rows.filter(invoice=>invoice.type!=='RETURN').length};}),todayRows=data.invoices.filter(invoice=>dayKey(invoice.createdAt)===today),now=new Date(),expiryLimitDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()+(data.shop?.expiryWarningDays??30)),expiryLimit=dayKey(expiryLimitDate.getTime()),expiryToday=dayKey(now.getTime()),batches=data.stockBatches.filter(batch=>batch.quantity>0&&batch.expiryDate);
    const lowStock=data.products.reduce((count,product)=>count+(product.tracksStock===false?0:product.variants.filter(variant=>variant.stock<=Math.max(1,variant.lowStockThreshold)).length),0),expired=batches.filter(batch=>batch.expiryDate!<expiryToday).length,expiring=batches.filter(batch=>batch.expiryDate!>=expiryToday&&batch.expiryDate!<=expiryLimit).length;
    return {today,salesTodayPaise:todayRows.reduce((total,invoice)=>total+signedTotal(invoice),0n).toString(),billsToday:todayRows.filter(invoice=>invoice.type!=='RETURN').length,returnsToday:todayRows.filter(invoice=>invoice.type==='RETURN').length,receivablesPaise:data.customers.reduce((total,customer)=>{const balance=BigInt(customer.balancePaise);return total+(balance>0n?balance:0n);},0n).toString(),customers:data.customers.length,products:data.products.length,lowStock,expired,expiring,days,recentInvoices:data.invoices.sort((a,b)=>b.createdAt-a.createdAt).slice(0,8),activity:this.auth.can('VIEW_ACTIVITY_LOG')?data.auditLog.sort((a,b)=>b.createdAt-a.createdAt).slice(0,8):[]};
  }
}
