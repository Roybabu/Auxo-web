import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import type {SeriesPoint} from '../domain/dashboardStats';
import {compactRupees,rupees} from './Kit';

const HEIGHT=270,PAD={top:34,right:18,bottom:30,left:56};

/** A "nice" axis top: 1, 2, 2.5 or 5 times a power of ten. */
function niceCeil(value:number){if(value<=0)return 1;const power=10**Math.floor(Math.log10(value)),f=value/power;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*power;}
/** Monotone cubic curve through the points (no overshoot below zero between equal values). */
function smoothPath(points:[number,number][]){
  const n=points.length;if(!n)return '';if(n===1){const [x,y]=points[0]!;return `M${x},${y}`;}
  const dx:number[]=[],slope:number[]=[];for(let i=0;i<n-1;i++){dx.push(points[i+1]![0]-points[i]![0]);slope.push((points[i+1]![1]-points[i]![1])/dx[i]!);}
  const tangent:number[]=[slope[0]!];for(let i=1;i<n-1;i++){const a=slope[i-1]!,b=slope[i]!;tangent.push(a*b<=0?0:3*(dx[i-1]!+dx[i]!)/((2*dx[i]!+dx[i-1]!)/a+(dx[i]!+2*dx[i-1]!)/b));}tangent.push(slope[n-2]!);
  let d=`M${points[0]![0]},${points[0]![1]}`;
  for(let i=0;i<n-1;i++){const [x0,y0]=points[i]!,[x1,y1]=points[i+1]!,h=dx[i]!/3;d+=` C${x0+h},${y0+tangent[i]!*h} ${x1-h},${y1-tangent[i+1]!*h} ${x1},${y1}`;}
  return d;
}

export function SalesTrendChart({series}:{series:SeriesPoint[]}){
  const box=useRef<HTMLDivElement|null>(null),[width,setWidth]=useState(640),[active,setActive]=useState<number|null>(null),gradient=useId().replace(/:/g,'');
  useEffect(()=>{const el=box.current;if(!el)return;const observer=new ResizeObserver(entries=>{const w=entries[0]?.contentRect.width;if(w)setWidth(Math.max(280,Math.round(w)));});observer.observe(el);return()=>observer.disconnect();},[]);
  const chart=useMemo(()=>{
    const values=series.map(p=>Number(p.salesPaise)),max=niceCeil(Math.max(0,...values)*1.1),minRaw=Math.min(0,...values),min=minRaw<0?-niceCeil(-minRaw):0;
    const innerW=width-PAD.left-PAD.right,innerH=HEIGHT-PAD.top-PAD.bottom,step=series.length>1?innerW/(series.length-1):0;
    const x=(i:number)=>PAD.left+(series.length>1?i*step:innerW/2),y=(v:number)=>PAD.top+innerH-(v-min)/(max-min)*innerH;
    const points=values.map((v,i)=>[x(i),y(v)] as [number,number]);
    const line=smoothPath(points),base=y(Math.max(0,min)),area=points.length?`${line} L${points[points.length-1]![0]},${base} L${points[0]![0]},${base} Z`:'';
    const ticks=Array.from({length:6},(_,i)=>min+(max-min)*i/5);
    const every=Math.max(1,Math.ceil(series.length/Math.max(2,Math.floor(innerW/72))));
    const peak=values.length?values.indexOf(Math.max(...values)):-1;
    return {values,points,line,area,ticks,y,every,peak:peak>=0&&values[peak]!>0?peak:-1,step};
  },[series,width]);
  const total=chart.values.reduce((s,v)=>s+v,0);
  function pick(event:PointerEvent<SVGSVGElement>){if(!series.length)return;const rect=event.currentTarget.getBoundingClientRect(),px=(event.clientX-rect.left)*(width/rect.width);const index=chart.step?Math.round((px-PAD.left)/chart.step):0;setActive(Math.min(series.length-1,Math.max(0,index)));}
  function keys(event:KeyboardEvent<SVGSVGElement>){if(!series.length)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();setActive(current=>{const start=current??(event.key==='ArrowRight'?-1:series.length);return Math.min(series.length-1,Math.max(0,start+(event.key==='ArrowRight'?1:-1)));});}else if(event.key==='Escape')setActive(null);}
  const shown=active??chart.peak,point=shown>=0?chart.points[shown]:undefined,item=shown>=0?series[shown]:undefined;
  return <div className="trend-chart" ref={box}>
    <svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" tabIndex={0} aria-label={`Sales trend: ${series.length} periods, total ${rupees(BigInt(total))}. Use the left and right arrow keys to read each period.`} onPointerMove={pick} onPointerLeave={()=>setActive(null)} onKeyDown={keys} onBlur={()=>setActive(null)}>
      <defs><linearGradient id={`g${gradient}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7B4DFF" stopOpacity=".32"/><stop offset="100%" stopColor="#7B4DFF" stopOpacity="0"/></linearGradient></defs>
      {chart.ticks.map(tick=><g key={tick}><line x1={PAD.left} x2={width-PAD.right} y1={chart.y(tick)} y2={chart.y(tick)} className={tick===0?'grid zero':'grid'}/><text x={PAD.left-10} y={chart.y(tick)} className="axis y-axis" dominantBaseline="middle" textAnchor="end">{compactRupees(tick)}</text></g>)}
      {series.map((p,i)=>i%chart.every===0||i===series.length-1&&series.length<=8?<text key={p.start} x={chart.points[i]?.[0]} y={HEIGHT-8} className="axis" textAnchor={i===0&&series.length>1?'start':i===series.length-1&&series.length>1?'end':'middle'}>{p.label}</text>:null)}
      {chart.area&&<path d={chart.area} fill={`url(#g${gradient})`}/>}
      {chart.line&&<path d={chart.line} className="trend-line"/>}
      {point&&<><line x1={point[0]} x2={point[0]} y1={PAD.top-6} y2={HEIGHT-PAD.bottom} className="guide"/><circle cx={point[0]} cy={point[1]} r="6" className="trend-dot"/></>}
    </svg>
    {point&&item&&<div className={active===null?'chart-tip peak':'chart-tip'} style={{left:`${Math.min(Math.max(point[0]/width*100,8),92)}%`,top:Math.max(0,point[1]-58)}} role="status"><strong>{rupees(item.salesPaise)}</strong>{active!==null&&<span>{item.tooltip}</span>}</div>}
  </div>;
}
