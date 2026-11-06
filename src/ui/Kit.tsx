import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {createPortal} from 'react-dom';
import type {ProductPhotoService} from '../application/productPhotoService';
import {productPhotoUrl} from '../domain/productPhotos';
import {Icon,type IconName} from './icons';

/** Search box with a leading magnifier; optional trailing button (for example a barcode icon). */
export function SearchField({label,value,onChange,placeholder,trailing,inputProps,inputRef}:{label:string;value:string;onChange:(value:string)=>void;placeholder?:string;trailing?:ReactNode;inputProps?:React.InputHTMLAttributes<HTMLInputElement>;inputRef?:React.Ref<HTMLInputElement>}){
  return <div className="search-field"><Icon name="search" size={18}/><input type="search" aria-label={label} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} ref={inputRef} {...inputProps}/>{trailing}</div>;
}

export type Tone='success'|'warning'|'danger'|'neutral'|'info';
export function StatusPill({tone,children}:{tone:Tone;children:ReactNode}){return <span className={`status-pill tone-${tone}`}>{children}</span>;}

/** Product picture from the local photo store, or a tinted first letter. */
export function Thumb({photos,photoId,name,size=40}:{photos?:ProductPhotoService;photoId?:string|null;name:string;size?:number}){
  const [url,setUrl]=useState('');
  useEffect(()=>{let live=true,made='';setUrl('');if(!photos||!photoId)return;photos.load(photoId).then(photo=>{if(!live||!photo)return;made=productPhotoUrl(photo);setUrl(made);}).catch(()=>{});return()=>{live=false;if(made)URL.revokeObjectURL(made);};},[photos,photoId]);
  const hue=[...name].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%6;
  return <span className={`thumb hue-${hue}`} style={{width:size,height:size}} aria-hidden="true">{url?<img src={url} alt=""/>:<span>{name.trim().slice(0,1).toUpperCase()||'?'}</span>}</span>;
}

export type MenuAction={label:string;icon?:IconName;to?:string;onSelect?:()=>void;danger?:boolean;hidden?:boolean};
/**
 * Small "⋯" menu for a table row. The popover is portaled to document.body and
 * positioned against the trigger button's live viewport coordinates, so a row near
 * the bottom or edge of a scrolling table (overflow-x:auto on .table-wrap implicitly
 * clips overflow-y too) never has its menu cut off or hidden behind other content.
 */
export function RowMenu({label,actions}:{label:string;actions:MenuAction[]}){
  const [open,setOpen]=useState(false);
  const buttonRef=useRef<HTMLButtonElement|null>(null);
  const popoverRef=useRef<HTMLDivElement|null>(null);
  const [style,setStyle]=useState<{top:number;left:number;openUpward:boolean}|null>(null);

  // Position (and reposition) the portaled popover against the trigger's current rect,
  // flipping above the button and clamping horizontally when there isn't room.
  useLayoutEffect(()=>{
    if(!open)return;
    function place(){
      const button=buttonRef.current;
      if(!button)return;
      const rect=button.getBoundingClientRect();
      const popoverHeight=popoverRef.current?.offsetHeight??0;
      const popoverWidth=popoverRef.current?.offsetWidth??200;
      const margin=8;
      const openUpward=rect.bottom+popoverHeight+margin>window.innerHeight&&rect.top-popoverHeight-margin>0;
      const top=openUpward?rect.top-popoverHeight-margin:rect.bottom+margin;
      let left=rect.right-popoverWidth;
      left=Math.max(margin,Math.min(left,window.innerWidth-popoverWidth-margin));
      setStyle({top,left,openUpward});
    }
    place();
    window.addEventListener('resize',place);
    return()=>window.removeEventListener('resize',place);
  },[open]);

  useEffect(()=>{
    if(!open)return;
    const close=(event:MouseEvent)=>{
      const target=event.target as Node;
      if(buttonRef.current?.contains(target))return;
      if(popoverRef.current?.contains(target))return;
      setOpen(false);
    };
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    // Capture so a scroll inside a nested scroll container (e.g. .table-wrap) is seen too.
    const onScroll=()=>setOpen(false);
    document.addEventListener('mousedown',close);
    document.addEventListener('keydown',key);
    window.addEventListener('scroll',onScroll,true);
    return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key);window.removeEventListener('scroll',onScroll,true);};
  },[open]);

  const shown=actions.filter(action=>!action.hidden);
  if(!shown.length)return null;
  return <div className="row-menu"><button type="button" ref={buttonRef} className="icon-button small" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={()=>setOpen(v=>!v)}><Icon name="dots" size={18}/></button>
    {open&&createPortal(<div className="popover row-popover" role="menu" ref={popoverRef} style={{position:'fixed',top:style?.top??-9999,left:style?.left??-9999,right:'auto',visibility:style?'visible':'hidden'}}>{shown.map(action=>action.to?<Link key={action.label} to={action.to} role="menuitem" className={action.danger?'menu-row danger':'menu-row'} onClick={()=>setOpen(false)}>{action.icon&&<Icon name={action.icon} size={17}/>}{action.label}</Link>:<button key={action.label} type="button" role="menuitem" className={action.danger?'menu-row danger':'menu-row'} onClick={()=>{setOpen(false);action.onSelect?.();}}>{action.icon&&<Icon name={action.icon} size={17}/>}{action.label}</button>)}</div>,document.body)}</div>;
}

