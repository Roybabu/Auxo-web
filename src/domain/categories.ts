import {PRODUCT_CATEGORIES,type ProductCategory} from './catalog';
export type ShopCategory={id:string;name:string|null;profile:ProductCategory;enabled:boolean;sortOrder:number;builtIn:boolean};
export const STARTS_OFF=new Set<ProductCategory>(['GENERAL','ELECTRONICS','PHARMACY','COSMETICS','LOOSE','JEWELLERY','RESTAURANT']);
export const defaultCategoryName=(profile:ProductCategory)=>PRODUCT_CATEGORIES[profile].label;
export function checkCategoryName(raw:string,others:readonly string[]){const name=raw.trim().replace(/\s+/g,' ');if(!name)return {ok:false as const,message:'Category name is required.'};if(name.length>40)return {ok:false as const,message:'Category name must be 40 characters or fewer.'};if(others.some(item=>item.toLocaleLowerCase()===name.toLocaleLowerCase()))return {ok:false as const,message:'That category name is already used.'};return {ok:true as const,name};}
