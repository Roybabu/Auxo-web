import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { SalesService } from '../application/salesService';
import type { BillingCustomer, CustomerLedgerEntry } from '../domain/billing';
import { formatMoney } from '../domain/money';
import { Table } from './primitives';

type Method='CASH'|'UPI'|'CARD';
export function CustomerAccountsPage({sales}:{sales:SalesService}){
  const [customers,setCustomers]=useState<BillingCustomer[]>([]);const [selectedId,setSelectedId]=useState('');const [ledger,setLedger]=useState<CustomerLedgerEntry[]>([]);const [amount,setAmount]=useState('');const [method,setMethod]=useState<Method>('CASH');const [reference,setReference]=useState('');const [note,setNote]=useState('');const [error,setError]=useState('');const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);
  const selected=customers.find(c=>c.id===selectedId)??null;
  async function refresh(){setCustomers(await sales.listCustomers());}
  useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not load customers.'));},[sales]);
  useEffect(()=>{let active=true;if(!selectedId){setLedger([]);return;}sales.listCustomerLedger(selectedId).then(rows=>{if(active)setLedger(rows);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load the account statement.');});return()=>{active=false;};},[sales,selectedId]);
  const statement=useMemo(()=>{let balance=0n;return ledger.map(entry=>{const amount=BigInt(entry.amountPaise);balance+=amount;return {entry,balance};});},[ledger]);
  async function submit(event:FormEvent){event.preventDefault();if(!selected)return;setSaving(true);setError('');setMessage('');try{await sales.receiveAccountPayment(selected.id,{amount,method,reference,note});setAmount('');setReference('');setNote('');await refresh();setLedger(await sales.listCustomerLedger(selected.id));setMessage(`Payment recorded for ${selected.name}.`);}catch(e){setError(e instanceof Error?e.message:'Could not record account payment.');await refresh();}finally{setSaving(false);}}
  return <section><h1>Customer accounts</h1><p>Receive money against an outstanding customer balance and review the account statement.</p>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {customers.length===0?<p>No saved customers yet. Add a customer from POS billing before recording account activity.</p>:<label className="account-customer-select">Customer<select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setError('');setMessage('');}}><option value="">Choose customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}</select></label>}
    {selected&&<><div className="account-summary"><div><span>Outstanding balance</span><strong>{formatMoney(BigInt(selected.balancePaise))}</strong></div><div><span>Credit limit</span><strong>{selected.creditLimitPaise===null?'No limit':formatMoney(BigInt(selected.creditLimitPaise))}</strong></div></div>
      <h2>Receive account payment</h2><form className="account-payment-form" onSubmit={submit}><label>Amount<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} disabled={BigInt(selected.balancePaise)<=0n}/></label><label>Payment method<select value={method} onChange={e=>setMethod(e.target.value as Method)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></label>{method!=='CASH'&&<label>{method==='UPI'?'UPI reference':'Card last four digits'}<input value={reference} onChange={e=>setReference(e.target.value)}/></label>}<label>Note (optional)<input maxLength={120} value={note} onChange={e=>setNote(e.target.value)}/></label><button type="submit" disabled={saving||BigInt(selected.balancePaise)<=0n}>{saving?'Saving payment…':'Record payment'}</button></form>
      <h2>Account statement</h2><Table headings={['Date','Activity','Reference','Debit','Credit','Balance']}>
        {statement.map(({entry,balance})=><tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.type==='SALE'?'Sale on account':`Account payment · ${entry.method??''}`}{entry.note&&<small className="muted">{entry.note}</small>}</td><td>{entry.invoiceNumber??entry.reference??'—'}</td><td>{BigInt(entry.amountPaise)>0n?formatMoney(BigInt(entry.amountPaise)):'—'}</td><td>{BigInt(entry.amountPaise)<0n?formatMoney(-BigInt(entry.amountPaise)):'—'}</td><td>{formatMoney(balance)}</td></tr>)}
        {statement.length===0&&<tr><td colSpan={6}>No account activity recorded.</td></tr>}
      </Table>
    </>}
  </section>;
}
