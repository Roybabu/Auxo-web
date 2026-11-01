import {useEffect,useState,type FormEvent} from 'react';
import type {CategoryService} from '../application/categoryService';
import {PRODUCT_CATEGORIES} from '../domain/catalog';
import type {ShopCategory} from '../domain/categories';
export function CategorySetupPage({service,onDone}:{service:CategoryService;onDone:()=>void}){
 const [rows,setRows]=useState<ShopCategory[]>([]),[selected,setSelected]=useState<Set<string>>(new Set()),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{service.list().then(items=>{setRows(items);setSelected(new Set(items.filter(item=>item.enabled).map(item=>item.id)));}).catch(e=>setError(e instanceof Error?e.message:'Could not load product categories.'));},[service]);
 async function submit(event:FormEvent){event.preventDefault();setError('');if(!selected.size){setError('Choose at least one selling category.');return;}setBusy(true);try{await service.applySetup(selected);onDone();}catch(e){setError(e instanceof Error?e.message:'Could not save category setup.');}finally{setBusy(false);}}
 return <main className="auth-screen"><section><h1>Choose product categories</h1><p>Select the kinds of products this business sells. You can change this later in Product categories.</p><form onSubmit={e=>void submit(e)}><fieldset disabled={busy||!rows.length}>{rows.map(row=><label className="check-label" key={row.id}><input type="checkbox" checked={selected.has(row.id)} onChange={e=>setSelected(current=>{const next=new Set(current);if(e.target.checked)next.add(row.id);else next.delete(row.id);return next;})}/>{row.name??PRODUCT_CATEGORIES[row.profile].label}</label>)}<button type="submit">Save and continue</button></fieldset></form>{error&&<p className="error" role="alert">{error}</p>}</section></main>;
}
