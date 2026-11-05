import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,NavLink} from 'react-router-dom';
import type {DashboardInsights,DashboardService} from '../application/dashboardService';
import type {ProductPhotoService} from '../application/productPhotoService';
import type {Permission} from '../domain/access';
import {COMPARE_LABELS,RANGE_LABELS,change,type Change,type RangePreset} from '../domain/dashboardStats';
import {stockQuantityText} from '../domain/catalog';
import {Icon,type IconName} from './icons';
import {Thumb,rupees} from './Kit';
import {SalesTrendChart} from './SalesTrendChart';

const PRESETS:RangePreset[]=['TODAY','LAST_7_DAYS','THIS_WEEK','THIS_MONTH','LAST_3_MONTHS','LAST_6_MONTHS','LAST_YEAR','ALL_TIME','CUSTOM'];
const FILTER_KEY='auxo-dashboard-range';
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function greeting(hour:number){return hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening';}
function loadFilter():{preset:RangePreset;from:string;to:string}{const today=iso(new Date()),week=new Date();week.setDate(week.getDate()-6);const fallback={preset:'TODAY' as RangePreset,from:iso(week),to:today};try{const saved=JSON.parse(sessionStorage.getItem(FILTER_KEY)??'null');if(saved&&PRESETS.includes(saved.preset))return {...fallback,...saved};}catch{/* ignore */}return fallback;}

function ChangeLine({value,compare}:{value:Change;compare:string}){
  if(value.kind==='NONE')return <small className="card-change neutral">All recorded sales</small>;
  if(value.kind==='NEW')return <small className="card-change up">New activity {compare}</small>;
  if(value.kind==='SAME')return <small className="card-change neutral">No change {compare}</small>;
  return <small className={`card-change ${value.kind==='UP'?'up':'down'}`}><span aria-hidden="true">{value.kind==='UP'?'▲':'▼'}</span> {value.kind==='UP'?'+':'−'}{value.percent}% <span className="muted">{compare}</span></small>;
}

function StatCard({tone,icon,label,value,delta,compare}:{tone:'green'|'blue'|'purple'|'orange';icon:IconName;label:string;value:string;delta:Change;compare:string}){
  return <article className={`stat-card tone-${tone}`}><span className="stat-icon"><Icon name={icon} size={22}/></span><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><ChangeLine value={delta} compare={compare}/></div></article>;
}

function RangeFilter({preset,from,to,onChange}:{preset:RangePreset;from:string;to:string;onChange:(next:{preset:RangePreset;from:string;to:string})=>void}){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState({from,to}),ref=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!open)return;setDraft({from,to});const close=(event:MouseEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key);};},[open,from,to]);
  const label=preset==='CUSTOM'?`${new Date(from+'T00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${new Date(to+'T00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}`:RANGE_LABELS[preset];
  const valid=draft.from&&draft.to&&draft.from<=draft.to;
  return <div className="header-pop range-filter" ref={ref}><button type="button" className="tool-button" aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="calendar" size={17}/>{label}<Icon name="chevronDown" size={16}/></button>
    {open&&<div className="popover range-popover" role="dialog" aria-label="Choose a date range"><div className="range-options">{PRESETS.filter(p=>p!=='CUSTOM').map(p=><button key={p} type="button" className={p===preset?'menu-row selected':'menu-row'} aria-pressed={p===preset} onClick={()=>{onChange({preset:p,from,to});setOpen(false);}}>{RANGE_LABELS[p]}{p===preset&&<Icon name="check" size={16}/>}</button>)}</div>
      <form className="range-custom" onSubmit={e=>{e.preventDefault();if(!valid)return;onChange({preset:'CUSTOM',...draft});setOpen(false);}}><p className="popover-label">Custom date range</p><div className="range-dates"><label>From<input type="date" required value={draft.from} max={draft.to||undefined} onChange={e=>setDraft(d=>({...d,from:e.target.value}))}/></label><label>To<input type="date" required value={draft.to} min={draft.from||undefined} max={iso(new Date())} onChange={e=>setDraft(d=>({...d,to:e.target.value}))}/></label></div>{draft.from&&draft.to&&draft.from>draft.to&&<small className="error">The end date must be on or after the start date.</small>}<button type="submit" disabled={!valid}>Apply range</button></form></div>}</div>;
}

