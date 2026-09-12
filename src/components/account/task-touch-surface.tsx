"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, CalendarDays } from "lucide-react";

/** Dikey kaydırma tarayıcıya aittir; yalnız kararlı yatay hareket işlem yapar. */
export function TaskTouchSurface({children,disabled,onHold,onRight,onLeft,rightLabel="Arşivle",leftLabel="Tarih / Ertele",rightIcon=<Archive size={18}/>,leftIcon=<CalendarDays size={18}/>}: {
  children:ReactNode;disabled?:boolean;onHold:()=>void;onRight:()=>void;onLeft:()=>void;rightLabel?:string;leftLabel?:string;rightIcon?:ReactNode;leftIcon?:ReactNode;
}) {
  const [offset,setOffset]=useState(0);
  const ref=useRef<HTMLDivElement>(null);
  const gesture=useRef<{id:number;x:number;y:number;horizontal:boolean;held:boolean;delta:number}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const suppressUntil=useRef(0);
  function stopTimer(){if(timer.current)clearTimeout(timer.current);timer.current=null;}
  function reset(){stopTimer();gesture.current=null;setOffset(0);}
  useEffect(()=>{const cancel=()=>{if(timer.current)clearTimeout(timer.current);gesture.current=null;setOffset(0);};window.addEventListener("resize",cancel);window.addEventListener("scroll",cancel,true);return()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener("resize",cancel);window.removeEventListener("scroll",cancel,true);};},[]);
  return <div ref={ref} className="tw-touch-surface"
    onContextMenu={e=>{if(!disabled && !(e.target as HTMLElement).closest("a,input,textarea,select")){e.preventDefault();onHold();}}}
    onClickCapture={e=>{if(Date.now()<suppressUntil.current){e.preventDefault();e.stopPropagation();}}}
    onPointerDown={e=>{
      if(!e.isPrimary){reset();return;}
      if(disabled||e.pointerType==="mouse"||e.clientX<24||e.clientX>window.innerWidth-24)return;
      const control=(e.target as HTMLElement).closest("button,a,input,textarea,select,[contenteditable=true]");
      if(control&&!control.classList.contains("tw-task-body")&&!control.classList.contains("tw-inbox-item"))return;
      gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,horizontal:false,held:false,delta:0};
      timer.current=setTimeout(()=>{if(gesture.current){gesture.current.held=true;suppressUntil.current=Date.now()+1000;onHold();}},450);
    }}
    onPointerMove={e=>{
      const g=gesture.current;if(!g||g.id!==e.pointerId||g.held)return;
      const x=e.clientX-g.x,y=e.clientY-g.y;
      if(Math.abs(x)<10&&Math.abs(y)<10)return;
      stopTimer();
      if(!g.horizontal){if(Math.abs(y)>=Math.abs(x)){reset();return;}if(Math.abs(x)<Math.abs(y)*1.4)return;g.horizontal=true;}
      g.delta=x;setOffset(Math.max(-130,Math.min(130,x)));
    }}
    onPointerCancel={()=>reset()}
    onPointerUp={e=>{
      const g=gesture.current;if(!g||g.id!==e.pointerId)return;
      const threshold=Math.max(72,Math.min(120,(ref.current?.clientWidth??300)*.3));
      if(g.horizontal||g.held)suppressUntil.current=Date.now()+700;
      reset();
      if(!g.held&&g.horizontal&&Math.abs(g.delta)>=threshold){if(g.delta>0)onRight();else onLeft();}
    }}>
    {offset!==0&&<div className={`tw-swipe-hint ${offset>0?"right":"left"}`} aria-hidden>{offset>0?<>{rightIcon}{rightLabel}</>:<>{leftIcon}{leftLabel}</>}</div>}
    <div className="tw-touch-content" style={{transform:offset?`translateX(${offset}px)`:undefined}}>{children}</div>
  </div>;
}
