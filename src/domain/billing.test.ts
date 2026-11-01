import { describe, expect, it } from 'vitest';
import { calculateBill, validatePayments, type CartLine, type TaxSettings } from './billing';

const settings:TaxSettings={gstRegistered:true,pricesIncludeTax:true,roundOff:true,stateCode:'19',invoicePrefix:'INV',storeName:'Shop',address:'',gstin:'19ABCDE1234F1Z5'};
const line=(price:string,rate:number|null=1800,extra:Partial<CartLine>={}):CartLine=>({productId:'p1',variantId:'v1',name:'Item',variantLabel:'',barcode:'',quantity:1,unitPricePaise:price,mrpPaise:null,stockUnit:'UNIT',availableStock:10,gstRateBasisPoints:rate,apparelGst:false,...extra});
describe('Android POS tax and discount calculations',()=>{
  it('extracts included GST into taxable value and CGST/SGST',()=>{
    const result=calculateBill([line('11800')],settings,{kind:'AMOUNT',value:'',reason:''},false);
    expect(result.taxable).toBe(10000n);expect(result.cgst).toBe(900n);expect(result.sgst).toBe(900n);expect(result.grandTotal).toBe(11800n);
  });
  it('applies percent discount before GST and uses IGST for interstate bills',()=>{
    const result=calculateBill([line('11800')],settings,{kind:'PERCENT',value:'10',reason:'Offer'},true);
    expect(result.discount).toBe(1180n);expect(result.taxable).toBe(9000n);expect(result.igst).toBe(1620n);expect(result.cgst+result.sgst).toBe(0n);
  });
  it('selects the higher apparel slab above the per-piece threshold',()=>{
    const result=calculateBill([line('300000',null,{apparelGst:true})],settings,{kind:'AMOUNT',value:'',reason:''},false);
    expect(result.lines[0]?.gstRateBasisPoints).toBe(1800);
  });
  it('validates exact split payments and cash change',()=>{
    const records=validatePayments([{method:'CASH',amount:'20',reference:'',tendered:'25'},{method:'UPI',amount:'98',reference:'ABCD1234',tendered:''}],11800n);
    expect(records.map(x=>x.amountPaise)).toEqual(['2000','9800']);expect(records[0]?.changePaise).toBe('500');
    expect(()=>validatePayments([{method:'CASH',amount:'100',reference:'',tendered:''}],11800n)).toThrow(/equal the bill total/);
  });
});
