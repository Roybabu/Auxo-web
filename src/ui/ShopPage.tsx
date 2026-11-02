import { useEffect, useState, type FormEvent } from 'react';
import type { ShopService } from '../application/shopService';
import { InputField } from './primitives';
import { GST_STATE_CODES } from '../domain/shop';
import type { ShopIdentity } from '../domain/shop';
import {formatMoney,parseMoney} from '../domain/money';
import type {JewelleryMetal} from '../domain/shop';
const metals:JewelleryMetal[]=['GOLD_24K','GOLD_22K','GOLD_18K','SILVER','PLATINUM'];
export function ShopPage({ service }: {service: ShopService}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin,setGstin]=useState('');const [stateCode,setStateCode]=useState('');const [gstRegistered,setGstRegistered]=useState(true);const [pricesIncludeTax,setPricesIncludeTax]=useState(true);const [roundOff,setRoundOff]=useState(true);const [invoicePrefix,setInvoicePrefix]=useState('INV');
  const [employeeDiscountLimitBp,setEmployeeDiscountLimitBp]=useState(0);
  const [tableCount,setTableCount]=useState(10);
  const [onTimeBonusPoints,setOnTimeBonusPoints]=useState(0);
  const [creditHoldDays,setCreditHoldDays]=useState(0);const [metalRateText,setMetalRateText]=useState<Record<JewelleryMetal,string>>({GOLD_24K:'',GOLD_22K:'',GOLD_18K:'',SILVER:'',PLATINUM:''});
  const [extra,setExtra]=useState<Partial<ShopIdentity>>({});
  const updateExtra=(value:Partial<ShopIdentity>)=>setExtra(current=>({...current,...value}));
  const [state, setState] = useState<'loading'|'ready'|'saving'|'failed'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    service.load().then(shop => {
      if (!live) return;
      setName(shop?.storeName ?? ''); setAddress(shop?.address ?? '');setGstin(shop?.gstin??'');setStateCode(shop?.stateCode??'');setGstRegistered(shop?.gstRegistered??true);setPricesIncludeTax(shop?.pricesIncludeTax??true);setRoundOff(shop?.roundOff??true);setInvoicePrefix(shop?.invoicePrefix??'INV');setEmployeeDiscountLimitBp(shop?.employeeDiscountLimitBp??0);setTableCount(shop?.tableCount??10);setOnTimeBonusPoints(shop?.onTimeBonusPoints??0);setCreditHoldDays(shop?.creditHoldDays??0);setMetalRateText(Object.fromEntries(metals.map(metal=>[metal,shop?.metalRatesPaise?.[metal]?formatMoney(BigInt(shop.metalRatesPaise[metal]!)):''])) as Record<JewelleryMetal,string>);setExtra({phone:shop?.phone??'',fssai:shop?.fssai??'',upiId:shop?.upiId??'',upiPayeeName:shop?.upiPayeeName??'',creditNotePrefix:shop?.creditNotePrefix??'CN',expiryWarningDays:shop?.expiryWarningDays??30,receiptPaper:shop?.receiptPaper??'THERMAL_80',receiptFooter:shop?.receiptFooter??'Thank you for shopping with us!',receiptShowHsn:shop?.receiptShowHsn??true,receiptShowTaxBreakup:shop?.receiptShowTaxBreakup??true,receiptShowCustomer:shop?.receiptShowCustomer??true,receiptShowSavings:shop?.receiptShowSavings??true,receiptShowBarcode:shop?.receiptShowBarcode??true,receiptShowUpiQr:shop?.receiptShowUpiQr??true,receiptLanguage:shop?.receiptLanguage??'en'}); setState('ready');
    }).catch(() => { if (live) {setState('failed'); setMessage('Local data could not be opened. Reload to retry.');} });
    return () => {live = false;};
  }, [service]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setState('saving'); setMessage('');
    try {
      const metalRatesPaise:Partial<Record<JewelleryMetal,string>>={};for(const metal of metals){const text=metalRateText[metal].trim();if(!text)continue;const paise=parseMoney(text);if(paise===null||paise<=0n)throw new Error(`Enter a positive valid rate for ${metal.replaceAll('_',' ')}.`);metalRatesPaise[metal]=paise.toString();}
      const saved = await service.save({storeName: name, address,gstin,stateCode,gstRegistered,pricesIncludeTax,roundOff,invoicePrefix,employeeDiscountLimitBp,tableCount,onTimeBonusPoints,creditHoldDays,metalRatesPaise,...extra});
      setName(saved.storeName); setAddress(saved.address);setGstin(saved.gstin??'');setStateCode(saved.stateCode??'');setInvoicePrefix(saved.invoicePrefix??'INV'); setMessage('Business and billing settings saved on this device.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Saving failed. Please retry.');}
    finally {setState('ready');}
  }
  return <section><h1>Business settings</h1><p>Store identity and the billing tax settings used when invoices are created.</p>
    <form onSubmit={submit}><fieldset disabled={state !== 'ready'}>
      <InputField label="Store name" required maxLength={70} value={name} onChange={e=>setName(e.target.value)}/>
      <InputField label="Address" maxLength={200} value={address} onChange={e=>setAddress(e.target.value)}/>
      <label className="check-label"><input type="checkbox" checked={gstRegistered} onChange={e=>{setGstRegistered(e.target.checked);if(!e.target.checked)setGstin('');}}/> GST registered</label>
      {gstRegistered&&<><InputField label="GSTIN" required maxLength={15} value={gstin} onChange={e=>setGstin(e.target.value.toUpperCase())}/><label>GST state<select required value={stateCode} onChange={e=>setStateCode(e.target.value)}><option value="">Choose state</option>{GST_STATE_CODES.map(([code,name])=><option key={code} value={code}>{name} ({code})</option>)}</select></label></>}
      <label className="check-label"><input type="checkbox" checked={pricesIncludeTax} onChange={e=>setPricesIncludeTax(e.target.checked)}/> Product prices include GST</label>
      <label className="check-label"><input type="checkbox" checked={roundOff} onChange={e=>setRoundOff(e.target.checked)}/> Round invoice total to nearest rupee</label>
      <InputField label="Invoice prefix" required minLength={1} maxLength={4} pattern="[A-Za-z0-9]{1,4}" value={invoicePrefix} onChange={e=>setInvoicePrefix(e.target.value.toUpperCase())}/>
      <h2>Store details</h2>
      <InputField label="Store phone number" maxLength={20} value={extra.phone??''} onChange={e=>updateExtra({phone:e.target.value})}/>
      <InputField label="FSSAI licence / registration number (optional)" inputMode="numeric" maxLength={14} value={extra.fssai??''} onChange={e=>updateExtra({fssai:e.target.value.replace(/\D/g,'').slice(0,14)})}/>
      <InputField label="UPI ID (optional)" maxLength={100} placeholder="shop@upi" value={extra.upiId??''} onChange={e=>updateExtra({upiId:e.target.value})}/>
      <InputField label="UPI payee name" maxLength={80} value={extra.upiPayeeName??''} onChange={e=>updateExtra({upiPayeeName:e.target.value})}/>
      <h2>Receipt settings</h2>
      <label>Receipt paper<select value={extra.receiptPaper??'THERMAL_80'} onChange={e=>updateExtra({receiptPaper:e.target.value as ShopIdentity['receiptPaper']})}><option value="THERMAL_58">58 mm thermal</option><option value="THERMAL_76">76 mm thermal</option><option value="THERMAL_80">80 mm thermal</option><option value="A5">A5</option><option value="A4">A4</option></select></label>
      <label>Receipt language<select value={extra.receiptLanguage??'en'} onChange={e=>updateExtra({receiptLanguage:e.target.value as ShopIdentity['receiptLanguage']})}><option value="en">English</option><option value="hi">हिन्दी</option><option value="bn">বাংলা</option><option value="as">অসমীয়া</option></select></label>
      <InputField label="Receipt footer" maxLength={140} value={extra.receiptFooter??''} onChange={e=>updateExtra({receiptFooter:e.target.value})}/>
      {([['receiptShowHsn','Show HSN codes'],['receiptShowTaxBreakup','Show tax breakdown'],['receiptShowCustomer','Show customer details'],['receiptShowSavings','Show savings'],['receiptShowBarcode','Show invoice barcode'],['receiptShowUpiQr','Show UPI payment QR'] ] as const).map(([key,label])=><label className="check-label" key={key}><input type="checkbox" checked={extra[key]??true} onChange={e=>updateExtra({[key]:e.target.checked})}/>{label}</label>)}
      <h2>Credit notes and expiry alerts</h2>
      <InputField label="Credit note prefix" required minLength={1} maxLength={4} pattern="[A-Za-z0-9]{1,4}" value={extra.creditNotePrefix??'CN'} onChange={e=>updateExtra({creditNotePrefix:e.target.value.toUpperCase()})}/>
      <label>Flag stock expiring within<select value={extra.expiryWarningDays??30} onChange={e=>updateExtra({expiryWarningDays:Number(e.target.value)})}>{[7,15,30,60,90].map(days=><option key={days} value={days}>{days} days</option>)}</select></label>
      <label>Employee discount limit<select value={employeeDiscountLimitBp} onChange={e=>setEmployeeDiscountLimitBp(Number(e.target.value))}>{[0,500,1000,1500,2000,2500,5000,10000].map(rate=><option key={rate} value={rate}>{rate/100}%</option>)}</select></label>
      <InputField label="On-time account payment bonus points (0–10,000; 0 disables)" type="number" min={0} max={10000} value={String(onTimeBonusPoints)} onChange={e=>setOnTimeBonusPoints(Number(e.target.value))}/>
      <h2>Customer credit policy</h2><label>Block new account credit when the oldest unpaid balance is older than<select value={creditHoldDays} onChange={e=>setCreditHoldDays(Number(e.target.value))}><option value={0}>Never automatically</option>{[7,15,30,60,90].map(days=><option key={days} value={days}>{days} days</option>)}</select></label><p className="muted">A customer account can also be placed on manual credit hold from Customers. Existing balances and payments remain available.</p>
      <h2>Jewellery prices</h2><p className="muted">Enter today’s metal rate per gram. AUXO calculates each jewellery item from its weight, making charge and GST when creating a bill.</p><div className="form-grid">{metals.map(metal=><InputField key={metal} label={`${metal.replaceAll('_',' ')} rate per gram (₹)`} inputMode="decimal" value={metalRateText[metal]} onChange={e=>setMetalRateText(current=>({...current,[metal]:e.target.value}))}/>)}</div>
      <InputField label="Restaurant table count (1–99)" type="number" inputMode="numeric" min={1} max={99} value={String(tableCount)} onChange={e=>setTableCount(Number(e.target.value))}/>
      <button type="submit">{state==='saving'?'Saving…':'Save business and billing settings'}</button>
    </fieldset></form><p role="status">{state === 'loading' ? 'Opening local storage…' : message}</p>
  </section>;
}
