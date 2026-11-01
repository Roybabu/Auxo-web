import {describe,expect,it} from 'vitest';
import {parseProductCsv,previewProductCsv} from './productImport';
import {PRODUCT_CATEGORIES,type Product} from './catalog';
import type {ShopCategory} from './categories';

const categories:ShopCategory[]=[{id:'GARMENT',name:null,profile:'GARMENT',enabled:true,sortOrder:0,builtIn:true},{id:'GENERAL',name:null,profile:'GENERAL',enabled:true,sortOrder:1,builtIn:true}];
const csv=(body:string)=>parseProductCsv(`name,category,size,colour,selling_price,opening_stock,barcode\r\n${body}`);
describe('product CSV import',()=>{
 it('parses quoted separators, escaped quotes, embedded line breaks and Windows separators',()=>{const parsed=parseProductCsv('name;category;description\r\n"Shirt; blue";Clothing;"Line one\r\nLine ""two"""\r\n');expect(parsed.rows[0]?.cells).toEqual(['Shirt; blue','Clothing','Line one\r\nLine "two"']);});
 it('rejects malformed, empty and oversized row sets',()=>{expect(()=>parseProductCsv('name,category\n"unclosed,Clothing')).toThrow(/unclosed/);expect(()=>parseProductCsv('name,category\n')).toThrow(/at least one/);const many='name,category\n'+Array.from({length:1001},(_,i)=>`Item ${i},General`).join('\n');expect(()=>parseProductCsv(many)).toThrow(/1,000/);});
 it('groups apparel variants and validates them before import',()=>{const rows=csv('Cotton shirt,Clothing,M,Blue,499,10,\nCotton shirt,Clothing,L,Blue,499,8,');const preview=previewProductCsv(rows,[],categories);expect(preview).toHaveLength(1);expect(preview[0]?.input?.variants).toHaveLength(2);expect(preview[0]?.issue).toBeUndefined();});
 it('marks existing products and invalid variants in the preview',()=>{const rows=csv('Cotton shirt,Clothing,M,Blue,499,10,\nBroken shirt,Clothing,M,Blue,not-price,3,');const existing=[{id:'p',name:'Cotton shirt',category:'GARMENT',categoryId:'GARMENT',brand:null,hsnCode:null,gstRateBasisPoints:null,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:0,updatedAt:0,variants:[]} as Product];const preview=previewProductCsv(rows,existing,categories);expect(preview[0]?.exists).toBe(true);expect(preview[1]?.issue).toMatch(/price/i);});
 it('accepts strict day-first dates and rejects impossible expiry dates',()=>{const good=parseProductCsv('name,category,size,colour,selling_price,opening_stock,expiry_date\nShirt,Clothing,M,Blue,499,10,31/12/2027');const bad=parseProductCsv('name,category,size,colour,selling_price,opening_stock,expiry_date\nShirt,Clothing,M,Blue,499,10,31/02/2027');expect(previewProductCsv(good,[],categories)[0]?.issue).toBeUndefined();expect(previewProductCsv(bad,[],categories)[0]?.issue).toMatch(/Invalid expiry/);});
});
