export type StockBatch={id:string;variantId:string;batchNumber:string|null;expiryDate:string|null;quantity:number;receivedAt:number;unitCostPaise:string|null};
export type BatchTake={batchId:string;quantity:number};

/** Android's batch allocator uses earliest expiry first and skips expired stock at sale time. */
export function allocateBatches(batches:readonly StockBatch[],quantity:number,onDate:string):BatchTake[]|null{
  if(!Number.isSafeInteger(quantity)||quantity<=0)throw new Error('Quantity must be a positive whole number.');
  const ordered=batches.filter(b=>b.quantity>0&&(!b.expiryDate||b.expiryDate>=onDate)).slice().sort((a,b)=>{
    if(a.expiryDate===null&&b.expiryDate!==null)return 1;if(b.expiryDate===null&&a.expiryDate!==null)return -1;
    return (a.expiryDate??'').localeCompare(b.expiryDate??'')||a.receivedAt-b.receivedAt||a.id.localeCompare(b.id);
  });
  let left=quantity;const takes:BatchTake[]=[];for(const batch of ordered){if(!left)break;const take=Math.min(left,batch.quantity);takes.push({batchId:batch.id,quantity:take});left-=take;}return left?null:takes;
}

/** Restore returned units into batches the sale consumed, starting with the last batch used. */
export function placeBatchReturn(sold:readonly BatchTake[],alreadyReturned:ReadonlyMap<string,number>,quantity:number){
  let left=quantity;const takes:BatchTake[]=[];for(const batch of [...sold].reverse()){if(!left)break;const room=batch.quantity-(alreadyReturned.get(batch.batchId)??0);if(room<=0)continue;const put=Math.min(left,room);takes.push({batchId:batch.batchId,quantity:put});left-=put;}return {takes,unplaced:left};
}
