import { parseMoney } from './money';

// Category behavior mirrors ProductCategory.kt on Android temp.
export const PRODUCT_CATEGORIES = {
  GARMENT: {label:'Garment', sizeColour:true, expiry:false, material:true, diet:false, netUnits:[], unit:'UNIT'},
  FOOTWEAR: {label:'Footwear', sizeColour:true, expiry:false, material:true, diet:false, netUnits:[], unit:'UNIT'},
  ACCESSORIES: {label:'Accessories', sizeColour:true, expiry:false, material:true, diet:false, netUnits:[], unit:'UNIT'},
  PACKAGED_FOOD: {label:'Packaged food', sizeColour:false, expiry:true, material:false, diet:true, netUnits:['GRAM','KILOGRAM','PIECE'], unit:'UNIT'},
  BEVERAGE: {label:'Beverage', sizeColour:false, expiry:true, material:false, diet:false, netUnits:['MILLILITRE','LITRE'], unit:'UNIT'},
  GENERAL: {label:'General', sizeColour:false, expiry:false, material:false, diet:false, netUnits:[], unit:'UNIT'},
  ELECTRONICS: {label:'Electronics', sizeColour:true, expiry:false, material:false, diet:false, netUnits:[], unit:'UNIT'},
  PHARMACY: {label:'Pharmacy', sizeColour:false, expiry:true, material:false, diet:false, netUnits:['PIECE','MILLILITRE','GRAM'], unit:'UNIT'},
  COSMETICS: {label:'Cosmetics', sizeColour:false, expiry:true, material:false, diet:false, netUnits:['MILLILITRE','GRAM','PIECE'], unit:'UNIT'},
  LOOSE: {label:'Loose goods', sizeColour:false, expiry:false, material:false, diet:false, netUnits:[], unit:'GRAM'},
  JEWELLERY: {label:'Jewellery', sizeColour:false, expiry:false, material:false, diet:false, netUnits:['GRAM'], unit:'UNIT'},
  RESTAURANT: {label:'Restaurant', sizeColour:false, expiry:false, material:false, diet:true, netUnits:[], unit:'UNIT'},
} as const;
export type ProductCategory = keyof typeof PRODUCT_CATEGORIES;
export type StockUnit = 'UNIT'|'GRAM'|'MILLILITRE';
export type QuantityUnit='GRAM'|'KILOGRAM'|'MILLILITRE'|'LITRE'|'PIECE';
export type DietType='VEG'|'NON_VEG';
export interface NetQuantity {amountMilli:number;unit:QuantityUnit}
export interface VariantInput {id?:string;size:string; colour:string; sku:string; barcode:string; price:string; mrp:string; cost:string; opening:string; lowStock:string;batchNumber?:string;expiryDate?:string;netQuantity?:string;netUnit?:QuantityUnit|''}
export interface ProductInput {name:string; category:ProductCategory; categoryId?:string; brand:string;description?:string;material?:string;dietType?:DietType|null; hsnCode?:string; gstRateBasisPoints:number|null; apparelGst:boolean;available?:boolean;tracksStock?:boolean; variants:VariantInput[]}
export interface ProductVariant extends Omit<VariantInput,'batchNumber'|'expiryDate'|'netQuantity'|'netUnit'> {id:string; pricePaise:string; mrpPaise:string|null; costPaise:string|null; stock:number; lowStockThreshold:number;batchNumber?:string|null;expiryDate?:string|null;netQuantity?:NetQuantity|null}
export interface Product {id:string; name:string; category:ProductCategory; categoryId?:string; brand:string|null;description?:string|null;material?:string|null;dietType?:DietType|null; hsnCode?:string|null; gstRateBasisPoints:number|null; apparelGst:boolean;available?:boolean;stockUnit:StockUnit;tracksStock?:boolean; createdAt:number; updatedAt:number; variants:ProductVariant[]}
export function parseGstRate(text:string):number|null {const value=text.trim();if(!/^\d{1,3}(\.\d{1,2})?$/.test(value))return null;const [whole,fraction='']=value.split('.');const rate=Number(whole)*100+Number(fraction.padEnd(2,'0'));return rate<=10_000?rate:null;}
export function validateHsn(text:string):string|null {const value=text.trim();if(value&&!/^(\d{4}|\d{6}|\d{8})$/.test(value))throw new Error('HSN code must be 4, 6 or 8 digits.');return value||null;}
const count = (s:string,max=1_000_000) => /^\d{1,7}$/.test(s.trim()) && Number(s)<=max;
const parseStock = (s:string, loose:boolean) => {
  const value=s.trim();
  if(loose){if(!/^\d{1,6}(\.\d{1,3})?$/.test(value))return null;const [whole,fraction='']=value.split('.');return Number(whole)*1000+Number(fraction.padEnd(3,'0'));}
  return count(value)?Number(value):null;
};
const checkDigitValid=(s:string)=>{
  const digits=[...s].map(Number); let sum=0,weight=3;
  for(let i=digits.length-2;i>=0;i--){sum+=digits[i]!*weight;weight=weight===3?1:3;}
  return (10-sum%10)%10===digits.at(-1);
};
export function validateProduct(input:ProductInput, existing:readonly Product[]):Product {
  const name=input.name.trim(); if(name.length<2||name.length>80)throw new Error('Product name must be 2–80 characters.');
  if(input.brand.trim().length>60)throw new Error('Brand must be 60 characters or fewer.');
  if((input.description??'').trim().length>500)throw new Error('Description must be 500 characters or fewer.');
  if((input.material??'').trim().length>60)throw new Error('Material must be 60 characters or fewer.');
  if(input.variants.length<1)throw new Error('Add at least one sellable variant.');
  const config=PRODUCT_CATEGORIES[input.category],tracksStock=input.category==='RESTAURANT'?input.tracksStock!==false:true,available=input.category==='RESTAURANT'?input.available!==false:true; const ids=new Set<string>(); const skus=new Set<string>(); const combos=new Set<string>();
  const variants=input.variants.map(row=>{
    const price=parseMoney(row.price); if(price===null||price===0n)throw new Error('Enter a valid selling price.');
    const mrp=row.mrp.trim()?parseMoney(row.mrp):null; if(row.mrp.trim()&&mrp===null)throw new Error('Enter a valid MRP.');
    if(mrp!==null&&mrp<price)throw new Error('MRP cannot be lower than selling price.');
    const cost=row.cost.trim()?parseMoney(row.cost):null; if(row.cost.trim()&&cost===null)throw new Error('Enter a valid cost price.');
    if(config.sizeColour&&(!row.size.trim()||row.size.trim().length>12||!row.colour.trim()||row.colour.trim().length>30))throw new Error('Each variant needs a size (12 characters max) and colour (30 characters max).');
    const barcode=row.barcode.trim();
    if(barcode){
      if(barcode.length>32||! /^[A-Za-z0-9\-._/]+$/.test(barcode))throw new Error('Barcode may contain letters, digits, hyphen, dot, underscore or slash; maximum 32 characters.');
      if(/^\d+$/.test(barcode)&&[8,12,13].includes(barcode.length)&&!checkDigitValid(barcode))throw new Error('EAN/UPC barcode has an invalid check digit.');
      if(existing.some(p=>p.variants.some(v=>v.barcode===barcode))||ids.has(barcode))throw new Error('Barcode is already in use.'); ids.add(barcode);
    }
    const sku=row.sku.trim(); if(sku&&(sku.length>32||!/^[A-Za-z0-9_-]+$/.test(sku)))throw new Error('SKU may contain letters, digits, hyphen and underscore; maximum 32 characters.');
    if(sku){const normalized=sku.toLowerCase();if(skus.has(normalized)||existing.some(p=>p.variants.some(v=>v.sku.toLowerCase()===normalized)))throw new Error('SKU is already in use.');skus.add(normalized);}
    const combo=`${row.size.trim().toLowerCase()}|${row.colour.trim().toLowerCase()}`;
    if(config.sizeColour&&(combos.has(combo)))throw new Error('Size and colour combinations must be unique.'); combos.add(combo);
    let netQuantity:NetQuantity|null=null;
    const allowedUnits=config.netUnits as readonly QuantityUnit[];
    if(allowedUnits.length){const raw=(row.netQuantity??'').trim(),unit=row.netUnit;if(!unit||!allowedUnits.includes(unit))throw new Error('Choose a valid pack-size unit for this category.');if(!/^\d{1,7}(\.\d{1,3})?$/.test(raw))throw new Error('Enter a valid pack size with up to three decimal places.');const [whole,fraction='']=raw.split('.');const amountMilli=Number(whole)*1000+Number(fraction.padEnd(3,'0'));if(!Number.isSafeInteger(amountMilli)||amountMilli<=0)throw new Error('Pack size must be greater than zero.');netQuantity={amountMilli,unit};const identity=`${amountMilli}|${unit}`;if(combos.has(identity))throw new Error('Pack-size variants must be unique.');combos.add(identity);}
    const opening=input.category==='RESTAURANT'&&!tracksStock?0:parseStock(row.opening,input.category==='LOOSE');
    if(tracksStock&&(opening===null||!count(row.lowStock)))throw new Error(input.category==='LOOSE'?'Enter valid opening stock (up to three decimals) and a whole low-stock level.':'Stock and low-stock levels must be whole numbers from 0 to 1,000,000.');
    const batchNumber=config.expiry?(row.batchNumber?.trim()||null):null;if(batchNumber&&batchNumber.length>32)throw new Error('Batch number must be 32 characters or fewer.');const expiryDate=config.expiry?(row.expiryDate||null):null;if(expiryDate&&!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))throw new Error('Enter a valid batch expiry date.');
    return {id:row.id??crypto.randomUUID(),size:config.sizeColour?row.size.trim():'',colour:config.sizeColour?row.colour.trim():'',netQuantity,sku,barcode,price:row.price.trim(),mrp:row.mrp.trim(),cost:row.cost.trim(),opening:row.opening.trim(),lowStock:row.lowStock.trim(),batchNumber,expiryDate,pricePaise:price.toString(),mrpPaise:mrp?.toString()??null,costPaise:cost?.toString()??null,stock:opening??0,lowStockThreshold:tracksStock?Number(row.lowStock):0};
  });
  if(input.gstRateBasisPoints!==null&&(!Number.isInteger(input.gstRateBasisPoints)||input.gstRateBasisPoints<0||input.gstRateBasisPoints>10_000))throw new Error('GST rate must be between 0% and 100%.');
  if(input.apparelGst&&!['GARMENT','FOOTWEAR'].includes(input.category))throw new Error('The apparel GST slab applies only to garments and footwear.');
  const now=Date.now(); return {id:crypto.randomUUID(),name,category:input.category,brand:config.label==='Restaurant'?null:input.brand.trim()||null,description:(input.description??'').trim()||null,material:['GARMENT','FOOTWEAR','ACCESSORIES'].includes(input.category)?(input.material??'').trim()||null:null,dietType:['PACKAGED_FOOD','RESTAURANT'].includes(input.category)?input.dietType??null:null,hsnCode:validateHsn(input.hsnCode??''),gstRateBasisPoints:input.gstRateBasisPoints,apparelGst:input.apparelGst,available,stockUnit:input.category==='LOOSE'?'GRAM':'UNIT',tracksStock,createdAt:now,updatedAt:now,variants};
}
export function formatNetQuantity(quantity:NetQuantity|undefined|null){if(!quantity)return '';const unit:Record<QuantityUnit,string>={GRAM:'g',KILOGRAM:'kg',MILLILITRE:'ml',LITRE:'L',PIECE:'pcs'};return `${(quantity.amountMilli/1000).toString()} ${unit[quantity.unit]}`;}
export function defaultPackUnit(category:ProductCategory):QuantityUnit|'' {return (PRODUCT_CATEGORIES[category].netUnits as readonly QuantityUnit[])[0]??'';}
export function defaultProductTax(category:ProductCategory):Pick<ProductInput,'gstRateBasisPoints'|'apparelGst'> {if(category==='GARMENT'||category==='FOOTWEAR')return {gstRateBasisPoints:null,apparelGst:true};if(category==='RESTAURANT')return {gstRateBasisPoints:500,apparelGst:false};return {gstRateBasisPoints:null,apparelGst:false};}
export function variantAttributesLabel(variant:Pick<ProductVariant,'size'|'colour'|'netQuantity'>,separator=' · '){return [variant.size,variant.colour,formatNetQuantity(variant.netQuantity)].filter(Boolean).join(separator);}
export type MovementReason='INITIAL'|'RECEIVED'|'RETURNED'|'SOLD'|'DAMAGED'|'EXPIRED'|'SPOILED'|'CORRECTION';
export interface StockMovement {id:string;variantId:string;quantityChange:number;reason:MovementReason;note:string|null;createdAt:number;batchId?:string|null;invoiceId?:string|null;sourceInvoiceId?:string|null}
export function manualStockChange(reason:MovementReason,text:string,current:number,unit:StockUnit):number {
  const s=text.trim(); let quantity:number;
  if(unit==='UNIT') {if(!/^\d{1,7}$/.test(s))throw new Error('Enter a whole stock quantity.');quantity=Number(s);}
  else {if(!/^\d{1,6}(\.\d{1,3})?$/.test(s))throw new Error('Enter a quantity with up to three decimal places.');quantity=Math.round(Number(s)*1000);}
  if(quantity>1_000_000)throw new Error('Quantity exceeds the 1,000,000-unit limit.');
  const change=reason==='CORRECTION'?quantity-current:['RECEIVED','RETURNED','INITIAL'].includes(reason)?quantity:-quantity;
  if(reason!=='CORRECTION'&&quantity===0)throw new Error('Quantity must be greater than zero.');
  if(change===0)throw new Error('Stock is already at that quantity.');
  if(current+change<0)throw new Error('This change would make stock negative.'); return change;
}
