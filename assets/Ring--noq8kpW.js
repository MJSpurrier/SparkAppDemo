import{c as l,j as e}from"./index-BTKVPt_s.js";/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6h4",key:"135r8i"}]],m=l("clock-3",h);function x({size:t,stroke:s,value:r,children:o,label:i}){const a=(t-s)/2,c=2*Math.PI*a,n=Math.min(1,Math.max(0,r));return e.jsxs("div",{className:"relative shrink-0",style:{width:t,height:t},role:"img","aria-label":i,children:[e.jsxs("svg",{width:t,height:t,className:"-rotate-90",children:[e.jsx("circle",{cx:t/2,cy:t/2,r:a,fill:"none",strokeWidth:s,className:"stroke-border"}),e.jsx("circle",{cx:t/2,cy:t/2,r:a,fill:"none",strokeWidth:s,strokeLinecap:"butt",strokeDasharray:c,strokeDashoffset:c*(1-n),className:"stroke-blue transition-[stroke-dashoffset] duration-500 ease-linear"})]}),e.jsx("div",{className:"absolute inset-0 grid place-items-center",children:o})]})}export{m as C,x as R};
