import {expect,it} from 'vitest';
import {gstinStateCode,isValidGstin,normalizeGstin,validateGstin} from './gstin';
it('normalizes and validates Indian GSTINs including the state and mod-36 check character',()=>{
  expect(isValidGstin('19ABCDE1234F1ZX')).toBe(true);expect(normalizeGstin(' 19abcde1234f1zx ')).toBe('19ABCDE1234F1ZX');expect(gstinStateCode('19ABCDE1234F1ZX')).toBe('19');expect(validateGstin('')).toBeNull();
  expect(isValidGstin('99ABCDE1234F1ZX')).toBe(false);expect(isValidGstin('19ABCDE1234F1Z5')).toBe(false);expect(()=>validateGstin('19ABCDE1234F1Z5')).toThrow(/valid.*GSTIN/);
});
