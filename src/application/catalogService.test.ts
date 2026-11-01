import {describe,expect,it} from 'vitest';
import {CatalogService,type CatalogStorage} from './catalogService';
import type {Product,ProductInput,StockMovement} from '../domain/catalog';
import type {ShopCategory} from '../domain/categories';

const now=1234;
const variant=(id:string,stock:number)=>({id,size:'',colour:'',sku:'TEA',barcode:'',price:'10.00',mrp:'',cost:'',opening:String(stock),lowStock:'1',pricePaise:'1000',mrpPaise:null,costPaise:null,stock,lowStockThreshold:1});
const original:Product={id:'product-1',name:'Tea',category:'GENERAL',categoryId:'GENERAL',brand:'Maker',description:'Original details',material:null,dietType:null,hsnCode:null,gstRateBasisPoints:500,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[variant('variant-1',7)]};
const categories:ShopCategory[]=[{id:'GENERAL',name:null,profile:'GENERAL',enabled:true,sortOrder:0,builtIn:true}];
function setup(){let saved:Product|undefined,movements:StockMovement[]=[];const storage={listProducts:async()=>[original],listCategories:async()=>categories,updateProduct:async(product:Product,initial:StockMovement[])=>{saved=product;movements=initial;}} as unknown as CatalogStorage;return {service:new CatalogService(storage),get saved(){return saved;},get movements(){return movements;}};}
const input=(variants:ProductInput['variants']):ProductInput=>({name:'Tea Updated',category:'GENERAL',categoryId:'GENERAL',brand:'New maker',description:'Updated details',material:'',dietType:null,hsnCode:'',gstRateBasisPoints:1800,apparelGst:false,variants});

describe('catalog product editing',()=>{
 it('updates editable fields while retaining product and variant identities and on-hand stock',async()=>{const ctx=setup(),draft=input([{...variant('variant-1',999),price:'12.50',opening:'999'}]);const result=await ctx.service.update(original.id,draft);expect(result).toMatchObject({id:original.id,createdAt:now,name:'Tea Updated',brand:'New maker',gstRateBasisPoints:1800});expect(result.variants[0]).toMatchObject({id:'variant-1',stock:7,pricePaise:'1250'});expect(ctx.saved?.variants[0]?.stock).toBe(7);expect(ctx.movements).toEqual([]);});
 it('records opening stock when a new variant is added during editing',async()=>{const ctx=setup(),draft=input([{...variant('variant-1',7)},{...variant('new-id',3),id:undefined,sku:'TEA2',opening:'3'}]);const result=await ctx.service.update(original.id,draft);expect(result.variants).toHaveLength(2);expect(result.variants[0]?.id).toBe('variant-1');expect(ctx.movements).toMatchObject([{variantId:result.variants[1]?.id,quantityChange:3,reason:'INITIAL'}]);});
 it('blocks removing a variant that still has stock and category changes on saved products',async()=>{const ctx=setup();await expect(ctx.service.update(original.id,input([]))).rejects.toThrow(/stock on hand/);await expect(ctx.service.update(original.id,{...input([{...variant('variant-1',7)}]),categoryId:'FOOTWEAR'})).rejects.toThrow(/cannot be moved/);});
});
