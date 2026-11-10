import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {NavLink,useLocation,useNavigate} from 'react-router-dom';
import type {AuthService} from '../application/authService';
import type {ShopService} from '../application/shopService';
import type {AppNotification,NotificationService} from '../application/notificationService';
import type {Permission} from '../domain/access';
import {Icon,type IconName} from './icons';

type Section={key:string;label:string;icon:IconName;to:string;match:string[]};

/** Which sidebar section a page belongs to. */
const SECTIONS:Omit<Section,'to'>[]=[
  {key:'dashboard',label:'Dashboard',icon:'dashboard',match:['/']},
  {key:'billing',label:'Billing',icon:'billing',match:['/pos','/restaurant']},
  {key:'stock',label:'Stock',icon:'stock',match:['/stock','/stock-alerts','/products','/inventory','/stock-count','/categories']},
  {key:'people',label:'People',icon:'people',match:['/customers','/suppliers','/employees','/loyalty','/people']},
  {key:'reports',label:'Reports',icon:'reports',match:['/reports','/gst','/closing','/activity']},
  {key:'more',label:'More',icon:'more',match:['/more','/settings','/backups','/quick-unlock','/recovery','/purchases']}
];

const TITLES:[string,string][]=[['/pos','New Sale'],['/stock','Stock overview'],['/stock-alerts','Stock alerts'],['/products','Products'],['/inventory','Stock adjustments'],['/stock-count','Stock count'],['/categories','Product categories'],['/customers','People'],['/suppliers','People'],['/employees','People'],['/loyalty','Customer loyalty'],['/reports','Reports'],['/gst','Reports'],['/closing','Reports'],['/activity','Reports'],['/more','More'],['/settings','Settings'],['/backups','Backups'],['/quick-unlock','Quick unlock'],['/recovery','Recovery code'],['/purchases','Purchases']];

const matches=(pathname:string,base:string)=>base==='/'?pathname==='/':pathname===base||pathname.startsWith(base+'/');
export function pageTitle(pathname:string){if(pathname==='/')return 'Dashboard';return TITLES.find(([base])=>matches(pathname,base))?.[1]??'AUXO';}

/** First page in a list the person is allowed to open. */
function firstAllowed(auth:AuthService,pages:[string,Permission|null][]){return pages.find(([,permission])=>permission===null||auth.can(permission))?.[0]??null;}
export function sectionLinks(auth:AuthService):Section[]{
  const to:Record<string,string|null>={
    dashboard:'/',
    billing:auth.can('SELL')?'/pos':null,
    stock:firstAllowed(auth,[['/stock','VIEW_STOCK_RECORDS'],['/products','MANAGE_PRODUCTS'],['/stock-count','ADJUST_STOCK']]),
    people:firstAllowed(auth,[['/customers','MANAGE_CUSTOMERS'],['/suppliers','MANAGE_SUPPLIERS'],['/employees','MANAGE_USERS'],['/loyalty','MANAGE_LOYALTY']]),
    reports:firstAllowed(auth,[['/reports','VIEW_REPORTS'],['/gst','GST_REPORT'],['/closing','CLOSE_DAY'],['/activity','VIEW_ACTIVITY_LOG']]),
    more:'/more'
  };
  return SECTIONS.flatMap(section=>{const link=to[section.key];return link?[{...section,to:link}]:[];});
}

function useOnline(){const [online,setOnline]=useState(typeof navigator==='undefined'?true:navigator.onLine);useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};},[]);return online;}

