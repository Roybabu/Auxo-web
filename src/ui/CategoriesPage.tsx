import {useEffect,useState,type FormEvent} from 'react';
import type {CategoryService} from '../application/categoryService';
import {PRODUCT_CATEGORIES,type ProductCategory} from '../domain/catalog';
import type {ShopCategory} from '../domain/categories';
import {Table} from './primitives';
export function CategoriesPage({service}:{service:CategoryService}){
 const [rows,setRows]=useState<ShopCategory[]>([]),[name,setName]=useState(''),[profile,setProfile]=useState<ProductCategory>('GENERAL'),[drafts,setDrafts]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function refresh(){setRows(await service.list());}
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not load categories.'));},[]);
 async function run(action:()=>Promise<unknown>,success:string){setError('');setMessage('');try{await action();await refresh();setMessage(success);}catch(e){setError(e instanceof Error?e.message:'Category update failed.');}}
 async function add(event:FormEvent){event.preventDefault();await run(()=>service.add(name,profile),'Category added.');setName('');}
 return <section><h1>Product categories</h1><p>Categories control product behavior. Disabling a category hides it from new product entry while keeping existing products, stock, invoices and reports.</p>
  <form onSubmit={e=>void add(e)}><div className="form-grid"><label>Category name<input required maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></label><label>Product profile<select value={profile} onChange={e=>setProfile(e.target.value as ProductCategory)}>{(Object.keys(PRODUCT_CATEGORIES) as ProductCategory[]).map(key=><option key={key} value={key}>{PRODUCT_CATEGORIES[key].label}</option>)}</select></label><button type="submit">Add category</button></div></form>
  {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <Table headings={['Category','Product profile','Status','Actions']}>{rows.map(row=><tr key={row.id}><td>{row.name??PRODUCT_CATEGORIES[row.profile].label}</td><td>{PRODUCT_CATEGORIES[row.profile].label}{row.builtIn?' · built in':' · custom'}</td><td><label className="check-label"><input type="checkbox" checked={row.enabled} onChange={e=>void run(()=>service.setEnabled(row.id,e.target.checked),`Category ${e.target.checked?'enabled':'disabled'}.`)}/> Enabled for new products</label></td><td><div className="inline-edit"><input aria-label={`Rename ${row.name??PRODUCT_CATEGORIES[row.profile].label}`} maxLength={40} value={drafts[row.id]??row.name??''} onChange={e=>setDrafts(current=>({...current,[row.id]:e.target.value}))}/><button type="button" onClick={()=>void run(()=>service.rename(row.id,drafts[row.id]??row.name??''),'Category renamed.')}>Rename</button>{!row.builtIn&&<button type="button" className="secondary" onClick={()=>void run(()=>service.remove(row.id),'Category deleted.')}>Delete</button>}</div></td></tr>)}</Table>
 </section>;
}
