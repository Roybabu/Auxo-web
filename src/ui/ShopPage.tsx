import { useEffect, useState, type FormEvent } from 'react';
import type { ShopService } from '../application/shopService';
import { InputField } from './primitives';
export function ShopPage({ service }: {service: ShopService}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState<'loading'|'ready'|'saving'|'failed'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    service.load().then(shop => {
      if (!live) return;
      setName(shop?.storeName ?? ''); setAddress(shop?.address ?? ''); setState('ready');
    }).catch(() => { if (live) {setState('failed'); setMessage('Local data could not be opened. Reload to retry.');} });
    return () => {live = false;};
  }, [service]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setState('saving'); setMessage('');
    try {
      const saved = await service.save({storeName: name, address});
      setName(saved.storeName); setAddress(saved.address); setMessage('Store details saved on this device.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Saving failed. Please retry.');}
    finally {setState('ready');}
  }
  return <section><h1>Business settings</h1><p>Set the store name and address. Other settings will follow.</p>
    <form onSubmit={submit}><fieldset disabled={state !== 'ready'}>
      <InputField label="Store name" required maxLength={70} value={name} onChange={e=>setName(e.target.value)}/>
      <InputField label="Address" maxLength={200} value={address} onChange={e=>setAddress(e.target.value)}/>
      <button type="submit">{state==='saving'?'Saving…':'Save store details'}</button>
    </fieldset></form><p role="status">{state === 'loading' ? 'Opening local storage…' : message}</p>
  </section>;
}