export function Sidebar({auth}:{auth:AuthService}){
  const {pathname}=useLocation(),online=useOnline();
  const links=sectionLinks(auth);
  const active=SECTIONS.find(section=>section.match.some(base=>matches(pathname,base)))?.key;
  return <nav className="sidebar" aria-label="Main navigation">
    <NavLink to="/" className="sidebar-brand" aria-label="AUXO POS home"><svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true"><defs><linearGradient id="auxo-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7BD8E0"/><stop offset="1" stopColor="#19B5C2"/></linearGradient></defs><path d="M17 1 1 29h8l8-14.5L25 29h8L17 1z" fill="url(#auxo-mark)"/><path d="M13 23h8" stroke="#0F2A2E" strokeWidth="3" strokeLinecap="round"/></svg><span><strong>AUXO</strong> POS</span></NavLink>
    <ul className="sidebar-links">{links.map(link=>{
      return <li key={link.key}><NavLink to={link.to} end className={()=>link.key===active?'sidebar-link active':'sidebar-link'} aria-current={link.key===active?'page':undefined}><Icon name={link.icon} size={20}/><span>{link.label}</span></NavLink></li>;
    })}</ul>
    <div className="sidebar-spacer"/>
    <div className={online?'offline-badge':'offline-badge is-offline'} role="status" title={online?'Everything is saved on this device, so billing keeps working without internet.':'No internet right now. AUXO keeps working and saves everything on this device.'}><span className="dot" aria-hidden="true"/>{online?'Offline ready':'Offline mode'}</div>
  </nav>;
}

function usePopover(){const [open,setOpen]=useState(false),ref=useRef<HTMLDivElement|null>(null);useEffect(()=>{if(!open)return;const close=(event:MouseEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key);};},[open]);return {open,setOpen,ref};}

