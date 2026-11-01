import { expect, it } from 'vitest';
import { localDateKey, quotationValidUntil, isQuotationExpired, repriceQuotationCart, type QuotationCart } from './quotations';
import type { Product } from './catalog';

const cart: QuotationCart = { lines: [{ productId:'p',variantId:'v',name:'Old name',variantLabel:'M',barcode:'old',quantity:2,unitPricePaise:'1000',mrpPaise:null,stockUnit:'UNIT',availableStock:8,gstRateBasisPoints:500,apparelGst:false,lineDiscount:{kind:'AMOUNT',value:'1.00',reason:'Offer'} }],discount:{kind:'PERCENT',value:'5',reason:'Seasonal'},interState:false,customerId:'c',buyerName:'Buyer',buyerPhone:'123',buyerGstin:'' };
const product: Product = {id:'p',name:'New name',category:'GENERAL',categoryId:'GENERAL',brand:null,hsnCode:'1234',gstRateBasisPoints:1200,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:1,updatedAt:1,variants:[{id:'v',size:'M',colour:'',sku:'',barcode:'new',price:'15.00',mrp:'',cost:'',opening:'4',lowStock:'0',pricePaise:'1500',mrpPaise:null,costPaise:null,stock:1,lowStockThreshold:0}]};

it('uses local calendar validity dates and accepts the Android validity choices',()=>{
  const start=new Date(2026,0,31,23,30);expect(quotationValidUntil(start,7)).toBe('2026-02-07');expect(quotationValidUntil(start,15)).toBe('2026-02-15');expect(quotationValidUntil(start,30)).toBe('2026-03-02');expect(()=>quotationValidUntil(start,10)).toThrow(/7, 15, or 30/);expect(localDateKey(start)).toBe('2026-01-31');expect(isQuotationExpired({validUntil:'2026-01-30'},'2026-01-31')).toBe(true);expect(isQuotationExpired({validUntil:'2026-01-31'},'2026-01-31')).toBe(false);
});

it('reprices saved product details while retaining quantities and discounts',()=>{
  const result=repriceQuotationCart(cart,[product]);expect(result.lines[0]).toMatchObject({name:'New name',barcode:'new',hsnCode:'1234',quantity:2,unitPricePaise:'1500',gstRateBasisPoints:1200,lineDiscount:cart.lines[0]!.lineDiscount,availableStock:1});expect(result.discount).toEqual(cart.discount);expect(result.customerId).toBe('c');
});

it('keeps a deleted product line but marks it unavailable for checkout',()=>{
  expect(repriceQuotationCart(cart,[]).lines[0]).toMatchObject({name:'Old name',quantity:2,availableStock:0,unavailable:true});
});
