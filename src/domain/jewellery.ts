import type {Product,ProductVariant} from './catalog';
import type {ShopIdentity} from './shop';

const halfUp=(value:bigint,divisor:bigint)=>(value+divisor/2n)/divisor;
const roundRupee=(paise:bigint)=>halfUp(paise,100n)*100n;

/** Return today's jewellery price using the same weight × metal rate + making charge + GST rule as Android. */
export function jewelleryPricePaise(product:Product,variant:ProductVariant,shop:ShopIdentity):string|null{
  if(product.category!=='JEWELLERY'||!product.metal)return null;
  const rate=shop.metalRatesPaise?.[product.metal];
  const weight=variant.netQuantity?.unit==='GRAM'?variant.netQuantity.amountMilli:null;
  if(!rate||!weight||weight<=0)return null;
  const metal=halfUp(BigInt(weight)*BigInt(rate),1000n);
  const making=halfUp(metal*BigInt(product.makingChargeBasisPoints??0),10_000n);
  let total=metal+making;
  if((shop.gstRegistered??true)&&(shop.pricesIncludeTax??true)){const tax=halfUp(total*BigInt(product.gstRateBasisPoints??300),10_000n);total+=tax;}
  return roundRupee(total).toString();
}

export function withJewelleryPrices(products:readonly Product[],shop:ShopIdentity|null|undefined):Product[]{
  if(!shop)return products.map(p=>({...p,variants:p.variants.map(v=>({...v}))}));
  return products.map(product=>({...product,variants:product.variants.map(variant=>{const price=jewelleryPricePaise(product,variant,shop);return price?{...variant,pricePaise:price,mrpPaise:null}:variant;})}));
}
