export type PinError='WRONG_LENGTH'|'NOT_DIGITS'|'TOO_SIMPLE';
export const PIN_MIN_LENGTH=4,PIN_MAX_LENGTH=6,PIN_MAX_TRIES=5;
/** A quick-unlock PIN is only a shortcut on a browser that is already signed in. */
export function validatePin(pin:string):PinError|null{
  if(pin.length<PIN_MIN_LENGTH||pin.length>PIN_MAX_LENGTH)return 'WRONG_LENGTH';
  if(/\D/.test(pin))return 'NOT_DIGITS';
  if([...pin].every(c=>c===pin[0]))return 'TOO_SIMPLE';
  const steps=[...pin].slice(1).map((c,i)=>Number(c)-Number(pin[i]));
  if(steps.every(s=>s===1)||steps.every(s=>s===-1))return 'TOO_SIMPLE';
  if(pin.length%2===0&&pin.slice(0,pin.length/2)===pin.slice(pin.length/2))return 'TOO_SIMPLE';
  if(pin.length===6&&pin.slice(0,3)===pin.slice(3))return 'TOO_SIMPLE';
  return null;
}
export function pinMessage(error:PinError){return error==='WRONG_LENGTH'?'Use 4 to 6 digits.':error==='NOT_DIGITS'?'Use digits only.':'That PIN is too easy to guess. Avoid repeats and runs such as 1234.';}
