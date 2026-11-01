import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {LocalDatabase} from './localDatabase';
import {AuthService} from '../application/authService';
import {StockCountService} from '../application/stockCountService';
import type {Product} from '../domain/catalog';

function fixture(){const db=new LocalDatabase(`stock-count-${crypto.randomUUID()}`),auth=new AuthService(db),service=new StockCountService(db,auth),now=Date.now(),product:Product={id:'p',name:'Tea',category:'GENERAL',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'v',size:'',colour:'',sku:'TEA',barcode:'',price:'10.00',mrp:'',cost:'',opening:'5',lowStock:'0',pricePaise:'1000',mrpPaise:null,costPaise:null,stock:5,lowStockThreshold:0}]};return {db,auth,service,product};}

it('preserves stock changes made after a line was counted and records count events',async()=>{const {db,auth,service,product}=fixture();await auth.setup('Owner','owner-count','Strong-Password-483','Strong-Password-483');await db.saveProduct(product,[]);const count=await service.start();await service.setLine(count.id,'v','7');await db.adjustStock('v',-1,'SOLD','Sale during count');const result=await service.post(count.id,'ROUTINE','');expect(result).toMatchObject({status:'POSTED',adjusted:1,matched:0});expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(6);expect((await db.listRecentAudit()).map(row=>row.action)).toEqual(expect.arrayContaining(['STOCK_COUNT_STARTED','STOCK_CHANGED','STOCK_COUNT_POSTED']));await db.close();});

it('keeps a count open when a decrease would make stock negative, then allows retry',async()=>{const {db,auth,service,product}=fixture();await auth.setup('Owner','owner-short','Strong-Password-483','Strong-Password-483');await db.saveProduct(product,[]);const count=await service.start();await service.setLine(count.id,'v','2');await db.adjustStock('v',-4,'SOLD','Sale during count');const partial=await service.post(count.id,'SPOT_CHECK','');expect(partial.status).toBe('PARTIAL');expect((await service.load()).count?.lines).toHaveLength(1);await db.adjustStock('v',3,'RECEIVED','');const done=await service.post(count.id,'SPOT_CHECK','');expect(done.status).toBe('POSTED');expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(1);await db.close();});

it('cancels without changing inventory and enforces the adjust-stock permission',async()=>{const {db,auth,service,product}=fixture();await auth.setup('Owner','owner-cancel','Strong-Password-483','Strong-Password-483');await db.saveProduct(product,[]);const count=await service.start();await service.setLine(count.id,'v','0');await service.cancel(count.id);expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(5);await db.close();});
