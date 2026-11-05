import {useCallback,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import type {CatalogService} from '../application/catalogService';
import type {ShopService} from '../application/shopService';
import type {ProductPhotoService} from '../application/productPhotoService';
import type {Permission} from '../domain/access';
import {PRODUCT_CATEGORIES,stockQuantityInputText,stockUnitEntrySymbol,variantAttributesLabel,type Product,type ProductVariant} from '../domain/catalog';
import type {ShopCategory} from '../domain/categories';
import type {StockBatch} from '../domain/batches';
import {productsCsv} from '../domain/productExport';
import {PageTabs,EmptyState} from './Shell';
import {Pager,RowMenu,SearchField,SortHeader,StatusPill,Thumb,ToolbarButton,ToolbarLink,downloadText,rupees,todayStamp,usePages,useSort,type Tone} from './Kit';

type Can=(permission:Permission)=>boolean;
export type StockStatus='IN'|'LOW'|'OUT'|'UNTRACKED';
/** Same rule as the stock alerts and reorder list: at or below the alert level is low. */
export function stockStatus(product:Product,variant:ProductVariant):StockStatus{if(product.tracksStock===false)return 'UNTRACKED';if(variant.stock<=0)return 'OUT';if(variant.stock<=variant.lowStockThreshold)return 'LOW';return 'IN';}
const STATUS:Record<StockStatus,[string,Tone,number]>={IN:['In Stock','success',3],LOW:['Low Stock','warning',1],OUT:['Out of Stock','danger',0],UNTRACKED:['Not tracked','neutral',2]};
const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

type Row={product:Product;variant:ProductVariant;category:string;status:StockStatus};
function useStock(catalog:CatalogService){
  const [products,setProducts]=useState<Product[]>([]),[categories,setCategories]=useState<ShopCategory[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
  const refresh=useCallback(async()=>{try{const [p,c]=await Promise.all([catalog.listProducts(),catalog.listCategories().catch(()=>[] as ShopCategory[])]);setProducts(p);setCategories(c);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load stock.');}finally{setLoaded(true);}},[catalog]);
  useEffect(()=>{void refresh();},[refresh]);
  const rows=useMemo(()=>{const names=new Map(categories.map(c=>[c.id,c.name??PRODUCT_CATEGORIES[c.profile].label]));return products.flatMap(product=>product.variants.map(variant=>({product,variant,category:(product.categoryId&&names.get(product.categoryId))||PRODUCT_CATEGORIES[product.category].label,status:stockStatus(product,variant)})));},[products,categories]);
  return {products,categories,rows,loaded,error,refresh};
}

/** Tabs for every stock page, with live alert counts. */
export function StockTabs({catalog,shops,canReorder,children}:{catalog:CatalogService;shops:ShopService;canReorder:boolean;children:ReactNode}){
  const [counts,setCounts]=useState({alerts:0,expiring:0}),{pathname}=useLocation();
  useEffect(()=>{let live=true;Promise.all([catalog.listProducts(),catalog.listStockBatches().catch(()=>[] as StockBatch[]),shops.load().catch(()=>null)]).then(([products,batches,shop])=>{if(!live)return;const limit=new Date();limit.setDate(limit.getDate()+(shop?.expiryWarningDays??30));const max=dayKey(limit);setCounts({alerts:products.reduce((n,p)=>n+p.variants.filter(v=>{const s=stockStatus(p,v);return s==='LOW'||s==='OUT';}).length,0),expiring:batches.filter(b=>b.quantity>0&&b.expiryDate&&b.expiryDate<=max).length});}).catch(()=>{});return()=>{live=false;};},[catalog,shops,pathname]);
  return <div className="tabbed-page"><PageTabs label="Stock" tabs={[{to:'/stock',label:'Items',end:true},{to:'/stock/alerts',label:'Stock Alerts',count:counts.alerts},{to:'/stock-alerts',label:canReorder?'Reorder':'Reorder list'},{to:'/stock/expiring',label:'Expiring Soon',count:counts.expiring}]}/>{children}</div>;
}

type SortKey='name'|'category'|'stock'|'unit'|'price'|'status';
const sortValue=(row:Row,key:SortKey)=>key==='name'?row.product.name+' '+variantAttributesLabel(row.variant):key==='category'?row.category:key==='stock'?row.variant.stock:key==='unit'?row.product.stockUnit:key==='price'?Number(row.variant.pricePaise):STATUS[row.status][2];

function InventoryTable({rows,photos,can,products,categories,empty,noun='items'}:{rows:Row[];photos:ProductPhotoService;can:Can;products:Product[];categories:ShopCategory[];empty:ReactNode;noun?:string}){
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const {sorted,sort,toggle}=useSort<Row,SortKey>(rows,{key:'name',dir:'asc'},sortValue);
  const {slice,...pager}=usePages(sorted,10);
  useEffect(()=>{setSelected(current=>{const ids=new Set(rows.map(r=>r.variant.id));const next=new Set([...current].filter(id=>ids.has(id)));return next.size===current.size?current:next;});},[rows]);
  const pageIds=slice.map(r=>r.variant.id),allOnPage=pageIds.length>0&&pageIds.every(id=>selected.has(id));
  function togglePage(){setSelected(current=>{const next=new Set(current);if(allOnPage)pageIds.forEach(id=>next.delete(id));else pageIds.forEach(id=>next.add(id));return next;});}
  function toggleOne(id:string){setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  if(!rows.length)return <div className="table-card">{empty}</div>;
  return <div className="table-card">
    {selected.size>0&&<div className="selection-bar" role="status"><strong>{selected.size} selected</strong><button type="button" className="link-button" onClick={()=>downloadText(productsCsv(products,categories,selected),`auxo-products-selected-${todayStamp()}.csv`)}>Export selected</button><button type="button" className="link-button" onClick={()=>setSelected(new Set())}>Clear selection</button></div>}
    <div className="table-scroll"><table className="data-table">
      <thead><tr><th scope="col" className="check-col"><input type="checkbox" aria-label="Select all items on this page" checked={allOnPage} onChange={togglePage}/></th><SortHeader label="Item Name" sortKey="name" sort={sort} onSort={toggle}/><SortHeader label="Category" sortKey="category" sort={sort} onSort={toggle}/><SortHeader label="Stock" sortKey="stock" sort={sort} onSort={toggle} align="right"/><SortHeader label="Unit" sortKey="unit" sort={sort} onSort={toggle}/><SortHeader label="Selling Price" sortKey="price" sort={sort} onSort={toggle} align="right"/><SortHeader label="Status" sortKey="status" sort={sort} onSort={toggle}/><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{slice.map(row=>{const {product,variant}=row,label=variantAttributesLabel(variant),[statusText,tone]=STATUS[row.status],name=`${product.name}${label?` (${label})`:''}`;return <tr key={variant.id} className={selected.has(variant.id)?'selected':undefined}>
        <td className="check-col"><input type="checkbox" aria-label={`Select ${name}`} checked={selected.has(variant.id)} onChange={()=>toggleOne(variant.id)}/></td>
        <td><div className="item-cell"><Thumb photos={photos} photoId={variant.photoId??product.photoId} name={product.name}/><div><strong>{product.name}</strong>{label&&<small className="muted">{label}</small>}</div></div></td>
        <td>{row.category}</td>
        <td className={`align-right num${row.status==='OUT'?' text-danger':''}`}>{product.tracksStock===false?'—':stockQuantityInputText(variant.stock,product.stockUnit)}</td>
        <td>{product.stockUnit==='UNIT'?'Pcs':stockUnitEntrySymbol(product.stockUnit)}</td>
        <td className="align-right num strong">{rupees(variant.pricePaise)}</td>
        <td><StatusPill tone={tone}>{statusText}</StatusPill></td>
        <td className="align-right"><RowMenu label={`Actions for ${name}`} actions={[{label:'Edit item',icon:'edit',to:`/products?edit=${product.id}`,hidden:!can('MANAGE_PRODUCTS')},{label:'Adjust stock',icon:'layers',to:`/inventory?variant=${variant.id}`,hidden:!can('ADJUST_STOCK')||product.tracksStock===false},{label:'Print labels',icon:'tag',to:`/products/${product.id}/labels`,hidden:!can('MANAGE_PRODUCTS')},{label:'Reorder',icon:'truck',to:'/stock-alerts',hidden:!can('MANAGE_PURCHASES')||(row.status!=='LOW'&&row.status!=='OUT')}]}/></td>
      </tr>;})}</tbody>
    </table></div>
    <Pager {...pager} noun={noun}/>
  </div>;
}

function Toolbar({query,setQuery,can,products,categories}:{query:string;setQuery:(v:string)=>void;can:Can;products:Product[];categories:ShopCategory[]}){
  return <div className="toolbar"><SearchField label="Search stock" value={query} onChange={setQuery} placeholder="Search item (name / code / barcode)"/><div className="toolbar-actions">{can('MANAGE_PRODUCTS')&&<ToolbarLink to="/products/import" icon="upload">Import</ToolbarLink>}<ToolbarButton icon="download" disabled={!products.length} onClick={()=>downloadText(productsCsv(products,categories),`auxo-products-${todayStamp()}.csv`)}>Export</ToolbarButton>{can('MANAGE_PRODUCTS')&&<ToolbarLink to="/products?new=1" icon="plus" primary>Add Item</ToolbarLink>}</div></div>;
}
const matchesQuery=(row:Row,term:string)=>!term||`${row.product.name} ${row.product.brand??''} ${row.category} ${variantAttributesLabel(row.variant)} ${row.variant.sku??''} ${row.variant.barcode??''}`.toLowerCase().includes(term);

export function StockItemsPage({catalog,photos,can}:{catalog:CatalogService;photos:ProductPhotoService;can:Can}){
  const {products,categories,rows,loaded,error}=useStock(catalog),[query,setQuery]=useState('');
  const term=query.trim().toLowerCase(),visible=rows.filter(row=>matchesQuery(row,term));
  return <section className="page-section"><h1 className="sr-only">Stock items</h1>{error&&<p role="alert" className="error">{error}</p>}
    <Toolbar query={query} setQuery={setQuery} can={can} products={products} categories={categories}/>
    {!loaded?<div className="table-card"><p className="loading-note">Loading stock…</p></div>:<InventoryTable rows={visible} photos={photos} can={can} products={products} categories={categories} empty={rows.length?<EmptyState icon="search" title="No items match your search"/>:<EmptyState title="No items yet">{can('MANAGE_PRODUCTS')?'Add your first item or import a product list.':'Ask your Super Admin to add products.'}</EmptyState>}/>}
  </section>;
}

export function StockAlertsListPage({catalog,photos,can}:{catalog:CatalogService;photos:ProductPhotoService;can:Can}){
  const {products,categories,rows,loaded,error}=useStock(catalog),[query,setQuery]=useState('');
  const term=query.trim().toLowerCase(),alerts=rows.filter(row=>row.status==='LOW'||row.status==='OUT'),visible=alerts.filter(row=>matchesQuery(row,term));
  return <section className="page-section"><h1 className="sr-only">Stock alerts</h1>{error&&<p role="alert" className="error">{error}</p>}
    <div className="summary-strip"><div className="mini-stat tone-danger"><span>Out of stock</span><strong>{alerts.filter(r=>r.status==='OUT').length}</strong></div><div className="mini-stat tone-warning"><span>Low stock</span><strong>{alerts.filter(r=>r.status==='LOW').length}</strong></div><p className="muted">Items at or below their alert level. {can('MANAGE_PURCHASES')?'Use Reorder to draft supplier orders.':''}</p></div>
    <Toolbar query={query} setQuery={setQuery} can={can} products={products} categories={categories}/>
    {!loaded?<div className="table-card"><p className="loading-note">Loading stock…</p></div>:<InventoryTable rows={visible} photos={photos} can={can} products={products} categories={categories} noun="alerts" empty={<EmptyState icon="check" title={alerts.length?'No alerts match your search':'No stock alerts'}>{alerts.length?'':'Every tracked item is above its alert level.'}</EmptyState>}/>}
  </section>;
}

type BatchRow={batch:StockBatch;product:Product;variant:ProductVariant;daysLeft:number};
export function ExpiringPage({catalog,shops,photos,can}:{catalog:CatalogService;shops:ShopService;photos:ProductPhotoService;can:Can}){
  const [rows,setRows]=useState<BatchRow[]>([]),[warnDays,setWarnDays]=useState(30),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[show,setShow]=useState<'soon'|'expired'|'all'>('all');
  useEffect(()=>{let live=true;Promise.all([catalog.listProducts(),catalog.listStockBatches(),shops.load().catch(()=>null)]).then(([products,batches,shop])=>{if(!live)return;const days=shop?.expiryWarningDays??30,limit=new Date();limit.setDate(limit.getDate()+days);const max=dayKey(limit),start=new Date();start.setHours(0,0,0,0);const byVariant=new Map(products.flatMap(p=>p.variants.map(v=>[v.id,{product:p,variant:v}] as const)));setWarnDays(days);setRows(batches.filter(b=>b.quantity>0&&b.expiryDate&&b.expiryDate<=max).flatMap(batch=>{const found=byVariant.get(batch.variantId);if(!found)return [];const [y,m,d]=batch.expiryDate!.split('-').map(Number);const daysLeft=Math.round((new Date(y!,m!-1,d!).getTime()-start.getTime())/86400000);return [{batch,...found,daysLeft}];}).sort((a,b)=>a.daysLeft-b.daysLeft));}).catch(e=>live&&setError(e instanceof Error?e.message:'Could not load batches.')).finally(()=>live&&setLoaded(true));return()=>{live=false;};},[catalog,shops]);
  const term=query.trim().toLowerCase(),visible=rows.filter(r=>(show==='all'||(show==='expired'?r.daysLeft<0:r.daysLeft>=0))&&(!term||`${r.product.name} ${variantAttributesLabel(r.variant)} ${r.batch.batchNumber??''} ${r.variant.barcode??''}`.toLowerCase().includes(term)));
  const {slice,...pager}=usePages(visible,10);
  return <section className="page-section"><h1 className="sr-only">Expiring soon</h1>{error&&<p role="alert" className="error">{error}</p>}
    <div className="summary-strip"><div className="mini-stat tone-danger"><span>Expired</span><strong>{rows.filter(r=>r.daysLeft<0).length}</strong></div><div className="mini-stat tone-warning"><span>Expiring in {warnDays} days</span><strong>{rows.filter(r=>r.daysLeft>=0).length}</strong></div><p className="muted">Batches with stock left. Change the warning window in Settings.</p></div>
    <div className="toolbar"><SearchField label="Search batches" value={query} onChange={setQuery} placeholder="Search item, batch or barcode"/><div className="segmented" role="group" aria-label="Show batches">{(['all','soon','expired'] as const).map(key=><button key={key} type="button" aria-pressed={show===key} onClick={()=>setShow(key)}>{key==='all'?'All':key==='soon'?'Expiring':'Expired'}</button>)}</div>{can('ADJUST_STOCK')&&<div className="toolbar-actions"><ToolbarLink to="/inventory" icon="layers">Adjust stock</ToolbarLink></div>}</div>
    <div className="table-card">{!loaded?<p className="loading-note">Loading batches…</p>:!visible.length?<EmptyState icon="check" title={rows.length?'No batches match':'Nothing expiring soon'}>{rows.length?'':`No batch with stock expires in the next ${warnDays} days.`}</EmptyState>:<><div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Item Name</th><th scope="col">Batch</th><th scope="col">Expiry date</th><th scope="col" className="align-right">Days left</th><th scope="col" className="align-right">Quantity</th><th scope="col">Status</th></tr></thead>
      <tbody>{slice.map(r=>{const label=variantAttributesLabel(r.variant);return <tr key={r.batch.id}><td><div className="item-cell"><Thumb photos={photos} photoId={r.variant.photoId??r.product.photoId} name={r.product.name}/><div><strong>{r.product.name}</strong>{label&&<small className="muted">{label}</small>}</div></div></td><td>{r.batch.batchNumber||'—'}</td><td className="num">{new Date(r.batch.expiryDate+'T00:00:00').toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}</td><td className={`align-right num${r.daysLeft<0?' text-danger':''}`}>{r.daysLeft<0?`${-r.daysLeft} ago`:r.daysLeft===0?'Today':r.daysLeft}</td><td className="align-right num">{stockQuantityInputText(r.batch.quantity,r.product.stockUnit)} {r.product.stockUnit==='UNIT'?'pcs':stockUnitEntrySymbol(r.product.stockUnit)}</td><td><StatusPill tone={r.daysLeft<0?'danger':'warning'}>{r.daysLeft<0?'Expired':'Expiring Soon'}</StatusPill></td></tr>;})}</tbody></table></div><Pager {...pager} noun="batches"/></>}</div>
  </section>;
}