export function DashboardPage({service,photos,userName,can}:{service:DashboardService;photos:ProductPhotoService;userName:string;can:(permission:Permission)=>boolean}){
  const [filter,setFilter]=useState(loadFilter),[data,setData]=useState<DashboardInsights|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{setLoading(true);try{setData(await service.insights(filter.preset,filter.preset==='CUSTOM'?{from:filter.from,to:filter.to}:undefined));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load the dashboard.');}finally{setLoading(false);}},[service,filter]);
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),60_000);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[refresh]);
  function choose(next:typeof filter){setFilter(next);try{sessionStorage.setItem(FILTER_KEY,JSON.stringify(next));}catch{/* ignore */}}
  const compare=COMPARE_LABELS[filter.preset],cur=data?.current,prev=data?.previous??null;
  const first=userName.trim().split(/\s+/)[0]||userName;
  const actions:[string,string,IconName,string,boolean][]=[['/pos','New Sale','cart','purple',can('SELL')],['/inventory','Add Stock','box','green',can('VIEW_STOCK_RECORDS')],['/customers?new=1','Add Customer','people','blue',can('MANAGE_CUSTOMERS')],['/reports','Reports','chart','orange',can('VIEW_REPORTS')]];
  return <section className="page-section dashboard">
    <div className="dash-head"><div><h1>{greeting(new Date().getHours())}, {first} <span aria-hidden="true">👋</span></h1><p className="muted">Here’s what’s happening at your store {filter.preset==='TODAY'?'today':'in this period'}.</p></div><RangeFilter {...filter} onChange={choose}/></div>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className={loading&&!data?'stat-grid is-loading':'stat-grid'} aria-busy={loading}>
      <StatCard tone="green" icon="cart" label="Sales" value={cur?rupees(cur.salesPaise):'—'} delta={cur?change(cur.salesPaise,prev?.salesPaise??null):{kind:'NONE',percent:0}} compare={compare}/>
      <StatCard tone="blue" icon="receipt" label="Bills" value={cur?String(cur.bills):'—'} delta={cur?change(cur.bills,prev?.bills??null):{kind:'NONE',percent:0}} compare={compare}/>
      <StatCard tone="purple" icon="bag" label="Items Sold" value={cur?cur.items.toLocaleString('en-IN'):'—'} delta={cur?change(cur.items,prev?.items??null):{kind:'NONE',percent:0}} compare={compare}/>
      <StatCard tone="orange" icon="userPlus" label="New Customers" value={cur?String(cur.newCustomers):'—'} delta={cur?change(cur.newCustomers,prev?.newCustomers??null):{kind:'NONE',percent:0}} compare={compare}/>
    </div>
    <div className="dash-panels">
      <div className="panel trend-panel"><div className="panel-head"><h2>Sales Trend</h2><span className="muted small">{data?`${RANGE_LABELS[filter.preset]} · net of returns`:''}</span></div>{data?<SalesTrendChart series={data.series}/>:<div className="chart-skeleton"/>}</div>
      <div className="panel top-panel"><div className="panel-head"><h2>Top Selling Items</h2></div>
        {!data?<div className="list-skeleton"/>:data.top.length===0?<div className="empty-state compact"><span className="empty-icon"><Icon name="bag" size={22}/></span><strong>No sales in this period</strong><span className="muted">Best sellers appear once bills are saved.</span></div>:<ol className="top-list">{data.top.map(item=><li key={item.key}><Thumb photos={photos} photoId={item.photoId} name={item.name} size={40}/><span className="top-name"><strong>{item.name}</strong>{item.label&&<small className="muted">{item.label}</small>}</span><span className="top-qty">{item.stockUnit==='UNIT'?item.quantity.toLocaleString('en-IN'):stockQuantityText(item.quantity,item.stockUnit)}</span></li>)}</ol>}
      </div>
    </div>
    <div className="quick-actions">{actions.filter(a=>a[4]).map(([to,label,icon,tone])=><Link key={label} to={to} className={`quick-action tone-${tone}`}><span className="qa-icon"><Icon name={icon} size={24}/></span><span>{label}</span></Link>)}</div>
  </section>;
}

export function EmployeeOverview({name}:{name:string}){return <section className="page-section dashboard"><div className="dash-head"><div><h1>{greeting(new Date().getHours())}, {name.trim().split(/\s+/)[0]} <span aria-hidden="true">👋</span></h1><p className="muted">Open a task to continue.</p></div></div><div className="quick-actions"><NavLink to="/pos" className="quick-action tone-purple"><span className="qa-icon"><Icon name="cart" size={24}/></span><span>New Sale</span></NavLink><NavLink to="/pos?held=1" className="quick-action tone-blue"><span className="qa-icon"><Icon name="pause" size={24}/></span><span>Held bills</span></NavLink><NavLink to="/more" className="quick-action tone-orange"><span className="qa-icon"><Icon name="more" size={24}/></span><span>More</span></NavLink></div></section>;}
