import {expect,it} from 'vitest';
import {allocateBatches,placeBatchReturn,type StockBatch} from './batches';
const batch=(id:string,expiryDate:string|null,quantity:number,receivedAt=1):StockBatch=>({id,variantId:'v',batchNumber:id,expiryDate,quantity,receivedAt,unitCostPaise:null});
it('allocates sellable stock earliest-expiry first and skips expired batches',()=>{
  const rows=[batch('later','2027-05-01',4),batch('expired','2025-01-01',9),batch('earlier','2026-12-01',2),batch('unknown',null,3)];
  expect(allocateBatches(rows,6,'2026-11-01')).toEqual([{batchId:'earlier',quantity:2},{batchId:'later',quantity:4}]);
  expect(allocateBatches(rows,10,'2026-11-01')).toBeNull();
});
it('places returns back into last-used batches and leaves legacy units unplaced',()=>{
  expect(placeBatchReturn([{batchId:'first',quantity:2},{batchId:'last',quantity:3}],new Map([['last',1]]),4)).toEqual({takes:[{batchId:'last',quantity:2},{batchId:'first',quantity:2}],unplaced:0});
  expect(placeBatchReturn([],new Map(),2)).toEqual({takes:[],unplaced:2});
});
