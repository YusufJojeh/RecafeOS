import{j as e}from"./jsx-runtime-D_zvdyIk.js";import{S as b,M as i,a as y}from"./ConsoleUi-Br35-Uo-.js";import{B as l,u as v}from"./context-C-nZVSP7.js";import{L as s}from"./chunk-UVKPFVEO-fwz3MDOM.js";import{C as k,B as C}from"./badge-ZdkHlOy8.js";import"./index-Br2IOmUs.js";import"./_commonjsHelpers-Cpj98o6Y.js";function h({report:n}){const t=n.shifts.filter(r=>!r.closedAt);return e.jsxs(b,{title:"Close of day",description:"Reconciliation snapshot for the selected calendar day. Compare against drawer totals and shift notes before sign-off.",actions:e.jsxs(e.Fragment,{children:[e.jsx(l,{asChild:!0,variant:"outline",size:"sm",children:e.jsx(s,{to:"/stock",children:"Stock"})}),e.jsx(l,{asChild:!0,variant:"outline",size:"sm",children:e.jsx(s,{to:"/setup",children:"Setup"})}),e.jsx(l,{asChild:!0,variant:"outline",size:"sm",children:e.jsx(s,{to:"/orders",children:"Open bills"})})]}),children:[e.jsxs("div",{className:"mb-5 grid gap-3 sm:grid-cols-3",children:[e.jsx(i,{label:"Net sales",value:(n.totalSalesMinor/100).toFixed(2)}),e.jsx(i,{label:"Paid orders",value:n.orderCount}),e.jsx(i,{label:"Open shifts",value:t.length})]}),t.length>0?e.jsx(y,{compact:!0,variant:"info",title:`${t.length} shift${t.length===1?"":"s"} still open`,description:"Close them in your shift workflow before finalizing."}):null,n.flags.length>0?e.jsxs("div",{className:"mt-5",children:[e.jsx("h3",{className:"mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground",children:"Flags"}),e.jsx("ul",{className:"space-y-2",children:n.flags.map(r=>e.jsxs("li",{className:`rounded-xl border px-4 py-3 text-sm ${r.severity==="risk"?"border-red-500/40 bg-red-500/10 text-red-100":r.severity==="warn"?"border-amber-500/40 bg-amber-500/10 text-amber-100":"border-border/60 bg-muted/30 text-foreground"}`,children:[e.jsx("span",{className:"font-mono text-xs text-muted-foreground",children:r.code}),e.jsx("div",{className:"mt-1",children:r.message})]},r.code))})]}):e.jsx("p",{className:"text-sm text-muted-foreground",children:"No automated flags for this day."})]})}h.__docgenInfo={description:"",methods:[],displayName:"CloseOfDayPanel",props:{report:{required:!0,tsType:{name:"signature",type:"object",raw:`{
  totalSalesMinor: number
  orderCount: number
  shifts: Array<{
    id: string
    openedAt: string
    closedAt: string | null
    orderCount: number
    salesMinor: number
  }>
  flags: ReportFlag[]
}`,signature:{properties:[{key:"totalSalesMinor",value:{name:"number",required:!0}},{key:"orderCount",value:{name:"number",required:!0}},{key:"shifts",value:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string
  openedAt: string
  closedAt: string | null
  orderCount: number
  salesMinor: number
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"openedAt",value:{name:"string",required:!0}},{key:"closedAt",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"orderCount",value:{name:"number",required:!0}},{key:"salesMinor",value:{name:"number",required:!0}}]}}],raw:`Array<{
  id: string
  openedAt: string
  closedAt: string | null
  orderCount: number
  salesMinor: number
}>`,required:!0}},{key:"flags",value:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  code: string
  severity: "info" | "warn" | "risk"
  message: string
}`,signature:{properties:[{key:"code",value:{name:"string",required:!0}},{key:"severity",value:{name:"union",raw:'"info" | "warn" | "risk"',elements:[{name:"literal",value:'"info"'},{name:"literal",value:'"warn"'},{name:"literal",value:'"risk"'}],required:!0}},{key:"message",value:{name:"string",required:!0}}]}}],raw:"ReportFlag[]",required:!0}}]}},description:""}}};function x({data:n}){const{t}=v();if(!n)return null;const r=[];return!n.readyForGoLive&&n.blockingIncompleteCount>0&&r.push({key:"setup",node:e.jsxs(e.Fragment,{children:[t.floor.signals.setupIncomplete.replace("{count}",String(n.blockingIncompleteCount))," ",e.jsx(s,{className:"text-primary underline",to:"/setup",children:t.floor.signals.openSetup})]})}),n.lowStockCount>0&&r.push({key:"stock",node:e.jsxs(e.Fragment,{children:[t.floor.signals.lowStock.replace("{count}",String(n.lowStockCount))," ",e.jsx(s,{className:"text-primary underline",to:"/stock",children:t.floor.signals.reviewStock})]})}),n.openShiftPresent&&r.push({key:"shift",node:e.jsxs(e.Fragment,{children:[t.floor.signals.shiftOpen," ",e.jsx(s,{className:"text-primary underline",to:"/reports",children:t.floor.signals.reviewReports}),"."]})}),r.length===0?null:e.jsxs(k,{className:"mb-6 border-border/60 bg-card/70 p-4",role:"status",children:[e.jsxs("div",{className:"mb-3 flex flex-wrap items-center justify-between gap-2",children:[e.jsx("div",{className:"text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground",children:t.floor.signals.title}),e.jsx(C,{variant:"outline",className:"border-border/60 text-xs",children:t.floor.signals.active.replace("{count}",String(r.length))})]}),e.jsx("div",{className:"grid gap-2 md:grid-cols-3",children:r.map(d=>e.jsx("div",{className:"rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground",children:d.node},d.key))})]})}x.__docgenInfo={description:"",methods:[],displayName:"OperationalStrip",props:{data:{required:!0,tsType:{name:"union",raw:"OpsSnapshot | undefined",elements:[{name:"signature",type:"object",raw:`{
  readyForGoLive: boolean
  blockingIncompleteCount: number
  lowStockCount: number
  openShiftPresent: boolean
}`,signature:{properties:[{key:"readyForGoLive",value:{name:"boolean",required:!0}},{key:"blockingIncompleteCount",value:{name:"number",required:!0}},{key:"lowStockCount",value:{name:"number",required:!0}},{key:"openShiftPresent",value:{name:"boolean",required:!0}}]}},{name:"undefined"}]},description:""}}};const F={title:"Console/Panels"},o={render:()=>e.jsx(x,{data:{readyForGoLive:!1,blockingIncompleteCount:2,lowStockCount:4,openShiftPresent:!0}})},a={render:()=>e.jsx(h,{report:{totalSalesMinor:245e3,orderCount:120,shifts:[{id:"s1",openedAt:"2026-03-28T08:00:00Z",closedAt:null,orderCount:52,salesMinor:125e3}],flags:[{code:"DISC_HIGH",severity:"warn",message:"Discount share exceeded target threshold."},{code:"CASH_OUT",severity:"risk",message:"Cash drawer variance detected."}]}})};var u,c,m;o.parameters={...o.parameters,docs:{...(u=o.parameters)==null?void 0:u.docs,source:{originalSource:`{
  render: () => <OperationalStrip data={{
    readyForGoLive: false,
    blockingIncompleteCount: 2,
    lowStockCount: 4,
    openShiftPresent: true
  }} />
}`,...(m=(c=o.parameters)==null?void 0:c.docs)==null?void 0:m.source}}};var p,g,f;a.parameters={...a.parameters,docs:{...(p=a.parameters)==null?void 0:p.docs,source:{originalSource:`{
  render: () => <CloseOfDayPanel report={{
    totalSalesMinor: 245000,
    orderCount: 120,
    shifts: [{
      id: "s1",
      openedAt: "2026-03-28T08:00:00Z",
      closedAt: null,
      orderCount: 52,
      salesMinor: 125000
    }],
    flags: [{
      code: "DISC_HIGH",
      severity: "warn",
      message: "Discount share exceeded target threshold."
    }, {
      code: "CASH_OUT",
      severity: "risk",
      message: "Cash drawer variance detected."
    }]
  }} />
}`,...(f=(g=a.parameters)==null?void 0:g.docs)==null?void 0:f.source}}};const I=["OperationalSignals","CloseOfDay"];export{a as CloseOfDay,o as OperationalSignals,I as __namedExportsOrder,F as default};
