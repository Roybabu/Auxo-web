import {describe,expect,it} from 'vitest';
import {validateProduct} from './catalog';

const row={size:'',colour:'',sku:'',barcode:'',price:'10.00',mrp:'',cost:'',opening:'0',lowStock:'0'};
const input=(overrides:Partial<Parameters<typeof validateProduct>[0]>={})=>({name:'Menu item',category:'RESTAURANT' as const,brand:'',gstRateBasisPoints:500,apparelGst:false,variants:[row],...overrides});

describe('restaurant stock controls',()=>{
 it('allows available menu items to be sold without a stock count',()=>{const product=validateProduct(input({tracksStock:false,available:true,variants:[{...row,opening:'not a quantity',lowStock:'not a threshold'}]}),[]);expect(product).toMatchObject({available:true,tracksStock:false,variants:[{stock:0,lowStockThreshold:0}]});});
 it('persists an unavailable state and forces stock tracking for other categories',()=>{const unavailable=validateProduct(input({available:false,tracksStock:false}),[]);expect(unavailable.available).toBe(false);expect(unavailable.tracksStock).toBe(false);const garment=validateProduct({...input({category:'GARMENT',tracksStock:false}),variants:[{...row,size:'M',colour:'Blue'}]},[]);expect(garment.available).toBe(true);expect(garment.tracksStock).toBe(true);});
 it('trims and limits restaurant menu sections and ignores them for other profiles',()=>{expect(validateProduct(input({subcategory:'  Hot   drinks '}),[]).subcategory).toBe('Hot drinks');expect(()=>validateProduct(input({subcategory:'x'.repeat(41)}),[])).toThrow(/Menu section/);const garment=validateProduct({...input({category:'GARMENT',subcategory:'Ignored'}),variants:[{...row,size:'M',colour:'Blue'}]},[]);expect(garment.subcategory).toBeNull();});
});