function StoreSelector({shops,canEdit}:{shops:ShopService;canEdit:boolean}){
  const [name,setName]=useState(''),{open,setOpen,ref}=usePopover(),{pathname}=useLocation();
  useEffect(()=>{let live=true;shops.load().then(shop=>{if(live)setName(shop?.storeName||'');}).catch(()=>{});return()=>{live=false;};},[shops,pathname]);
  const label=name||'Main Store';
  return <div className="header-pop" ref={ref}><button type="button" className="store-select" aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="store" size={16}/><span>{label}</span><Icon name="chevronDown" size={16}/></button>
    {open&&<div className="popover store-popover" role="menu"><p className="popover-label">Store on this device</p><div className="store-option" role="menuitemradio" aria-checked="true"><Icon name="store" size={18}/><span>{label}</span><Icon name="check" size={18}/></div><p className="muted small">AUXO keeps one store per device. Each store's data stays on its own device.</p>{canEdit&&<NavLink to="/settings" className="popover-link" onClick={()=>setOpen(false)}>Store details</NavLink>}</div>}</div>;
}

const SEEN_KEY='auxo-seen-notifications';
function readSeen(userId:string){try{return new Set<string>(JSON.parse(localStorage.getItem(`${SEEN_KEY}-${userId}`)??'[]'));}catch{return new Set<string>();}}
function writeSeen(userId:string,ids:string[]){try{localStorage.setItem(`${SEEN_KEY}-${userId}`,JSON.stringify(ids.slice(-500)));}catch{/* storage full or blocked */}}

function Notifications({service,userId}:{service:NotificationService;userId:string}){
  const [items,setItems]=useState<AppNotification[]>([]),[seen,setSeen]=useState(()=>readSeen(userId)),{open,setOpen,ref}=usePopover(),{pathname}=useLocation(),navigate=useNavigate();
  useEffect(()=>{let live=true;const load=()=>{service.load().then(rows=>{if(live)setItems(rows);}).catch(()=>{});};load();const timer=window.setInterval(load,60_000);window.addEventListener('focus',load);return()=>{live=false;window.clearInterval(timer);window.removeEventListener('focus',load);};},[service,pathname]);
  const unread=items.filter(item=>!seen.has(item.id)).length;
  function toggle(){setOpen(value=>{const next=!value;if(next&&items.length){const ids=[...new Set([...seen,...items.map(item=>item.id)])];writeSeen(userId,ids);setTimeout(()=>setSeen(new Set(ids)),1500);}return next;});}
  return <div className="header-pop" ref={ref}><button type="button" className="icon-button bell" aria-haspopup="true" aria-expanded={open} aria-label={unread?`Notifications, ${unread} unread`:'Notifications'} onClick={toggle}><Icon name="bell" size={20}/>{unread>0&&<span className="badge-count" aria-hidden="true">{unread>99?'99+':unread}</span>}</button>
    {open&&<div className="popover notify-popover" role="menu"><div className="popover-head"><strong>Notifications</strong><span className="muted small">{items.length?`${items.length} need attention`:'All clear'}</span></div>
      {items.length===0?<p className="empty-note">Nothing needs your attention right now.</p>:<ul className="notify-list">{items.slice(0,40).map(item=><li key={item.id}><button type="button" role="menuitem" className={`notify-item tone-${item.tone}${seen.has(item.id)?'':' unread'}`} onClick={()=>{setOpen(false);navigate(item.href);}}><span className="notify-icon"><Icon name={item.tone==='info'?'clock':'alert'} size={16}/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button></li>)}</ul>}
      {items.length>40&&<p className="muted small">Showing the first 40.</p>}</div>}</div>;
}

function UserMenu({auth,user}:{auth:AuthService;user:{name:string;role:string}}){
  const {open,setOpen,ref}=usePopover(),admin=user.role==='SUPER_ADMIN';
  return <div className="header-pop" ref={ref}><button type="button" className="avatar-button" aria-haspopup="true" aria-expanded={open} aria-label={`Account menu for ${user.name}`} onClick={()=>setOpen(v=>!v)}><span className="avatar" aria-hidden="true">{user.name.slice(0,1).toUpperCase()}</span></button>
    {open&&<div className="popover user-popover" role="menu"><div className="user-popover-head"><span className="avatar large" aria-hidden="true">{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><span className="role-pill">{admin?'Super Admin':'Employee'}</span></div></div><p className="muted small">{admin?'Full access to every area.':'Access limited to the areas your Super Admin allowed.'}</p>
      <div className="popover-actions"><button type="button" role="menuitem" className="menu-row" onClick={()=>{setOpen(false);auth.lock();}}><Icon name="lock" size={18}/>Lock screen</button><button type="button" role="menuitem" className="menu-row danger" onClick={()=>{setOpen(false);void auth.signOut().catch(error=>window.alert(error instanceof Error?error.message:'Could not record sign out.'));}}><Icon name="logout" size={18}/>Sign out</button></div></div>}</div>;
}

export function Header({auth,shops,notifications,user}:{auth:AuthService;shops:ShopService;notifications:NotificationService;user:{id:string;name:string;role:string}}){
  const {pathname}=useLocation();
  return <header className="app-header"><p className="page-title">{pageTitle(pathname)}</p><div className="header-tools"><StoreSelector shops={shops} canEdit={auth.can('MANAGE_SETTINGS')}/><Notifications service={notifications} userId={user.id}/><UserMenu auth={auth} user={user}/></div></header>;
}

export type TabLink={to:string;label:string;count?:number;end?:boolean};
/** Underlined tabs at the top of a page; the active tab follows the address. */
export function PageTabs({tabs,label}:{tabs:TabLink[];label:string}){
  const {pathname}=useLocation();
  const visible=useMemo(()=>tabs,[tabs]);
  if(visible.length<2)return null;
  return <nav className="page-tabs" aria-label={label}>{visible.map(tab=>{const active=tab.end?pathname===tab.to:matches(pathname,tab.to);return <NavLink key={tab.to} to={tab.to} end={tab.end} className={()=>active?'page-tab active':'page-tab'} aria-current={active?'page':undefined}>{tab.label}{tab.count!==undefined&&tab.count>0&&<span className="tab-count">{tab.count}</span>}</NavLink>;})}</nav>;
}

export function EmptyState({icon='box',title,children}:{icon?:IconName;title:string;children?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26}/></span><strong>{title}</strong>{children&&<div className="muted">{children}</div>}</div>;}
