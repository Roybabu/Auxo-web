import type {InvoiceRecord} from './billing';

const amount=(value:string|undefined)=>{const p=BigInt(value??'0');return `${p<0n?'-':''}${p<0n?-p/100n:p/100n}.${String((p<0n?-p:p)%100n).padStart(2,'0')}`;};
const columns=['Section','Invoice number','Date','Document type','Original invoice','Seller','Seller address','Seller GSTIN','Customer','Customer phone','Description','Variant','Barcode','HSN/SAC','Quantity','Unit','Unit price','Line discount','Bill discount share','Taxable value','GST rate','CGST','SGST','IGST','Amount','Payment method','Reference','Cash tendered','Change','Line discount reason','Document note'];
const escape=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value;
export function invoiceCsv(invoice:InvoiceRecord){
  const date=new Date(invoice.createdAt).toLocaleString(),type=invoice.type==='RETURN'?'Credit note':'Tax invoice',customer=invoice.customer?.name??'Walk-in customer',phone=invoice.customer?.phone??'';
  const base=[invoice.number,date,type,invoice.originalInvoiceNumber??'',invoice.seller.storeName,invoice.seller.address,invoice.seller.gstin,customer,phone];
  const row=(section:string,values:(string|number)[],notes:[string,string]=['',invoice.returnReason??invoice.billDiscountReason??''])=>[section,...base,...values,...notes].map(x=>escape(String(x))).join(',');
  const rows=[columns.join(',')];
  for(const line of invoice.lines)rows.push(row('ITEM',[line.name,line.variantLabel,line.barcode,line.hsnCode??'',line.stockUnit==='UNIT'?line.quantity:(line.quantity/1000).toString(),line.stockUnit,amount(line.unitPricePaise),amount(line.lineDiscountPaise),amount(line.billDiscountSharePaise),amount(line.taxablePaise),`${(line.gstRateBasisPoints/100).toFixed(2)}%`,amount(line.cgstPaise),amount(line.sgstPaise),amount(line.igstPaise),amount(line.totalPaise),'','','',''],[line.discountReason??'',invoice.returnReason??invoice.billDiscountReason??'']));
  const summary:[string,string][]=[['Subtotal',invoice.subtotalPaise],['Line discounts',invoice.lineDiscountPaise],['Bill discount',invoice.billDiscountPaise],['Taxable value',invoice.taxablePaise],['CGST',invoice.cgstPaise],['SGST',invoice.sgstPaise],['IGST',invoice.igstPaise],['Round off',invoice.roundOffPaise],['Grand total',invoice.grandTotalPaise]];
  for(const [label,value] of summary)rows.push(row('SUMMARY',[label,'','','','','','', '', '', '', '', '', '', '',amount(value),'','','','']));
  for(const payment of invoice.payments)rows.push(row(invoice.type==='RETURN'?'REFUND':'PAYMENT',['','','','','','','','','','','','','','','',payment.method,payment.reference??'',amount(payment.tenderedPaise??'0'),amount(payment.changePaise??'0')].map((v,i)=>i===14?amount(payment.amountPaise):v)));
  return rows.join('\r\n');
}
export function invoiceCsvFilename(invoice:InvoiceRecord){return `${invoice.number.replace(/[^A-Za-z0-9-]/g,'-')}.csv`;}