export type SortState<K extends string>={key:K;dir:'asc'|'desc'};
export function useSort<T,K extends string>(rows:readonly T[],initial:SortState<K>,value:(row:T,key:K)=>string|number){
  const [sort,setSort]=useState(initial);
  const sorted=useMemo(()=>{const factor=sort.dir==='asc'?1:-1;return [...rows].sort((a,b)=>{const x=value(a,sort.key),y=value(b,sort.key);return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'}))*factor;});},[rows,sort,value]);
  const toggle=(key:K)=>setSort(current=>current.key===key?{key,dir:current.dir==='asc'?'desc':'asc'}:{key,dir:'asc'});
  return {sorted,sort,toggle};
}
export function SortHeader<K extends string>({label,sortKey,sort,onSort,align}:{label:string;sortKey:K;sort:SortState<K>;onSort:(key:K)=>void;align?:'right'|'center'}){
  const active=sort.key===sortKey;
  return <th scope="col" aria-sort={active?(sort.dir==='asc'?'ascending':'descending'):'none'} className={align?`align-${align}`:undefined}><button type="button" className={active?'sort-button active':'sort-button'} onClick={()=>onSort(sortKey)}>{label}<Icon name="sort" size={14}/></button></th>;
}

export function usePages<T>(rows:readonly T[],size:number){
  const [page,setPage]=useState(1);const pages=Math.max(1,Math.ceil(rows.length/size));
  useEffect(()=>{if(page>pages)setPage(pages);},[page,pages]);
  const current=Math.min(page,pages);
  return {page:current,pages,setPage,slice:rows.slice((current-1)*size,current*size),from:rows.length?(current-1)*size+1:0,to:Math.min(current*size,rows.length),total:rows.length};
}
export function Pager({page,pages,setPage,from,to,total,noun}:{page:number;pages:number;setPage:(page:number)=>void;from:number;to:number;total:number;noun:string}){
  const numbers=useMemo(()=>{const out:(number|'…')[]=[];for(let n=1;n<=pages;n++){if(n===1||n===pages||Math.abs(n-page)<=2)out.push(n);else if(out[out.length-1]!=='…')out.push('…');}return out;},[page,pages]);
  return <div className="pager"><span className="muted">Showing {from}–{to} of {total} {noun}</span>{pages>1&&<nav className="pager-buttons" aria-label="Pages"><button type="button" className="page-button" disabled={page<=1} onClick={()=>setPage(page-1)} aria-label="Previous page"><Icon name="chevronLeft" size={16}/></button>{numbers.map((n,i)=>n==='…'?<span key={`gap-${i}`} className="page-gap">…</span>:<button key={n} type="button" className={n===page?'page-button active':'page-button'} aria-current={n===page?'page':undefined} onClick={()=>setPage(n)}>{n}</button>)}<button type="button" className="page-button" disabled={page>=pages} onClick={()=>setPage(page+1)} aria-label="Next page"><Icon name="chevronRight" size={16}/></button></nav>}</div>;
}

export function ToolbarLink({to,icon,children,primary=false}:{to:string;icon:IconName;children:ReactNode;primary?:boolean}){return <Link to={to} className={primary?'tool-button primary':'tool-button'}><Icon name={icon} size={18}/>{children}</Link>;}
export function ToolbarButton({icon,children,onClick,primary=false,disabled}:{icon:IconName;children:ReactNode;onClick:()=>void;primary?:boolean;disabled?:boolean}){return <button type="button" className={primary?'tool-button primary':'tool-button'} onClick={onClick} disabled={disabled}><Icon name={icon} size={18}/>{children}</button>;}

export function downloadText(text:string,filename:string,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob(['﻿'+text],{type})),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const todayStamp=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

const inr=new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}),inr0=new Intl.NumberFormat('en-IN',{maximumFractionDigits:0});
/** ₹ amount with Indian digit grouping, from paise. */
export function rupees(paise:bigint|string|number,{whole=false}:{whole?:boolean}={}){const value=Number(BigInt(paise))/100;const text=(whole?inr0:inr).format(Math.abs(value));return `${value<0?'−':''}₹${text}`;}
/** Short axis label: ₹1.2L, ₹45K. */
export function compactRupees(paise:number){const value=paise/100,abs=Math.abs(value),sign=value<0?'−':'';if(abs>=1e7)return `${sign}₹${+(abs/1e7).toFixed(1)}Cr`;if(abs>=1e5)return `${sign}₹${+(abs/1e5).toFixed(1)}L`;if(abs>=1e3)return `${sign}₹${+(abs/1e3).toFixed(1)}K`;return `${sign}₹${Math.round(abs)}`;}

/** Modal panel: focus moves inside, Escape or the close button closes it, the page behind is inert. */
export function Dialog({title,onClose,children,wide=false,footer}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;footer?:ReactNode}){
  const panel=useRef<HTMLDivElement|null>(null),closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const el=panel.current;const first=el?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,button:not(.dialog-close)')??el;first?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();closeRef.current();}else if(event.key==='Tab'&&el){const items=[...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(n=>n.offsetParent!==null);if(!items.length)return;const a=items[0]!,z=items[items.length-1]!;if(event.shiftKey&&document.activeElement===a){event.preventDefault();z.focus();}else if(!event.shiftKey&&document.activeElement===z){event.preventDefault();a.focus();}}};
    document.addEventListener('keydown',key);document.body.classList.add('dialog-open');return()=>{document.removeEventListener('keydown',key);document.body.classList.remove('dialog-open');previous?.focus?.({preventScroll:true});};},[]);
  return createPortal(<div className="dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><div className={wide?'dialog wide':'dialog'} role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}><div className="dialog-head"><h2>{title}</h2><button type="button" className="icon-button dialog-close" aria-label="Close" onClick={onClose}><Icon name="x" size={20}/></button></div><div className="dialog-body">{children}</div>{footer&&<div className="dialog-foot">{footer}</div>}</div></div>,document.body);
}
