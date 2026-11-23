export function TossArt() {
  return <svg className="toss-art" viewBox="0 0 270 273" aria-hidden="true" fill="currentColor">
    <g transform="rotate(-21 152 52)">
      <rect x="116" y="18" width="70" height="94" rx="10"/>
      <rect x="123" y="26" width="56" height="69" rx="4" fill="var(--yellow)"/>
      <rect x="143" y="101" width="16" height="3" rx="1.5" fill="var(--yellow)"/>
    </g>
    <path d="M89 148h6v-27h8l-11-17-11 17h8z"/>
    <path d="M187 105v28m0 9v12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray="6 5"/>
    <path d="m180 149 7 12 7-12z"/>
    <g transform="rotate(-10 139 205)">
      <path d="m36 206 23-5 21-24c6-7 10-15 17-23 5-5 12-1 11 5l-5 23c-1 4 2 7 7 6l64-17c9-2 12 7 5 11l-39 15 49-13c8-2 12 7 4 11l-48 17 44-10c9-2 11 6 4 10l-48 18 31-6c8-2 11 6 4 9l-46 16c-14 4-30 3-46 2l-39 8z"/>
      <path fill="var(--yellow)" d="m65 213 4-2 17 38-4 2z"/>
    </g>
  </svg>;
}
export function Ruler() {
  return <div className="ruler" aria-hidden="true">{Array.from({length:21},(_,i)=><i key={i} className={i%5===0?"long":""}/>)}</div>;
}
export function RuleIcon({type}:{type:string}) {
  return <svg viewBox="0 0 72 72" className="rule-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {type==="drop" && <><rect x="25" y="14" width="21" height="26" rx="3" transform="rotate(-26 35 27)"/><path d="M36 42v13m-6-6 6 7 6-7m-18 11h24"/></>}
    {type==="spin" && <><rect x="26" y="24" width="20" height="25" rx="3" transform="rotate(35 36 36)"/><path d="M15 31a22 22 0 0 1 37-11m0-7v8h-9M57 41a22 22 0 0 1-37 12m0 7v-8h9"/></>}
    {type==="crowds" && <><circle cx="28" cy="28" r="7"/><circle cx="47" cy="33" r="5"/><path d="M14 53v-3c0-15 28-15 28 0v4m1-13c9-2 15 2 15 12"/></>}
    {type==="uneven" && <><path d="M13 49h17l7 5 10-1 11-6M16 27h12l8 4 12-2 7-5m-20 12v12m-5-5 5 5 5-5"/></>}
    <g stroke="#b02711" strokeWidth="4.5"><circle cx="36" cy="36" r="32"/><path d="M13 14l46 45"/></g>
  </svg>;
}
