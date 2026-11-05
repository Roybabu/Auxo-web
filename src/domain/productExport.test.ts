import {describe,expect,it} from 'vitest';
import {productsCsv} from './productExport';
import {parseProductCsv,previewProductCsv} from './productImport';
import {validateProduct} from './catalog';
import type {ShopCategory} from './categories';

const categories:ShopCategory[]=[{id:'GARMENT',name:'Clothing',profile:'GARMENT',enabled:true,sortOrder:0,builtIn:true},{id:'PACKAGED_FOOD',name:null,profile:'PACKAGED_FOOD',enabled:true,sortOrder:1,builtIn:true}];

describe('product CSV export',()=>{
  it('writes the importer columns and reads back the same products',()=>{
    const shirt=validateProduct({name:'Cotton shirt, "classic"',category:'GARMENT',categoryId:'GARMENT',brand:'Acme',gstRateBasisPoints:null,apparelGst:true,variants:[{size:'M',colour:'Blue',sku:'SH-M',barcode:'111',price:'499',mrp:'599',cost:'300',opening:'7',lowStock:'2'},{size:'L',colour:'Blue',sku:'SH-L',barcode:'112',price:'519',mrp:'',cost:'',opening:'0',lowStock:'1'}]},[]);
    const rice=validateProduct({name:'Rice',category:'PACKAGED_FOOD',categoryId:'PACKAGED_FOOD',brand:'',dietType:'VEG',gstRateBasisPoints:500,apparelGst:false,variants:[{size:'',colour:'',sku:'',barcode:'900',price:'350',mrp:'',cost:'',opening:'120',lowStock:'10',netQuantity:'5',netUnit:'KILOGRAM'}]},[shirt]);
    const csv=productsCsv([shirt,rice],categories);
    expect(csv.split('\r\n')[0]).toBe('name,category,brand,description,material,diet,gst_rate,hsn,size,colour,net_quantity,unit,selling_price,mrp,cost_price,opening_stock,low_stock,barcode,sku,batch,expiry_date');
    const preview=previewProductCsv(parseProductCsv(csv),[],categories);
    expect(preview.map(row=>row.issue)).toEqual([undefined,undefined]);
    const [a,b]=preview.map(row=>row.input!);
    expect(a!.name).toBe('Cotton shirt, "classic"');expect(a!.apparelGst).toBe(true);expect(a!.variants.map(v=>[v.size,v.price,v.opening,v.barcode])).toEqual([['M','499.00','7','111'],['L','519.00','0','112']]);
    expect(b!.gstRateBasisPoints).toBe(500);expect(b!.dietType).toBe('VEG');expect(b!.variants[0]).toMatchObject({opening:'120',lowStock:'10',netQuantity:'5',netUnit:'KILOGRAM'});
  });
  it('can export only chosen variants and guards spreadsheet formulas',()=>{
    const p=validateProduct({name:'=SUM(A1)',category:'GARMENT',categoryId:'GARMENT',brand:'',gstRateBasisPoints:null,apparelGst:true,variants:[{size:'S',colour:'Red',sku:'',barcode:'1',price:'10',mrp:'',cost:'',opening:'1',lowStock:'0'},{size:'M',colour:'Red',sku:'',barcode:'2',price:'10',mrp:'',cost:'',opening:'1',lowStock:'0'}]},[]);
    const csv=productsCsv([p],categories,new Set([p.variants[1]!.id]));
    expect(csv.trim().split('\r\n')).toHaveLength(2);
    expect(csv).toContain(`"'=SUM(A1)"`);
  });
});
