import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, parseMoney } from './money';
import { validateShop } from './shop';
describe('Android money conventions',()=>{
  it('parses paise exactly without binary floating point',()=>{
    expect(parseMoney(' 12.5 ')).toBe(1250n);
    expect(addMoney(parseMoney('0.1')!,parseMoney('0.2')!)).toBe(30n);
    expect(formatMoney(-1n)).toBe('-0.01');
  });
  it('rejects malformed and over-precise amounts',()=>{
    for(const value of ['','-1','1.001','1e2','NaN','.5','12345678901']) expect(parseMoney(value)).toBeNull();
  });
  it('detects signed 64-bit arithmetic overflow',()=>{
    expect(()=>addMoney((1n<<63n)-1n,1n)).toThrow(RangeError);
  });
});
describe('Android store identity limits',()=>{
  it('trims input and accepts boundary lengths',()=>{
    expect(validateShop({storeName:' Store ',address:' Road '})).toEqual({storeName:'Store',address:'Road'});
    expect(()=>validateShop({storeName:'x'.repeat(70),address:'x'.repeat(200)})).not.toThrow();
  });
  it('rejects blank or oversized fields',()=>{
    expect(()=>validateShop({storeName:' ',address:''})).toThrow();
    expect(()=>validateShop({storeName:'x'.repeat(71),address:''})).toThrow();
    expect(()=>validateShop({storeName:'Store',address:'x'.repeat(201)})).toThrow();
  });
});
