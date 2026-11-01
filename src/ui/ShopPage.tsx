import { useEffect, useState, type FormEvent } from 'react';
import type { ShopService } from '../application/shopService';
import { InputField } from './primitives';
import { GST_STATE_CODES } from '../domain/shop';
export function ShopPage({ service }: {service: ShopService}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin,setGstin]=useState('');const [stateCode,setStateCode]=useState('');const [gstRegistered,setGstRegistered]=useState(true);const [pricesIncludeTax,setPricesIncludeTax]=useState(true);const [roundOff,setRoundOff]=useState(true);const [invoicePrefix,setInvoicePrefix]=useState('INV');
  const [employeeDiscountLimitBp,setEmployeeDiscountLimitBp]=useState(0);
  const [tableCount,setTableCount]=useState(10);
  const [state, setState] = useState<'loading'|'ready'|'saving'|'failed'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    service.load().then(shop => {
      if (!live) return;
      setName(shop?.storeName ?? ''); setAddress(shop?.address ?? '');setGstin(shop?.gstin??'');setStateCode(shop?.stateCode??'');setGstRegistered(shop?.gstRegistered??true);setPricesIncludeTax(shop?.pricesIncludeTax??true);setRoundOff(shop?.roundOff??true);setInvoicePrefix(shop?.invoicePrefix??'INV');setEmployeeDiscountLimitBp(shop?.employeeDiscountLimitBp??0);setTableCount(shop?.tableCount??10); setState('ready');
    }).catch(() => { if (live) {setState('failed'); setMessage('Local data could not be opened. Reload to retry.');} });
    return () => {live = false;};
  }, [service]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setState('saving'); setMessage('');
    try {
      const saved = await service.save({storeName: name, address,gstin,stateCode,gstRegistered,pricesIncludeTax,roundOff,invoicePrefix,employeeDiscountLimitBp,tableCount});
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
      <label>Employee discount limit<select value={employeeDiscountLimitBp} onChange={e=>setEmployeeDiscountLimitBp(Number(e.target.value))}>{[0,500,1000,1500,2000,2500,5000,10000].map(rate=><option key={rate} value={rate}>{rate/100}%</option>)}</select></label>
      <InputField label="Restaurant table count (1–99)" type="number" inputMode="numeric" min={1} max={99} value={String(tableCount)} onChange={e=>setTableCount(Number(e.target.value))}/>
      <button type="submit">{state==='saving'?'Saving…':'Save business and billing settings'}</button>
    </fieldset></form><p role="status">{state === 'loading' ? 'Opening local storage…' : message}</p>
  </section>;
}
