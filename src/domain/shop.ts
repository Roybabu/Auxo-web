// SPDX-License-Identifier: GPL-3.0-or-later
// Limits: AUXO Android temp domain/billing/SettingsValidator.kt.
export interface ShopIdentity { storeName: string; address: string; gstin?:string; stateCode?:string; gstRegistered?:boolean; pricesIncludeTax?:boolean; roundOff?:boolean; invoicePrefix?:string;employeeDiscountLimitBp?:number;tableCount?:number;onTimeBonusPoints?:number }
export const GST_STATE_CODES=[['01','Jammu and Kashmir'],['02','Himachal Pradesh'],['03','Punjab'],['04','Chandigarh'],['05','Uttarakhand'],['06','Haryana'],['07','Delhi'],['08','Rajasthan'],['09','Uttar Pradesh'],['10','Bihar'],['11','Sikkim'],['12','Arunachal Pradesh'],['13','Nagaland'],['14','Manipur'],['15','Mizoram'],['16','Tripura'],['17','Meghalaya'],['18','Assam'],['19','West Bengal'],['20','Jharkhand'],['21','Odisha'],['22','Chhattisgarh'],['23','Madhya Pradesh'],['24','Gujarat'],['25','Daman and Diu (legacy)'],['26','Dadra and Nagar Haveli and Daman and Diu'],['27','Maharashtra'],['28','Andhra Pradesh (legacy)'],['29','Karnataka'],['30','Goa'],['31','Lakshadweep'],['32','Kerala'],['33','Tamil Nadu'],['34','Puducherry'],['35','Andaman and Nicobar Islands'],['36','Telangana'],['37','Andhra Pradesh'],['38','Ladakh'],['97','Other Territory'],['99','Centre Jurisdiction (legacy)']] as const;
export function validateShop(input: ShopIdentity): ShopIdentity {
  const storeName = input.storeName.trim();
  const address = input.address.trim();
  if (!storeName) throw new Error('Store name is required.');
  if (storeName.length > 70) throw new Error('Store name must be 70 characters or fewer.');
  if (address.length > 200) throw new Error('Address must be 200 characters or fewer.');
  const gstRegistered=input.gstRegistered??true;const stateCode=(input.stateCode??'').trim();const gstin=(input.gstin??'').trim().toUpperCase();const invoicePrefix=(input.invoicePrefix??'INV').trim().toUpperCase();
  if(stateCode&&!GST_STATE_CODES.some(([code])=>code===stateCode))throw new Error('Choose a valid GST state code for the store.');
  if(gstin&&(!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)||gstin.slice(0,2)!==stateCode||!validGstinCheck(gstin)))throw new Error('Enter a valid 15-character GSTIN matching the store state code.');
  if(input.gstRegistered===true&&!stateCode)throw new Error('Enter the two-digit GST state code for the store.');
  if(input.gstRegistered===true&&!gstin)throw new Error('GSTIN is required when the store is GST registered.');
  if(!/^[A-Z0-9]{1,4}$/.test(invoicePrefix))throw new Error('Invoice prefix must be 1–4 letters or digits.');
  if(input.employeeDiscountLimitBp!==undefined&&![0,500,1000,1500,2000,2500,5000,10000].includes(input.employeeDiscountLimitBp))throw new Error('Choose a valid employee discount limit.');
  if(input.tableCount!==undefined&&(!Number.isInteger(input.tableCount)||input.tableCount<1||input.tableCount>99))throw new Error('Table count must be between 1 and 99.');
  if(input.onTimeBonusPoints!==undefined&&(!Number.isInteger(input.onTimeBonusPoints)||input.onTimeBonusPoints<0||input.onTimeBonusPoints>10000))throw new Error('On-time payment bonus must be between 0 and 10,000 points.');
  const result:ShopIdentity={storeName,address};
  if(['gstin','stateCode','gstRegistered','pricesIncludeTax','roundOff','invoicePrefix'].some(key=>key in input))Object.assign(result,{gstin,stateCode,gstRegistered,pricesIncludeTax:input.pricesIncludeTax??true,roundOff:input.roundOff??true,invoicePrefix});
  if('employeeDiscountLimitBp' in input)result.employeeDiscountLimitBp=input.employeeDiscountLimitBp;
  if('tableCount' in input)result.tableCount=input.tableCount;
  if('onTimeBonusPoints' in input)result.onTimeBonusPoints=input.onTimeBonusPoints;
  return result;
}
function validGstinCheck(value:string){const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';let factor=2,sum=0;for(const char of [...value.slice(0,14)].reverse()){const addend=factor*chars.indexOf(char);factor=factor===2?1:2;sum+=Math.floor(addend/36)+addend%36;}return chars[(36-sum%36)%36]===value[14];}
