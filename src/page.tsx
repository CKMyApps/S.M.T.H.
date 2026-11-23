"use client";
import { useState, useEffect, useRef } from "react";
import { FlightMeter, heightMetres } from "./flight.mjs";
import { Ruler, RuleIcon, TossArt } from "./art";
import { online, scores } from "./scores";

type Screen = "home"|"rules"|"disclaimer"|"check"|"motion"|"issue"|"result"|"boards"|"list"|"settings"|"post";
type Period = "today"|"week"|"world"|"mine";
type Score = {attempt:string; airtime:number; posted?:boolean};
type Entry = {nickname:string; airtime:number; mine?:number};
const labels = {today:"Today Top 10",week:"Week Top 10",world:"World Top 10",mine:"My Top 10"};
const prefix = "ckmyapps.airtime.v1.";
function read<T,>(key:string, fallback:T):T {
  try { return JSON.parse(localStorage.getItem(prefix+key) ?? "null") ?? fallback; } catch { return fallback; }
}
function save(key:string,value:unknown) {
  try { localStorage.setItem(prefix+key,JSON.stringify(value)); } catch { /* In-memory state still works. */ }
}
function metres(airtime:number) { return heightMetres(airtime).toFixed(2); }
function MenuButton({label,onClick,primary=false,disabled=false}:{label:string;onClick:()=>void;primary?:boolean;disabled?:boolean}) {
  return <button disabled={disabled} className={primary?"action primary":"action"} onClick={onClick}>{label}</button>;
}
function stopReason() { return "Motion data stopped. Keep the game open in your phone’s browser."; }

