import{j as e}from"./jsx-runtime-D_zvdyIk.js";import{P as n,M as a,S as l,a as d}from"./ConsoleUi-Br35-Uo-.js";import{B as r}from"./context-C-nZVSP7.js";import"./badge-ZdkHlOy8.js";import"./index-Br2IOmUs.js";import"./_commonjsHelpers-Cpj98o6Y.js";const v={title:"Console/UI",component:n,tags:["autodocs"]},t={render:()=>e.jsxs("div",{className:"space-y-6",children:[e.jsx(n,{eyebrow:"Dashboard",title:"Today at a glance",description:"Core ops KPIs and alerts for the active branch.",actions:e.jsx(r,{size:"sm",children:"New note"})}),e.jsxs("div",{className:"grid gap-4 md:grid-cols-3",children:[e.jsx(a,{label:"Net sales",value:"$12,450",detail:"+6% vs prior week",tone:"emerald"}),e.jsx(a,{label:"Open checks",value:"8",detail:"2 late",tone:"amber"}),e.jsx(a,{label:"Low stock",value:"3",detail:"At risk items",tone:"danger"})]}),e.jsx(l,{title:"Operational highlight",description:"Status rollup for the last 2 hours.",actions:e.jsx(r,{variant:"outline",size:"sm",children:"Review"}),children:e.jsx("div",{className:"text-sm text-muted-foreground",children:"Delivery backlog is shrinking and ticket times are within SLA."})}),e.jsx(d,{variant:"info",title:"All stations stable",description:"No blocking signals detected across floor, kitchen, and bar."})]})};var s,i,o;t.parameters={...t.parameters,docs:{...(s=t.parameters)==null?void 0:s.docs,source:{originalSource:`{
  render: () => <div className="space-y-6">\r
      <PageHeader eyebrow="Dashboard" title="Today at a glance" description="Core ops KPIs and alerts for the active branch." actions={<Button size="sm">New note</Button>} />\r
      <div className="grid gap-4 md:grid-cols-3">\r
        <MetricCard label="Net sales" value="$12,450" detail="+6% vs prior week" tone="emerald" />\r
        <MetricCard label="Open checks" value="8" detail="2 late" tone="amber" />\r
        <MetricCard label="Low stock" value="3" detail="At risk items" tone="danger" />\r
      </div>\r
      <SectionCard title="Operational highlight" description="Status rollup for the last 2 hours." actions={<Button variant="outline" size="sm">Review</Button>}>\r
        <div className="text-sm text-muted-foreground">\r
          Delivery backlog is shrinking and ticket times are within SLA.\r
        </div>\r
      </SectionCard>\r
      <StatePanel variant="info" title="All stations stable" description="No blocking signals detected across floor, kitchen, and bar." />\r
    </div>
}`,...(o=(i=t.parameters)==null?void 0:i.docs)==null?void 0:o.source}}};const b=["PageChrome"];export{t as PageChrome,b as __namedExportsOrder,v as default};
