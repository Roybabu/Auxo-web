import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CatalogService } from '../application/catalogService';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory, type ProductInput, type StockMovement, type VariantInput } from '../domain/catalog';
import { InputField, Table } from './primitives';

const emptyVariant = (): VariantInput => ({size:'',colour:'',sku:'',barcode:'',price:'',mrp:'',cost:'',opening:'0',lowStock:'0'});
const emptyInput = (): ProductInput => ({name:'',category:'GENERAL',brand:'',gstRateBasisPoints:null,apparelGst:false,variants:[emptyVariant()]});
const categories = Object.entries(PRODUCT_CATEGORIES) as [ProductCategory, (typeof PRODUCT_CATEGORIES)[ProductCategory]][];
const money = (paise:string) => (Number(paise)/100).toFixed(2);

export function ProductsPage({service}:{service:CatalogService}) {
  const [products,setProducts]=useState<Product[]>([]); const [form,setForm]=useState<ProductInput>(emptyInput); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  async function refresh(){setProducts(await service.listProducts());}
  useEffect(()=>{void refresh();},[]);
  const sizeColour=PRODUCT_CATEGORIES[form.category].sizeColour;
  function update<K extends keyof ProductInput>(key:K,value:ProductInput[K]){setForm(current=>({...current,[key]:value}));}
  function updateVariant(index:number,key:keyof VariantInput,value:string){setForm(current=>({...current,variants:current.variants.map((v,i)=>i===index?{...v,[key]:value}:v)}));}
  async function submit(event:FormEvent){event.preventDefault();setError('');setMessage('');try{await service.create(form);setForm(emptyInput());await refresh();setMessage('Product saved on this device.');}catch(e){setError(e instanceof Error?e.message:'Could not save product.');}}
  async function setTax(product:Product,selection:string){setError('');setMessage('');try{await service.setTax(product,selection);await refresh();setMessage(`GST rate updated for ${product.name}.`);}catch(e){setError(e instanceof Error?e.message:'Could not update GST rate.');}}
  return <section><h1>Products</h1><p>Add products and sellable variants. Category rules, barcode checks and price validation follow the Android product rules.</p>
    <form onSubmit={submit}>
      <div className="form-grid"><InputField label="Product name" required minLength={2} maxLength={80} value={form.name} onChange={e=>update('name',e.target.value)}/>
        <label>Category<select value={form.category} onChange={e=>{const category=e.target.value as ProductCategory;setForm(current=>({...current,category,apparelGst:current.apparelGst&&['GARMENT','FOOTWEAR'].includes(category)}));}}>{categories.map(([key,c])=><option key={key} value={key}>{c.label}</option>)}</select></label>
        <InputField label="Brand (optional)" maxLength={60} value={form.brand} onChange={e=>update('brand',e.target.value)}/>
        <label>GST rate<select value={form.apparelGst?'APPAREL':form.gstRateBasisPoints===null?'':String(form.gstRateBasisPoints)} onChange={e=>{const value=e.target.value;setForm(current=>({...current,apparelGst:value==='APPAREL',gstRateBasisPoints:value===''||value==='APPAREL'?null:Number(value)}));}}><option value="">Choose rate</option>{[0,500,1800,4000].map(rate=><option key={rate} value={rate}>{rate/100}%</option>)}{['GARMENT','FOOTWEAR'].includes(form.category)&&<option value="APPAREL">Garments / footwear slab (5% or 18%)</option>}</select></label></div>
      {form.apparelGst&&form.category!=='GARMENT'&&form.category!=='FOOTWEAR'&&<p className="error">The apparel GST slab only applies to garments or footwear; select another rate.</p>}
      <h2>Sellable variants</h2>
      {form.variants.map((v,index)=><fieldset className="variant-form" key={index}><legend>Variant {index+1}</legend><div className="form-grid">
        {sizeColour&&<><InputField label="Size" maxLength={12} value={v.size} onChange={e=>updateVariant(index,'size',e.target.value)}/><InputField label="Colour" maxLength={30} value={v.colour} onChange={e=>updateVariant(index,'colour',e.target.value)}/></>}
        <InputField label="SKU (optional)" maxLength={32} value={v.sku} onChange={e=>updateVariant(index,'sku',e.target.value)}/><InputField label="Barcode (optional)" maxLength={32} value={v.barcode} onChange={e=>updateVariant(index,'barcode',e.target.value)}/>
        <InputField label="Selling price" inputMode="decimal" required value={v.price} onChange={e=>updateVariant(index,'price',e.target.value)}/><InputField label="MRP (optional)" inputMode="decimal" value={v.mrp} onChange={e=>updateVariant(index,'mrp',e.target.value)}/><InputField label="Cost (optional)" inputMode="decimal" value={v.cost} onChange={e=>updateVariant(index,'cost',e.target.value)}/>
        <InputField label={form.category==='LOOSE'?'Opening stock (grams)':'Opening stock (units)'} inputMode="decimal" value={v.opening} onChange={e=>updateVariant(index,'opening',e.target.value)}/><InputField label="Low stock alert level" inputMode="numeric" value={v.lowStock} onChange={e=>updateVariant(index,'lowStock',e.target.value)}/></div>
        {form.variants.length>1&&<button type="button" className="secondary" onClick={()=>update('variants',form.variants.filter((_,i)=>i!==index))}>Remove variant</button>}
      </fieldset>)}
      <div className="button-row"><button type="button" className="secondary" onClick={()=>update('variants',[...form.variants,emptyVariant()])}>Add variant</button><button type="submit">Save product</button></div>
      {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    </form>
    <h2>Saved products ({products.length})</h2>
    <Table headings={['Product','Category','Variant','GST','Price','Stock','SKU / barcode']}>
      {products.flatMap(p=>p.variants.map((v,index)=><tr key={v.id}>{index===0&&<td rowSpan={p.variants.length}>{p.name}{p.brand?` · ${p.brand}`:''}</td>}{index===0&&<td rowSpan={p.variants.length}>{PRODUCT_CATEGORIES[p.category].label}</td>}<td>{[v.size,v.colour].filter(Boolean).join(' / ')||'Default'}</td><td>{index===0&&<select aria-label={`GST rate for ${p.name}`} value={p.apparelGst?'APPAREL':p.gstRateBasisPoints==null?'':String(p.gstRateBasisPoints)} onChange={e=>void setTax(p,e.target.value)}><option value="">Not set</option>{[0,500,1800,4000].map(rate=><option key={rate} value={rate}>{rate/100}%</option>)}{['GARMENT','FOOTWEAR'].includes(p.category)&&<option value="APPAREL">Apparel slab</option>}</select>}</td><td>{money(v.pricePaise)}</td><td>{p.category==='LOOSE'?(v.stock/1000).toFixed(3):v.stock}</td><td>{v.sku||'—'}{v.barcode?` / ${v.barcode}`:''}</td></tr>))}
      {products.length===0&&<tr><td colSpan={7}>No products saved yet.</td></tr>}
    </Table>
  </section>;
}

const reasons=[['RECEIVED','Received'],['RETURNED','Returned'],['SOLD','Sold'],['DAMAGED','Damaged'],['CORRECTION','Stock count correction']] as const;
type AdjustmentReason=typeof reasons[number][0];
export function InventoryPage({service}:{service:CatalogService}) {
  const [products,setProducts]=useState<Product[]>([]); const [movements,setMovements]=useState<StockMovement[]>([]); const [values,setValues]=useState<Record<string,{reason:AdjustmentReason;quantity:string;note:string}>>({}); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  async function refresh(){const [p,m]=await Promise.all([service.listProducts(),service.listMovements()]);setProducts(p);setMovements(m);}
  useEffect(()=>{void refresh();},[]);
  const labels=useMemo(()=>new Map(products.flatMap(p=>p.variants.map(v=>[v.id,`${p.name}${v.size||v.colour?` · ${[v.size,v.colour].filter(Boolean).join(' / ')}`:''}`]))),[products]);
  function formFor(id:string){return values[id]??{reason:'RECEIVED' as AdjustmentReason,quantity:'',note:''};}
  async function save(id:string){const item=formFor(id);setError('');setMessage('');try{await service.adjust(id,item.quantity,item.reason,item.note);setValues(current=>({...current,[id]:{...item,quantity:'',note:''}}));await refresh();setMessage('Stock updated and movement recorded.');}catch(e){setError(e instanceof Error?e.message:'Could not update stock.');}}
  return <section><h1>Inventory</h1><p>Current stock and manual movements are stored locally. Loose goods are shown in grams.</p>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <Table headings={['Product / variant','On hand','Adjustment','Quantity','Note','']}>
      {products.flatMap(p=>p.variants.map(v=>{const item=formFor(v.id);return <tr key={v.id}><td>{labels.get(v.id)}<small className="muted">{v.sku||v.barcode||'No SKU / barcode'}</small></td><td>{p.category==='LOOSE'?(v.stock/1000).toFixed(3)+' g':v.stock}</td><td><select aria-label="Adjustment reason" value={item.reason} onChange={e=>setValues(c=>({...c,[v.id]:{...item,reason:e.target.value as AdjustmentReason}}))}>{reasons.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></td><td><input aria-label="Adjustment quantity" inputMode="decimal" value={item.quantity} onChange={e=>setValues(c=>({...c,[v.id]:{...item,quantity:e.target.value}}))}/></td><td><input aria-label="Movement note" value={item.note} onChange={e=>setValues(c=>({...c,[v.id]:{...item,note:e.target.value}}))}/></td><td><button type="button" onClick={()=>void save(v.id)}>Apply</button></td></tr>}))}
      {products.length===0&&<tr><td colSpan={6}>Add a product first to manage stock.</td></tr>}
    </Table>
    <h2>Recent stock movements</h2><Table headings={['Time','Product / variant','Reason','Change']}>
      {movements.slice(0,100).map(m=>{const product=products.find(p=>p.variants.some(v=>v.id===m.variantId));const amount=product?.category==='LOOSE'?`${(Math.abs(m.quantityChange)/1000).toFixed(3)} g`:`${Math.abs(m.quantityChange)} units`;return <tr key={m.id}><td>{new Date(m.createdAt).toLocaleString()}</td><td>{labels.get(m.variantId)??'Removed product'}</td><td>{m.reason}</td><td>{m.quantityChange>0?'+':'−'}{amount}</td></tr>;})}
      {movements.length===0&&<tr><td colSpan={4}>No stock movements recorded yet.</td></tr>}
    </Table>
  </section>;
}