export default function Game() {
  const [screen,setScreen] = useState<Screen>("home");
  const [history,setHistory] = useState<Score[]>([]);
  const [sound,setSound] = useState(true);
  const [stage,setStage] = useState("Hold still");
  const [issue,setIssue] = useState("");
  const [result,setResult] = useState<Score|null>(null);
  const [boardsBackTo,setBoardsBackTo] = useState<"home"|"check"|"result">("home");
  const [settingsBackTo,setSettingsBackTo] = useState<"home"|"check">("home");
  const [period,setPeriod] = useState<Period>("world");
  const [entries,setEntries] = useState<Entry[]>([]);
  const [loadState,setLoadState] = useState("loading");
  const [name,setName] = useState("");
  const [note,setNote] = useState("");
  const [busy,setBusy] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const run = useRef(0);
  const agreed = useRef(false);
  const cleanup = useRef<()=>void>(()=>{});
  const audio = useRef<AudioContext|null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(()=>{
    const old = read<Score[]>("scores",[]);
    setHistory(Array.isArray(old) ? old.filter(x=>x && Number.isFinite(x.airtime)) : []);
    setName(read("nickname",""));
    setSound(read("sound",true));
    return ()=>{run.current++;cleanup.current();};
  },[]);
  useEffect(()=>{
    if(first.current) { first.current=false; return; }
    heading.current?.focus({preventScroll:true});
  },[screen]);
  useEffect(()=>{
    if(screen!=="list" || period==="mine") return;
    const abort = new AbortController();
    const timer = setTimeout(()=>abort.abort(),10000);
    let active=true;
    setLoadState("loading");
    scores("?period="+period,{signal:abort.signal,cache:"no-store"})
      .then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{entries:Entry[]}>;})
      .then(data=>{if(active){setEntries(data.entries);setLoadState("done");}})
      .catch(()=>{if(active)setLoadState("error");});
    return ()=>{active=false;clearTimeout(timer);abort.abort();};
  },[screen,period,refresh]);

  function go(s:Screen) {
    if(s==="check" && !agreed.current)s="disclaimer";
    if(s==="home" || s==="disclaimer")agreed.current=false;
    run.current++;
    cleanup.current();
    cleanup.current=()=>{};
    setNote("");
    setScreen(s);
  }
  function tone(frequency:number) {
    const ctx=audio.current;
    if(!sound || ctx?.state!=="running")return;
    const osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.frequency.value=frequency;
    gain.gain.setValueAtTime(.045,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.13);
  }
  function requestGame() { go("disclaimer"); }
  function accept() {
    if(screen!=="disclaimer")return;
    agreed.current=true;
    go("check");
  }
  async function start() {
    // Require explicit agreement for the current session, never saved to storage.
    if(!agreed.current || !["check","issue","result"].includes(screen)){requestGame();return;}
    go("motion");
    setStage("Hold still");
    const id=run.current;
    function fail(msg:string) { if(id===run.current){setIssue(msg);go("issue");} }
    if(!window.isSecureContext){fail("Open the game over HTTPS to enable motion sensing.");return;}
    if(typeof DeviceMotionEvent==="undefined"){fail("Open this page directly in Safari on iPhone or Chrome on an Android phone with a motion sensor.");return;}
    try {
      const Device = DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<string>};
      const permission = Device.requestPermission?.();
      if(sound) {
        try { audio.current ??= new AudioContext(); void audio.current.resume().catch(()=>{}); } catch { /* Audio is optional. */ }
      }
      if(permission && await permission!=="granted"){fail("Motion access was denied. Allow motion for this site in your browser, then try again.");return;}
      if(id!==run.current)return;
      const meter = new FlightMeter();
      let lastSample=performance.now(), gotSample=false;
      const armedAt=lastSample;
      function onMove(ev:DeviceMotionEvent) {
        if(id!==run.current)return;
        const a=ev.accelerationIncludingGravity;
        if(!a || ![a.x,a.y,a.z].every(Number.isFinite))return;
        gotSample=true;lastSample=performance.now();
        const step=meter.add(ev.timeStamp,a,ev.rotationRate);
        if(!step)return;
        if(step.state==="ready"){setStage("Ready");tone(560);}
        if(step.state==="flying")setStage("In flight");
        if(step.state==="invalid" && "message" in step)fail(step.message ?? "Unclear motion signal.");
        if(step.state==="result" && "airtime" in step && typeof step.airtime==="number") {
          const score={attempt:crypto.randomUUID(),airtime:step.airtime};
          const next=[...history,score].sort((a,b)=>b.airtime-a.airtime).slice(0,100);
          setHistory(next);save("scores",next);setResult(score);tone(820);go("result");
        }
      }
      function onHidden(){if(document.hidden)fail("The page was hidden. This measurement was cancelled.");}
      function onLeave(){fail("This measurement was interrupted.");}
      const timer=setInterval(()=>{
        const now=performance.now();
        if(now-lastSample>(gotSample?1800:4000))fail(gotSample?stopReason():"No motion readings arrived. Open this page directly on your phone and check its motion permission.");
        else if(now-armedAt>45000)fail("The attempt timed out. Start again when you are ready.");
      },350);
      window.addEventListener("devicemotion",onMove);
      document.addEventListener("visibilitychange",onHidden);
      window.addEventListener("pagehide",onLeave);
      cleanup.current=()=>{
        clearInterval(timer);window.removeEventListener("devicemotion",onMove);
        document.removeEventListener("visibilitychange",onHidden);window.removeEventListener("pagehide",onLeave);
      };
    } catch { fail("Motion access could not start. Open the game directly in your mobile browser and allow motion."); }
  }

  function openBoards(from:"home"|"check"|"result") { setBoardsBackTo(from);go("boards"); }
  function openSettings(from:"home"|"check") { setSettingsBackTo(from);go("settings"); }
  function showList(p:Period) { setPeriod(p);setLoadState("loading");go("list"); }
  async function share() {
    if(!result)return;
    const text="My estimated height in Send Me to Heaven was "+metres(result.airtime)+" m ("+(result.airtime/1000).toFixed(3)+" s in flight).";
    const id=run.current;
    try {
      if(navigator.share)await navigator.share({text});
      else if(navigator.clipboard){await navigator.clipboard.writeText(text);if(id===run.current)setNote("Result copied.");}
      else if(id===run.current)setNote(text);
    } catch (e) { if((e as Error).name!=="AbortError" && id===run.current)setNote(text); }
  }
  async function post() {
    if(!result || busy)return;
    const id=run.current;setBusy(true);setNote("");
    try {
      const response=await scores("",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...result,nickname:name}),signal:AbortSignal.timeout(10000)});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error);
      const updated={...result,posted:true};
      setResult(updated);save("nickname",name);
      const list=history.map(x=>x.attempt===updated.attempt?updated:x);
      save("scores",list);setHistory(list);
      if(id===run.current)showList("world");
    } catch(e) {if(id===run.current)setNote((e as Error).message || "Could not post. Try again.");}
    finally {setBusy(false);}
  }

  const title = {home:"S.M.T.H.",rules:"How to play",disclaimer:"Disclaimer",check:"Before you start",motion:stage,issue:"No result",result:"Result",boards:"Leaderboards",list:labels[period],settings:"Settings",post:"Post result"}[screen];
  const btn=(label:string,fn:()=>void,primary=false,disabled=false)=><MenuButton key={label} {...{label,onClick:fn,primary,disabled}}/>;
  const back=()=>go("home");
  const list=period==="mine"?history.slice(0,10).map(x=>({nickname:"You",airtime:x.airtime,mine:1})):entries;
  if (screen==="home") {
    return <main className="device home-screen">
      <h1 className="home-title" tabIndex={-1} ref={heading}>{title}</h1>
      <nav className="home-menu" aria-label="Main menu">
        {btn("Tutorial",()=>go("rules"))}
        {btn("Game",requestGame)}
      </nav>
      <nav className="home-secondary" aria-label="More options">
        {btn("Disclaimer",requestGame)}
        {btn("Leaderboards",()=>openBoards("home"))}
        {btn("Settings",()=>openSettings("home"))}
      </nav>
    </main>;
  }
  if (screen==="disclaimer") {
    return <main className="device disclaimer-screen">
      <header className="disclaimer-band">
        <h1 tabIndex={-1} ref={heading}>{title}</h1>
      </header>
      <div className="disclaimer-copy">
        <p><strong>For adults 18 and older.</strong> A falling phone can injure you or someone else and can damage your phone or other property.</p>
        <p>The safest choice is not to throw your phone. Do not throw it near people, animals, or objects, or near stairs, balconies, or roads.</p>
        <p>Choose <strong>Agree</strong> to confirm you are 18 or older and understand the risks. Choose <strong>Disagree</strong> to return to the menu without starting the game.</p>
      </div>
      <nav className="disclaimer-menu" aria-label="Disclaimer choices">
        {btn("Disagree",back)}
        {btn("Agree",accept)}
      </nav>
    </main>;
  }
  return <main className="device">
    <header className="top">
      <div className="topline"><span>CK MY APPS</span><span className="unit">S.M.T.H.</span></div>
      <h1 tabIndex={-1} ref={heading}>{title}</h1>
    </header>
    <div className={"body screen-"+screen}>
      {screen==="check" && <>
        <div className="notice"><span className="warning-icon" aria-hidden="true">!</span><h2>Check your space</h2>
        <p>A falling phone can injure someone or break. For adults only. Keep people clear and stay away from balconies, stairs and hard surfaces.</p>
        <p>Hold the phone still for calibration. Tap below to allow motion access.</p></div>
        <div className="menu">{btn("Enable motion",start,true)}{btn("Back",back)}{btn("Leaderboards",()=>openBoards("check"))}{btn("Settings",()=>openSettings("check"))}</div>
        {history.length>0 && <div className="footer"><span>Personal best</span><strong>{metres(history[0].airtime)} m</strong></div>}
      </>}
      {screen==="rules" && <>
        <p className="intro">The meter times free fall and estimates peak height above your hand. Release and catch at the same height.</p>
        <div className="rules">{[["drop","No drops"],["spin","Avoid spins"],["crowds","Keep clear"],["uneven","Level catch"]].map(([type,label])=><div key={type}><RuleIcon type={type}/><span>{label}</span></div>)}</div>
        <div className="menu">{btn("Back",back)}{btn("Start",requestGame,true)}</div>
      </>}
      {screen==="motion" && <>
        <div className="hero"><TossArt/><Ruler/></div>
        <p className="status" role="status">{stage==="Hold still"?"Calibrating the sensor. Hold your phone still.":stage==="Ready"?"Sensor ready. Measuring your next toss.":"Timing free fall…"}</p>
        <div className="menu">{btn("Cancel",back)}</div>
      </>}
      {screen==="issue" && <><div className="notice"><span className="warning-icon" aria-hidden="true">!</span><h2>Measurement unavailable</h2><p role="status">{issue}</p></div><div className="menu">{btn("Try again",start,true)}{btn("Menu",back)}</div></>}
      {screen==="result" && result && <>
        <div className="readout"><span>Estimated peak height</span><strong>{metres(result.airtime)}<small>m</small></strong><span>Flight time · {(result.airtime/1000).toFixed(3)} s</span></div>
        <div role="status">{note}</div><div className="menu">{btn("Play again",start,true)}{btn("Share result",share)}{btn(result.posted?"Score posted":"Post score",()=>go("post"),false,!online || result.posted)}{btn("Leaderboards",()=>openBoards("result"))}{btn("Menu",back)}</div>
      </>}
      {screen==="boards" && <><div className="board-decoration" aria-hidden="true"><span/><span/><span/></div>{!online && <p>My Top 10 is saved on this device. Online rankings are not connected.</p>}<div className="menu">{btn("Today Top 10",()=>showList("today"),false,!online)}{btn("Week Top 10",()=>showList("week"),false,!online)}{btn("My Top 10",()=>showList("mine"))}{btn("World Top 10",()=>showList("world"),false,!online)}{btn("Back",()=>go(boardsBackTo))}</div></>}
      {screen==="list" && <><div className="rankings"><div className="rank-caption">{period==="mine"?"On this device":period==="week"?"Since Monday · UTC":period==="today"?"Since midnight · UTC":"All time"}<span>Height</span></div>
        {period!=="mine" && loadState==="loading"?<p role="status">Loading scores…</p>:period!=="mine" && loadState==="error"?<><p>Could not load the rankings.</p>{btn("Retry",()=>setRefresh(x=>x+1))}</>:list.length?
        <ol>{list.map((x,i)=><li className={x.mine?"mine":""} key={i}><span className="rank">{String(i+1).padStart(2,"0")}</span><span>{x.nickname}</span><strong>{metres(x.airtime)} m</strong></li>)}</ol>:
        <p>{period==="mine"?"Your measured attempts will appear here.":"No scores posted for this period."}</p>}</div>
        <div className="menu">{btn("Back",()=>go("boards"))}{btn("Play again",()=>go("check"))}</div></>}
      {screen==="post" && result && <><div className="notice"><h2>{metres(result.airtime)} m</h2><p>Your nickname and score will be visible on the game’s leaderboards.</p><label htmlFor="nick">Nickname</label><input id="nick" maxLength={16} autoComplete="off" value={name} onChange={e=>setName(e.target.value)} /></div>
        <p role="status">{note}</p><div className="menu">{btn(busy?"Posting…":"Post score",post,true,busy||!name.trim())}{btn("Back",()=>go("result"),false,busy)}</div></>}
      {screen==="settings" && <><div className="settings">
        <button className="setting" aria-pressed={sound} onClick={()=>{setSound(!sound);save("sound",!sound);}}><span>Sound</span><b>{sound?"ON":"OFF"}</b></button>
        <a className="setting donate" href="https://www.paypal.com/donate/?hosted_button_id=UR3QDVNHJ22GA" target="_blank" rel="noreferrer"><img src="./art/paypal.png" width="84" alt=""/><span>Donate via PayPal</span></a>
        <div className="credit">
          <img src="./art/ck-logo.png" width="58" height="58" alt="CK My Apps"/>
          <div>
            <h2>Credits</h2>
            <a href="https://ckmyapps.substack.com" target="_blank" rel="noreferrer">Created By Christos A. Kazantzoglou</a>
            <p className="original-credit">
              Original game by <a href="https://carrotpop.com" target="_blank" rel="noreferrer">Carrot Pop</a>
              <br/>© 2012–2024 Petr Svarovsky
            </p>
          </div>
        </div>
        </div><div className="menu">{btn("Back",()=>go(settingsBackTo))}</div></>}
    </div>
  </main>;
}
