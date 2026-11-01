import type {Product} from './catalog';

export type CountReason='ROUTINE'|'YEAR_END'|'SPOT_CHECK'|'OTHER';
export const COUNT_REASONS:readonly CountReason[]=['ROUTINE','YEAR_END','SPOT_CHECK','OTHER'];
export const countReasonLabel=(reason:CountReason)=>({ROUTINE:'Routine count',YEAR_END:'Year-end count',SPOT_CHECK:'Spot check',OTHER:'Other'})[reason];
export type StockCountLine={variantId:string;expected:number;counted:number};
export type StockCountStatus='OPEN'|'POSTED'|'CANCELLED';
export type StockCountRecord={id:string;startedAt:number;status:StockCountStatus;lines:StockCountLine[];finishedAt:number|null;reason:CountReason|null;note:string|null;adjustedCount:number;matchedCount:number};
export type StockCountApplyResult='ADJUSTED'|'MATCHED'|'SHORTAGE'|'MISSING'|'NOT_OPEN'|'LINE_MISSING';
export type StockCountPostResult={status:'POSTED'|'PARTIAL'|'NOT_OPEN';adjusted:number;matched:number;failedVariantIds:string[]};
export const COUNT_NOTE_MAX=80;
export function countLineNote(reason:CountReason,note:string){const extra=note.trim().slice(0,COUNT_NOTE_MAX);return extra?`Stock count · ${countReasonLabel(reason)} · ${extra}`:`Stock count · ${countReasonLabel(reason)}`;}
export function parseCounted(text:string,product:Product){const value=text.trim();if(product.stockUnit==='UNIT'){if(!/^\d{1,9}$/.test(value))return null;const n=Number(value);return Number.isSafeInteger(n)&&n<=1_000_000?n:null;}if(!/^\d{1,6}(\.\d{1,3})?$/.test(value))return null;const n=Number(value)*1000;return Number.isSafeInteger(n)&&n<=100_000_000?n:null;}
export function countEntryText(base:number,product:Product){return product.stockUnit==='UNIT'?String(base):(base/1000).toString();}
export function countDisplay(base:number,product:Product){return product.stockUnit==='UNIT'?`${base} units`:base>=1000?`${(base/1000).toFixed(base%1000?3:0)} kg`:`${base} g`;}
export function countSummary(lines:readonly StockCountLine[]){const differences=lines.filter(line=>line.counted!==line.expected);return {counted:lines.length,withDifference:differences.length,short:differences.filter(line=>line.counted<line.expected).length,extra:differences.filter(line=>line.counted>line.expected).length};}
