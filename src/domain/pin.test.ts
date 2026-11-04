import { expect, it } from 'vitest';
import { validatePin } from './pin';
it('accepts 4 to 6 digit PINs that are not easy to guess',()=>{
  for(const pin of ['4829','90317','507316'])expect(validatePin(pin)).toBeNull();
});
it('rejects the wrong length, non-digits and easy PINs',()=>{
  expect(validatePin('123')).toBe('WRONG_LENGTH');expect(validatePin('1234567')).toBe('WRONG_LENGTH');
  expect(validatePin('12a4')).toBe('NOT_DIGITS');
  for(const pin of ['1111','1234','8765','1212','123123','456789'])expect(validatePin(pin)).toBe('TOO_SIMPLE');
});
