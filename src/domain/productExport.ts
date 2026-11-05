import {PRODUCT_CATEGORIES,stockQuantityInputText,type Product,type QuantityUnit} from './catalog';
import type {ShopCategory} from './categories';
import {formatMoney} from './money';
import {IMPORT_COLUMNS} from './productImport';

const UNIT:Record<QuantityUnit,string>={GRAM:'g',KILOGRAM:'kg',MILLILITRE:'ml',LITRE:'L',PIECE:'pcs'};
const risky=/^[=+@]|^-(?![\d.])/;
const cell=(value:string)=>{const safe=risky.test(value)?`'${value}`:value;return /[",\n\r']/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;};
const money=(paise:string|null)=>paise===null?'':formatMoney(BigInt(paise));

/**
 * Products as a CSV with the same columns the importer reads, one row per variant,
 * so the file can be opened in a spreadsheet or imported on another device.
 * Current stock goes in the opening_stock column.
 */
export function productsCsv(products:readonly Product[],categories:readonly ShopCategory[],onlyVariantIds?:ReadonlySet<string>):string{
  const names=new Map(categories.map(category=>[category.id,category.name??PRODUCT_CATEGORIES[category.profile].label]));
  const rows:string[][]=[];
  for(const product of products){
    const category=(product.categoryId&&names.get(product.categoryId))||PRODUCT_CATEGORIES[product.category].label;
    const gst=product.apparelGst?'apparel':product.gstRateBasisPoints===null?'':`${product.gstRateBasisPoints/100}%`;
    for(const variant of product.variants){
      if(onlyVariantIds&&!onlyVariantIds.has(variant.id))continue;
      const net=variant.netQuantity;
      rows.push([product.name,category,product.brand??'',product.description??'',product.material??'',product.dietType==='VEG'?'veg':product.dietType==='NON_VEG'?'non-veg':'',gst,product.hsnCode??'',variant.size??'',variant.colour??'',net?String(net.amountMilli/1000):'',net?UNIT[net.unit]:'',money(variant.pricePaise),money(variant.mrpPaise),money(variant.costPaise),product.tracksStock===false?'0':stockQuantityInputText(variant.stock,product.stockUnit),String(variant.lowStockThreshold),variant.barcode??'',variant.sku??'',variant.batchNumber??'',variant.expiryDate??'']);
    }
  }
  return [[...IMPORT_COLUMNS],...rows].map(row=>row.map(value=>cell(value)).join(',')).join('\r\n')+'\r\n';
}
