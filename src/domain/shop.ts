// SPDX-License-Identifier: GPL-3.0-or-later
// Limits: AUXO Android temp domain/billing/SettingsValidator.kt.
export type ReceiptPaper='THERMAL_58'|'THERMAL_76'|'THERMAL_80'|'A5'|'A4';
export type ReceiptLanguage='en'|'hi'|'bn'|'as';
export type JewelleryMetal='GOLD_24K'|'GOLD_22K'|'GOLD_18K'|'SILVER'|'PLATINUM';
export interface ShopIdentity { storeName: string; address: string; storeLogoPhotoId?:string|null;gstin?:string; stateCode?:string; gstRegistered?:boolean; pricesIncludeTax?:boolean; roundOff?:boolean; invoicePrefix?:string;creditNotePrefix?:string;employeeDiscountLimitBp?:number;tableCount?:number;onTimeBonusPoints?:number;creditHoldDays?:number;metalRatesPaise?:Partial<Record<JewelleryMetal,string>>;phone?:string;fssai?:string;upiId?:string;upiPayeeName?:string;expiryWarningDays?:number;receiptPaper?:ReceiptPaper;receiptFooter?:string;receiptShowHsn?:boolean;receiptShowTaxBreakup?:boolean;receiptShowCustomer?:boolean;receiptShowSavings?:boolean;receiptShowBarcode?:boolean;receiptShowUpiQr?:boolean;receiptLanguage?:ReceiptLanguage }
export const GST_STATE_CODES=[['01','Jammu and Kashmir'],['02','Himachal Pradesh'],['03','Punjab'],['04','Chandigarh'],['05','Uttarakhand'],['06','Haryana'],['07','Delhi'],['08','Rajasthan'],['09','Uttar Pradesh'],['10','Bihar'],['11','Sikkim'],['12','Arunachal Pradesh'],['13','Nagaland'],['14','Manipur'],['15','Mizoram'],['16','Tripura'],['17','Meghalaya'],['18','Assam'],['19','West Bengal'],['20','Jharkhand'],['21','Odisha'],['22','Chhattisgarh'],['23','Madhya Pradesh'],['24','Gujarat'],['25','Daman and Diu (legacy)'],['26','Dadra and Nagar Haveli and Daman and Diu'],['27','Maharashtra'],['28','Andhra Pradesh (legacy)'],['29','Karnataka'],['30','Goa'],['31','Lakshadweep'],['32','Kerala'],['33','Tamil Nadu'],['34','Puducherry'],['35','Andaman and Nicobar Islands'],['36','Telangana'],['37','Andhra Pradesh'],['38','Ladakh'],['97','Other Territory'],['99','Centre Jurisdiction (legacy)']] as const;
export function validateShop(input: ShopIdentity): ShopIdentity {
  const storeName = input.storeName.trim();
  const address = input.address.trim();
  if (!storeName) throw new Error('Store name is required.');
  if (storeName.length > 70) throw new Error('Store name must be 70 characters or fewer.');
  if (address.length > 200) throw new Error('Address must be 200 characters or fewer.');
  const gstRegistered=input.gstRegistered??true;const stateCode=(input.stateCode??'').trim();const gstin=(input.gstin??'').trim().toUpperCase();const invoicePrefix=(input.invoicePrefix??'INV').trim().toUpperCase();
  const creditNotePrefix=(input.creditNotePrefix??'CN').trim().toUpperCase();
  if(stateCode&&!GST_STATE_CODES.some(([code])=>code===stateCode))throw new Error('Choose a valid GST state code for the store.');
  if(gstin&&(!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)||gstin.slice(0,2)!==stateCode||!validGstinCheck(gstin)))throw new Error('Enter a valid 15-character GSTIN matching the store state code.');
  if(input.gstRegistered===true&&!stateCode)throw new Error('Enter the two-digit GST state code for the store.');
  if(input.gstRegistered===true&&!gstin)throw new Error('GSTIN is required when the store is GST registered.');
  if(!/^[A-Z0-9]{1,4}$/.test(invoicePrefix))throw new Error('Invoice prefix must be 1–4 letters or digits.');
  if(!/^[A-Z0-9]{1,4}$/.test(creditNotePrefix))throw new Error('Credit note prefix must be 1–4 letters or digits.');
  const phone=(input.phone??'').trim();if(phone.length>20||phone&&!/^[+\d][\d ()-]{5,19}$/.test(phone))throw new Error('Enter a valid store phone number (20 characters maximum).');
  const fssai=(input.fssai??'').replace(/\D/g,'');if(fssai&&fssai.length!==14)throw new Error('FSSAI number must contain 14 digits.');
  const upiId=(input.upiId??'').trim();if(upiId.length>100||upiId&&!/^[\w.-]{2,256}@[\w.-]{2,64}$/.test(upiId))throw new Error('Enter a valid UPI ID, such as shop@upi.');
  const upiPayeeName=(input.upiPayeeName??'').trim();if(upiPayeeName.length>80)throw new Error('UPI payee name must be 80 characters or fewer.');
  const receiptPaper=input.receiptPaper??'THERMAL_80';if(!['THERMAL_58','THERMAL_76','THERMAL_80','A5','A4'].includes(receiptPaper))throw new Error('Choose a valid receipt paper size.');
  const receiptLanguage=input.receiptLanguage??'en';if(!['en','hi','bn','as'].includes(receiptLanguage))throw new Error('Choose a supported receipt language.');
  const receiptFooter=(input.receiptFooter??'Thank you for shopping with us!').trim();if(receiptFooter.length>140)throw new Error('Receipt footer must be 140 characters or fewer.');
  const expiryWarningDays=input.expiryWarningDays??30;if(![7,15,30,60,90].includes(expiryWarningDays))throw new Error('Expiry warning must be 7, 15, 30, 60 or 90 days.');
  if(input.employeeDiscountLimitBp!==undefined&&![0,500,1000,1500,2000,2500,5000,10000].includes(input.employeeDiscountLimitBp))throw new Error('Choose a valid employee discount limit.');
  if(input.tableCount!==undefined&&(!Number.isInteger(input.tableCount)||input.tableCount<1||input.tableCount>99))throw new Error('Table count must be between 1 and 99.');
  if(input.onTimeBonusPoints!==undefined&&(!Number.isInteger(input.onTimeBonusPoints)||input.onTimeBonusPoints<0||input.onTimeBonusPoints>10000))throw new Error('On-time payment bonus must be between 0 and 10,000 points.');
  const creditHoldDays=input.creditHoldDays??0;if(!Number.isInteger(creditHoldDays)||![0,7,15,30,60,90].includes(creditHoldDays))throw new Error('Credit hold must be off or 7, 15, 30, 60 or 90 days.');
  const metalRatesPaise:Partial<Record<JewelleryMetal,string>>={};for(const metal of ['GOLD_24K','GOLD_22K','GOLD_18K','SILVER','PLATINUM'] as const){const text=input.metalRatesPaise?.[metal];if(text===undefined||text==='')continue;if(!/^\d{1,19}$/.test(text)||BigInt(text)<=0n)throw new Error(`Enter a valid positive per-gram rate for ${metal.replaceAll('_',' ')}.`);metalRatesPaise[metal]=text;}
  const result:ShopIdentity={storeName,address};
  if('storeLogoPhotoId' in input)result.storeLogoPhotoId=input.storeLogoPhotoId??null;
  if(['gstin','stateCode','gstRegistered','pricesIncludeTax','roundOff','invoicePrefix'].some(key=>key in input))Object.assign(result,{gstin,stateCode,gstRegistered,pricesIncludeTax:input.pricesIncludeTax??true,roundOff:input.roundOff??true,invoicePrefix});
  if('employeeDiscountLimitBp' in input)result.employeeDiscountLimitBp=input.employeeDiscountLimitBp;
  if('tableCount' in input)result.tableCount=input.tableCount;
  if('onTimeBonusPoints' in input)result.onTimeBonusPoints=input.onTimeBonusPoints;
  if('creditHoldDays' in input)result.creditHoldDays=creditHoldDays;
  if('metalRatesPaise' in input)result.metalRatesPaise=metalRatesPaise;
  if('phone' in input)result.phone=phone;
  if('fssai' in input)result.fssai=fssai;
  if('upiId' in input)result.upiId=upiId;
  if('upiPayeeName' in input)result.upiPayeeName=upiPayeeName;
  if('creditNotePrefix' in input)result.creditNotePrefix=creditNotePrefix;
  if('expiryWarningDays' in input)result.expiryWarningDays=expiryWarningDays;
  if('receiptPaper' in input)result.receiptPaper=receiptPaper;
  if('receiptFooter' in input)result.receiptFooter=receiptFooter;
  if('receiptShowHsn' in input)result.receiptShowHsn=input.receiptShowHsn??true;
  if('receiptShowTaxBreakup' in input)result.receiptShowTaxBreakup=input.receiptShowTaxBreakup??true;
  if('receiptShowCustomer' in input)result.receiptShowCustomer=input.receiptShowCustomer??true;
  if('receiptShowSavings' in input)result.receiptShowSavings=input.receiptShowSavings??true;
  if('receiptShowBarcode' in input)result.receiptShowBarcode=input.receiptShowBarcode??true;
  if('receiptShowUpiQr' in input)result.receiptShowUpiQr=input.receiptShowUpiQr??true;
  if('receiptLanguage' in input)result.receiptLanguage=receiptLanguage;
  return result;
}
function validGstinCheck(value:string){const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';let factor=2,sum=0;for(const char of [...value.slice(0,14)].reverse()){const addend=factor*chars.indexOf(char);factor=factor===2?1:2;sum+=Math.floor(addend/36)+addend%36;}return chars[(36-sum%36)%36]===value[14];}
