import { describe, expect, it } from 'vitest';
import { calculateBill, validateAccountPayment, validatePayments, type CartLine, type TaxSettings } from './billing';

const settings:TaxSettings={gstRegistered:true,pricesIncludeTax:true,roundOff:true,stateCode:'19',invoicePrefix:'INV',storeName:'Shop',address:'',gstin:'19ABCDE1234F1Z5'};
const line=(price:string,rate:number|null=1800,extra:Partial<CartLine>={}):CartLine=>({productId:'p1',variantId:'v1',name:'Item',variantLabel:'',barcode:'',quantity:1,unitPricePaise:price,mrpPaise:null,stockUnit:'UNIT',availableStock:10,gstRateBasisPoints:rate,apparelGst:false,lineDiscount:null,...extra});
describe('Android POS tax and discount calculations',()=>{
  it('extracts included GST into taxable value and CGST/SGST',()=>{
    const result=calculateBill([line('11800')],settings,{kind:'AMOUNT',value:'',reason:''},false);
    expect(result.taxable).toBe(10000n);expect(result.cgst).toBe(900n);expect(result.sgst).toBe(900n);expect(result.grandTotal).toBe(11800n);
  });
  it('applies percent discount before GST and uses IGST for interstate bills',()=>{
    const result=calculateBill([line('11800')],settings,{kind:'PERCENT',value:'10',reason:'Offer'},true);
    expect(result.discount).toBe(1180n);expect(result.taxable).toBe(9000n);expect(result.igst).toBe(1620n);expect(result.cgst+result.sgst).toBe(0n);
  });
  it('applies line discounts before allocating the bill discount',()=>{
    const lines=[line('11800',1800,{variantId:'v1',lineDiscount:{kind:'AMOUNT',value:'10',reason:'Damaged box'}}),line('11800',1800,{variantId:'v2'})];
    const result=calculateBill(lines,settings,{kind:'PERCENT',value:'10',reason:'Loyalty offer'},false);
    expect(result.lineDiscount).toBe(1000n);expect(result.billDiscount).toBe(2260n);expect(result.discount).toBe(3260n);
    expect(result.lines[0]?.discountReason).toBe('Damaged box');expect(result.lines.reduce((n,x)=>n+BigInt(x.billDiscountSharePaise),0n)).toBe(2260n);
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
  it('requires a saved customer and respects account limit for credit payments',()=>{
    expect(()=>validatePayments([{method:'CREDIT',amount:'25',reference:'',tendered:''}],2500n)).toThrow(/saved customer/);
    const customer={id:'c1',name:'Customer',phone:null,creditLimitPaise:'3000',balancePaise:'1000',onHold:false,createdAt:1};
    expect(()=>validatePayments([{method:'CREDIT',amount:'21',reference:'',tendered:''}],2100n,customer)).toThrow(/credit limit/);
    expect(validatePayments([{method:'CREDIT',amount:'20',reference:'',tendered:''}],2000n,customer)[0]?.method).toBe('CREDIT');
  });
  it('checks account repayments against due balance and method references',()=>{
    expect(validateAccountPayment({amount:'25',method:'CASH',reference:'',note:'Paid at counter'},5000n)).toEqual({amountPaise:'2500',method:'CASH',reference:null,note:'Paid at counter'});
    expect(()=>validateAccountPayment({amount:'51',method:'CASH',reference:'',note:''},5000n)).toThrow(/more than/);
    expect(()=>validateAccountPayment({amount:'10',method:'UPI',reference:'bad',note:''},5000n)).toThrow(/UPI reference/);
    expect(()=>validateAccountPayment({amount:'',method:'CASH',reference:'',note:''},5000n)).toThrow(/amount/);
    expect(()=>validateAccountPayment({amount:'1',method:'CASH',reference:'',note:''},0n)).toThrow(/no outstanding balance/);
  });
});
