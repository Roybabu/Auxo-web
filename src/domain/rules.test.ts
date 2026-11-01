import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, parseMoney } from './money';
import { validateShop } from './shop';
import { parseGstRate, validateHsn, validateProduct } from './catalog';
import { calculateBill, cartLineFromProduct } from './billing';
describe('Android money conventions',()=>{
  it('parses paise exactly without binary floating point',()=>{
    expect(parseMoney(' 12.5 ')).toBe(1250n);
    expect(addMoney(parseMoney('0.1')!,parseMoney('0.2')!)).toBe(30n);
    expect(formatMoney(-1n)).toBe('-0.01');
  });
  it('rejects malformed and over-precise amounts',()=>{
    for(const value of ['','-1','1.001','1e2','NaN','.5','12345678901']) expect(parseMoney(value)).toBeNull();
  });
  it('detects signed 64-bit arithmetic overflow',()=>{
    expect(()=>addMoney((1n<<63n)-1n,1n)).toThrow(RangeError);
  });
});
describe('Android custom GST and HSN rules',()=>{
  it('accepts two decimal GST percentages and validates HSN lengths',()=>{
    expect(parseGstRate(' 12.50 ')).toBe(1250);expect(parseGstRate('100')).toBe(10000);
    for(const invalid of ['100.01','5.123','-1','abc',''])expect(parseGstRate(invalid)).toBeNull();
    expect(validateHsn(' 123456 ')).toBe('123456');expect(validateHsn('')).toBeNull();
    for(const invalid of ['123','12345','1234567','1234A6'])expect(()=>validateHsn(invalid)).toThrow(/HSN/);
  });
  it('keeps the product HSN and custom rate on the invoice line',()=>{
    const product=validateProduct({name:'Notebook',category:'GENERAL',brand:'',hsnCode:'482010',gstRateBasisPoints:1250,apparelGst:false,variants:[{size:'',colour:'',sku:'NOTE',barcode:'',price:'100',mrp:'',cost:'',opening:'2',lowStock:'0'}]},[]);
    const totals=calculateBill([cartLineFromProduct(product,product.variants[0]!)],{gstRegistered:true,pricesIncludeTax:false,roundOff:false,stateCode:'19',invoicePrefix:'INV',storeName:'Shop',address:'',gstin:''},{kind:'AMOUNT',value:'',reason:''},false);
    expect(totals.lines[0]?.hsnCode).toBe('482010');expect(totals.lines[0]?.gstRateBasisPoints).toBe(1250);
    expect(totals.grandTotal).toBe(11250n);
  });
});
describe('Android store identity limits',()=>{
  it('trims input and accepts boundary lengths',()=>{
    expect(validateShop({storeName:' Store ',address:' Road '})).toEqual({storeName:'Store',address:'Road'});
    expect(()=>validateShop({storeName:'x'.repeat(70),address:'x'.repeat(200)})).not.toThrow();
  });
  it('rejects blank or oversized fields',()=>{
    expect(()=>validateShop({storeName:' ',address:''})).toThrow();
    expect(()=>validateShop({storeName:'x'.repeat(71),address:''})).toThrow();
    expect(()=>validateShop({storeName:'Store',address:'x'.repeat(201)})).toThrow();
  });
});
