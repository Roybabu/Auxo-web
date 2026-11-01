import {GST_STATE_CODES} from './shop';

const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const shape=/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export function normalizeGstin(text:string){return text.trim().toUpperCase().replaceAll(' ','');}
export function isValidGstin(text:string){const value=normalizeGstin(text);if(!shape.test(value)||!GST_STATE_CODES.some(([code])=>code===value.slice(0,2)))return false;let factor=2,sum=0;for(const char of [...value.slice(0,14)].reverse()){const product=factor*chars.indexOf(char);factor=factor===2?1:2;sum+=Math.floor(product/36)+product%36;}return chars[(36-sum%36)%36]===value[14];}
export function validateGstin(text:string){const normalized=normalizeGstin(text);if(normalized&&!isValidGstin(normalized))throw new Error('Enter a valid 15-character GSTIN.');return normalized||null;}
export function gstinStateCode(text:string|null|undefined){return text&&isValidGstin(text)?normalizeGstin(text).slice(0,2):null;}
