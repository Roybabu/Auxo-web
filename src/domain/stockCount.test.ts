import {expect,it} from 'vitest';
import {countDisplay,countEntryText,countSummary,parseCounted} from './stockCount';
import type {Product} from './catalog';

const product:Product={id:'p',name:'Rice',category:'LOOSE',brand:null,gstRateBasisPoints:null,apparelGst:false,stockUnit:'GRAM',tracksStock:true,createdAt:1,updatedAt:1,variants:[]};
it('parses loose-goods quantities into base grams and displays them in kg',()=>{expect(parseCounted('1.275',product)).toBe(1275);expect(countEntryText(1275,product)).toBe('1.275');expect(countDisplay(1275,product)).toBe('1.275 kg');expect(parseCounted('1.0001',product)).toBeNull();expect(parseCounted('-1',product)).toBeNull();});
it('accepts a zero count and summarizes differences',()=>{const unit={...product,stockUnit:'UNIT' as const};expect(parseCounted('0',unit)).toBe(0);expect(countSummary([{variantId:'a',expected:2,counted:0},{variantId:'b',expected:1,counted:1},{variantId:'c',expected:1,counted:3}])).toEqual({counted:3,withDifference:2,short:1,extra:1});});
it('shows selected volume stock in litres and millilitres',()=>{const volume={...product,stockUnit:'MILLILITRE' as const};expect(countDisplay(1250,volume)).toBe('1.25 L');expect(countDisplay(750,volume)).toBe('750 ml');expect(countEntryText(1250,volume)).toBe('1.25');});
