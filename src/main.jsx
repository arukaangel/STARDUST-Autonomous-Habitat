import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, Atom, BatteryCharging, BrainCircuit,
  Check, ChevronRight, CircleDot, Cpu, Droplets, Eye, Gauge, Globe2, Leaf, LockKeyhole,
  Moon, Orbit, Play, Radio, RefreshCcw, Rocket, ShieldCheck, Sparkles, Sun, Thermometer,
  TriangleAlert, UnlockKeyhole, Waves, Wind, Wrench, X, Zap
} from 'lucide-react';
import './styles.css';

const API = 'https://stardust-autonomous-habitat.onrender.com/api';
const INITIAL = {
  telemetry:{oxygen_pct:20.82,co2_pct:.41,pressure_kpa:101.2,temperature_c:21.7,battery_pct:84,solar_kw:72,power_load_kw:49,airflow_pct:96,scrubber_eff_pct:97,coolant_pressure_kpa:4.8,pump_current_a:8.2,water_pct:93,humidity_pct:44},
  state:{crew:6,elapsed_min:0,lab_online:true,greenhouse_online:true,rover_charging:true,backup_pump:false,backup_scrubber:false,module_c_isolated:false,habitat_compressed:false},
  analysis:{anomaly_score:9,status:'NOMINAL',root_cause_key:null,root_cause:'No active anomaly',component:'—',confidence:98,critical_in_min:null,top_deviations:[],cause_chain:['telemetry','nominal envelope'],model:'Isolation Forest + causal signature graph'},
  inventory:[
    {name:'Oxygen reserve',value:'142 kg',status:'nominal'},{name:'Water reserve',value:'784 L',status:'nominal'},
    {name:'Battery',value:'84%',status:'nominal'},{name:'Food',value:'27 days',status:'nominal'},
    {name:'Spare filters',value:'2',status:'nominal'},{name:'Replacement pumps',value:'0',status:'critical'},
    {name:'Coolant',value:'31 L',status:'nominal'},{name:'Rover-02 aux pump',value:'83% compatible',status:'opportunity'}
  ],
  event_log:[{t:0,type:'system',message:'Digital twin initialized. All systems nominal.'}], hidden_event_active:false
};

const telemetryMeta = [
  ['oxygen_pct','OXYGEN','%',Wind,19.5,21.3],['co2_pct','CO₂','%',Activity,.3,1.5],
  ['pressure_kpa','PRESSURE',' kPa',Gauge,92,103],['temperature_c','TEMPERATURE','°C',Thermometer,18,30],
  ['battery_pct','BATTERY','%',BatteryCharging,20,100],['solar_kw','SOLAR',' kW',Sun,35,80],
  ['coolant_pressure_kpa','COOLANT',' bar',Waves,2,5.3],['water_pct','WATER','%',Droplets,35,100]
];

async function api(path, options={}){
  const res = await fetch(API+path,{headers:{'Content-Type':'application/json'},...options});
  if(!res.ok) throw new Error(`Core ${res.status}`);
  return res.json();
}

function fmtTime(min){
  if(min==null) return '—';
  const h=Math.floor(min/60), m=Math.round(min%60);
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
}

function Sparkline({values=[], min, max, danger=false}){
  const w=220,h=48;
  if(values.length<2) return <div className="spark-placeholder"/>;
  const pts=values.map((v,i)=>`${(i/(values.length-1)*w).toFixed(1)},${(h-(v-min)/(max-min)*h).toFixed(1)}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className={`spark ${danger?'danger':''}`} preserveAspectRatio="none"><polyline points={pts} fill="none" vectorEffect="non-scaling-stroke"/></svg>;
}

function StatusDot({status='nominal'}){return <span className={`status-dot ${status.toLowerCase()}`}/>}

function Hero(){
  return <section className="hero" id="top">
    <div className="hero-space"/><div className="hero-vignette"/><div className="grain"/>
    <header className="topbar">
      <a href="#top" className="brand"><span>✦</span> stardust<i>.</i></a>
      <nav><a href="#architecture">System</a><a href="#mission-control">Simulation</a><a href="#recovery">Recovery</a><a href="#mission">Mission</a><a className="nav-orb" href="#mission-control"><ArrowDown size={14}/></a></nav>
    </header>
    <div className="hero-copy">
      <div className="eyebrow">AUTONOMOUS SELF-HEALING HABITAT INTELLIGENCE · AURORA-01</div>
      <h1><em>Survival,</em><br/>before failure.</h1>
      <p>A digital twin that detects unknown failures, traces their root cause, simulates hundreds of futures and plans a recovery before the habitat crosses a critical threshold.</p>
      <div className="hero-actions"><a className="btn primary" href="#mission-control">Enter mission control <ChevronRight size={15}/></a><span className="live-pill"><i/> DIGITAL TWIN LIVE</span></div>
    </div>
    <div className="hero-side"><span>LUNAR SOUTH POLE</span><b>89.6° S</b></div>
    <div className="hero-foot"><span><Moon size={13}/> SOL 184 · CREW 06</span><span className="hero-scroll">Scroll to enter system <ArrowDown size={13}/></span><span><Orbit size={13}/> AURORA-01 / DIGITAL TWIN</span></div>
  </section>
}

function Mission(){
  return <section className="mission editorial" id="mission">
    <div className="kicker">01 / THE PROBLEM</div>
    <div className="split-title"><h2>A habitat cannot wait<br/>for something to <em>break.</em></h2><div><p>On Earth, a failing pump can call a technician. On the Moon or Mars, life support, power, water and thermal control are tightly coupled — one weak component can become a cascade.</p><p>STARDUST treats the habitat as one living system. It does not need to be told which component failed. The hidden event changes the digital twin; the intelligence sees only sensor telemetry and has to diagnose what happened.</p><a href="#mission-control" className="text-link">Watch the blind diagnosis <ArrowUpRight size={15}/></a></div></div>
    <div className="numbers"><div><strong>13</strong><span>telemetry channels</span></div><div><strong>06</strong><span>hidden fault families</span></div><div><strong>225</strong><span>future trajectories / run</span></div><div><strong>$0</strong><span>paid APIs required</span></div></div>
  </section>
}

const nodes=[
  {id:'solar',label:'SOLAR ARRAY',x:8,y:14,icon:Sun},{id:'battery',label:'BATTERY',x:29,y:14,icon:BatteryCharging},
  {id:'power',label:'POWER BUS',x:50,y:14,icon:Zap},{id:'thermal',label:'THERMAL LOOP',x:70,y:14,icon:Thermometer},
  {id:'air',label:'CABIN AIR',x:29,y:58,icon:Wind},{id:'scrubber',label:'CO₂ SCRUBBER',x:50,y:58,icon:Activity},
  {id:'water',label:'WATER LOOP',x:70,y:58,icon:Droplets},{id:'crew',label:'CREW / 06',x:88,y:58,icon:Radio}
];
function Architecture(){
  return <section className="architecture" id="architecture">
    <div className="section-head"><div><div className="kicker">02 / DIGITAL TWIN</div><h2>Not random numbers.<br/><em>A connected habitat.</em></h2></div><p>The simulator links generation, storage, life support, thermal control, water and crew demand. A failure propagates through dependencies instead of directly changing a dashboard label.</p></div>
    <div className="architecture-board">
      <svg className="links" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M13 20 L34 20 L55 20 L75 20 L55 20 L55 64 L34 64 M55 64 L75 64 L92 64 M75 20 L75 64"/><path className="pulse-path" d="M13 20 L34 20 L55 20 L75 20 L75 64 L92 64"/></svg>
      {nodes.map(({id,label,x,y,icon:Icon},i)=><div className="arch-node" key={id} style={{left:`${x}%`,top:`${y}%`}}><span className="node-index">0{i+1}</span><Icon size={18}/><b>{label}</b><small>{id==='crew'?'consumes / produces':'telemetry linked'}</small></div>)}
      <div className="arch-caption"><BrainCircuit size={18}/><div><b>STARDUST observes the network</b><span>Sensor relationships matter more than isolated thresholds.</span></div></div>
    </div>
  </section>
}

function TelemetryCard({meta, value, history}){
  const [key,label,unit,Icon,min,max]=meta;
  const vals=history.map(h=>h.telemetry?.[key]).filter(v=>typeof v==='number');
  const danger=value<min || value>max || (key==='co2_pct'&&value>.7) || (key==='battery_pct'&&value<40);
  const decimals=['co2_pct','oxygen_pct','coolant_pressure_kpa'].includes(key)?2:1;
  return <div className={`telemetry-card ${danger?'danger':''}`}><div className="telemetry-top"><span><Icon size={13}/>{label}</span><StatusDot status={danger?'critical':'nominal'}/></div><strong>{Number(value).toFixed(decimals)}<small>{unit}</small></strong><Sparkline values={vals} min={min} max={max} danger={danger}/></div>
}

function CauseGraph({analysis}){
  const chain=analysis.cause_chain||[];
  return <div className="cause-graph">
    <div className="panel-label">CAUSAL TRACE</div>
    <div className="root-cause"><span>PROBABLE ROOT</span><b>{analysis.root_cause}</b><small>{analysis.component}</small></div>
    <div className="cause-chain">{chain.map((c,i)=><React.Fragment key={c+i}><div className={i===0?'cause-node root':''}>{c}</div>{i<chain.length-1&&<ArrowRight size={14}/>}</React.Fragment>)}</div>
    <div className="deviation-list">{(analysis.top_deviations||[]).map(d=><div key={d.feature}><span>{d.feature.replaceAll('_',' ')}</span><b>{d.sigma}σ</b><i style={{width:`${Math.min(100,d.sigma*9)}%`}}/></div>)}</div>
  </div>
}

function MissionControl(){
  const [snapshot,setSnapshot]=useState(INITIAL);
  const [history,setHistory]=useState(Array.from({length:22},()=>INITIAL));
  const [backend,setBackend]=useState('connecting');
  const [speed,setSpeed]=useState(1);
  const [reveal,setReveal]=useState(null);
  const [futures,setFutures]=useState(null);
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState('');
  const fallbackFailure=useRef(null);
  const fallbackSeverity=useRef(0);

  const push=(snap)=>{setSnapshot(snap);setHistory(h=>[...h.slice(-54),snap]);};
  const fallbackStep=useCallback(()=>{
    setSnapshot(prev=>{
      const t={...prev.telemetry}; const n=(a)=>(Math.random()-.5)*a;
      if(fallbackFailure.current){fallbackSeverity.current=Math.min(1,fallbackSeverity.current+.018*speed);const s=fallbackSeverity.current;
        if(fallbackFailure.current==='cooling_pump'){t.coolant_pressure_kpa-=.025*s*speed;t.pump_current_a+=.04*s*speed;t.temperature_c+=.03*s*speed;}
        if(fallbackFailure.current==='scrubber'){t.scrubber_eff_pct-=.2*s*speed;t.co2_pct+=.004*s*speed;t.airflow_pct-=.04*s*speed;}
        if(fallbackFailure.current==='solar'){t.solar_kw-=.16*s*speed;t.battery_pct-=.06*s*speed;}
      }
      t.oxygen_pct+=n(.006);t.co2_pct+=n(.003);t.temperature_c+=n(.018);t.battery_pct+=n(.08);t.solar_kw+=n(.12);
      const anomaly=Math.min(96,9+fallbackSeverity.current*105);
      const key=fallbackFailure.current;
      const names={cooling_pump:'Cooling Pump B degradation',scrubber:'CO2 Scrubber B degradation',solar:'Solar Array C partial failure'};
      const next={...prev,telemetry:t,state:{...prev.state,elapsed_min:(prev.state.elapsed_min||0)+5*speed},hidden_event_active:!!key,analysis:{...prev.analysis,anomaly_score:anomaly,status:anomaly>55?'ANOMALY':anomaly>34?'WATCH':'NOMINAL',root_cause_key:anomaly>42?key:null,root_cause:anomaly>42?names[key]:'No active anomaly',component:anomaly>42?'LOCAL FALLBACK / DEMO':'—',confidence:anomaly>42?Math.min(94,55+fallbackSeverity.current*45):98,critical_in_min:key?Math.round(420*(1-fallbackSeverity.current*.7)):null,cause_chain:key?['sensor drift','subsystem stress','downstream load','crew risk']:['telemetry','nominal envelope'],top_deviations:key?[{feature:'cross_sensor_drift',sigma:(2+fallbackSeverity.current*7).toFixed(1)}]:[]}};
      setHistory(h=>[...h.slice(-54),next]);return next;
    });
  },[speed]);

  useEffect(()=>{api('/state').then(s=>{setBackend('online');push(s)}).catch(()=>setBackend('fallback'));},[]);
  useEffect(()=>{
    const id=setInterval(async()=>{if(backend==='online'){try{const s=await api('/step',{method:'POST',body:JSON.stringify({minutes:5*speed})});push(s)}catch{setBackend('fallback')}}else if(backend==='fallback') fallbackStep();},950);
    return()=>clearInterval(id);
  },[backend,speed,fallbackStep]);

  const unknown=async()=>{setReveal(null);setFutures(null);if(backend==='online'){await api('/unknown-event',{method:'POST',body:'{}'});setToast('Ground truth sealed. STARDUST only sees telemetry.');}else{const keys=['cooling_pump','scrubber','solar'];fallbackFailure.current=keys[Math.floor(Math.random()*keys.length)];fallbackSeverity.current=.05;setToast('Fallback demo event generated. Start backend for real ML diagnosis.');}setSpeed(5);setTimeout(()=>setToast(''),4200)};
  const reset=async()=>{setReveal(null);setFutures(null);fallbackFailure.current=null;fallbackSeverity.current=0;if(backend==='online'){push(await api('/reset',{method:'POST'}))}else{push(INITIAL)};setSpeed(1)};
  const doReveal=async()=>{if(backend==='online')setReveal(await api('/reveal'));else setReveal({truth:'Available only with Python core',predicted:snapshot.analysis.root_cause,correct:null,message:'Start RUN_STARDUST.bat to unseal real simulator ground truth.'})};
  const runFutures=async()=>{setBusy(true);try{if(backend==='online')setFutures(await api('/futures',{method:'POST'}));else setFutures({futures_simulated:225,horizon_hours:24,recommended:{strategy:'Start Python core for calculated recovery',actions:[],stability:92,worst_case:84},results:[{strategy:'Frontend preview only',stability:92,worst_case:84},{strategy:'No intervention',stability:41,worst_case:25}]})}finally{setBusy(false)}};
  const execute=async()=>{if(!futures?.recommended?.actions?.length)return;setBusy(true);for(const action of futures.recommended.actions){await api('/action',{method:'POST',body:JSON.stringify({action})});}push(await api('/state'));setToast('Recommended recovery plan executed on the digital twin.');setTimeout(()=>setToast(''),4000);setBusy(false)};

  const a=snapshot.analysis, t=snapshot.telemetry;
  return <section className="control-section" id="mission-control">
    <div className="control-heading"><div><div className="kicker">03 / BLIND FAILURE TEST</div><h2>Do not tell the AI<br/><em>what broke.</em></h2></div><div className="core-badge"><StatusDot status={backend==='online'?'nominal':backend==='connecting'?'watch':'critical'}/><div><span>STARDUST CORE</span><b>{backend==='online'?'PYTHON + ML ONLINE':backend==='connecting'?'CONNECTING…':'FRONTEND FALLBACK'}</b></div></div></div>

    <div className="mission-console">
      <div className="console-main">
        <div className="console-bar"><span><CircleDot size={12}/> LIVE TELEMETRY · AURORA-01</span><span>MISSION +{Math.floor((snapshot.state?.elapsed_min||0)/60)}:{String(Math.round((snapshot.state?.elapsed_min||0)%60)).padStart(2,'0')}</span></div>
        <div className="telemetry-grid">{telemetryMeta.map(m=><TelemetryCard key={m[0]} meta={m} value={t[m[0]]} history={history}/>)}</div>
        <div className="test-rack">
          <div><span className="panel-label">DOUBLE-BLIND DEMO</span><h3>Generate an unknown event.</h3><p>The simulator keeps the true fault hidden. The diagnosis engine receives telemetry only.</p></div>
          <div className="test-actions"><button className="console-btn hot" onClick={unknown}><Sparkles size={14}/> GENERATE UNKNOWN EVENT</button><button className="console-btn" onClick={doReveal} disabled={!snapshot.hidden_event_active}><UnlockKeyhole size={14}/> REVEAL GROUND TRUTH</button><button className="icon-btn" onClick={reset}><RefreshCcw size={15}/></button></div>
        </div>
      </div>
      <aside className={`analysis-panel ${a.status.toLowerCase()}`}>
        <div className="analysis-head"><span>STARDUST ANALYSIS</span><BrainCircuit size={19}/></div>
        <div className="risk"><strong>{Math.round(a.anomaly_score)}</strong><span>/100<br/>ANOMALY</span></div>
        <div className="analysis-status"><StatusDot status={a.status==='ANOMALY'?'critical':a.status==='WATCH'?'watch':'nominal'}/>{a.status}</div>
        <h3>{a.root_cause}</h3><p>{a.root_cause_key?'Cross-sensor behavior has left the learned nominal envelope. The causal graph is tracing the earliest consistent source.':'Telemetry remains inside the learned nominal operating envelope.'}</p>
        <div className="analysis-rows"><div><span>CONFIDENCE</span><b>{Math.round(a.confidence)}%</b></div><div><span>TIME TO CRITICAL</span><b>{fmtTime(a.critical_in_min)}</b></div><div><span>LIKELY SOURCE</span><b>{a.component}</b></div><div><span>MODEL</span><b>Isolation Forest + graph</b></div></div>
        <div className="time-control"><span>SIM SPEED</span>{[1,5,20].map(x=><button key={x} className={speed===x?'active':''} onClick={()=>setSpeed(x)}>×{x}</button>)}</div>
      </aside>
    </div>

    {reveal&&<div className={`reveal-card ${reveal.correct===true?'correct':''}`}><div><span className="panel-label">GROUND TRUTH UNSEALED</span><h3>{reveal.truth||'No event'}</h3></div><ArrowRight/><div><span className="panel-label">STARDUST PREDICTED</span><h3>{reveal.predicted||'—'}</h3></div><div className="verdict">{reveal.correct===true?<><Check/> MATCH</>:reveal.correct===false?<><X/> MISMATCH</>:<><LockKeyhole/> CORE REQUIRED</>}</div></div>}

    <div className="diagnostic-grid"><CauseGraph analysis={a}/><div className="event-log"><div className="panel-label">MISSION EVENT LOG</div>{(snapshot.event_log||[]).slice().reverse().map((e,i)=><div className="log-row" key={i}><span>+{Math.round(e.t)}m</span><StatusDot status={e.type==='action'?'opportunity':e.type==='hidden'?'watch':'nominal'}/><p>{e.message}</p></div>)}{!(snapshot.event_log||[]).length&&<p className="muted">No events yet.</p>}</div></div>

    <div className="future-engine" id="recovery">
      <div className="future-intro"><span className="kicker">04 / COUNTERFACTUAL ENGINE</span><h2>Before acting,<br/><em>simulate the future.</em></h2><p>STARDUST clones the current digital twin, applies different recovery strategies, adds small uncertainty and projects each branch 24 hours forward. The result is a ranked stability forecast — not an LLM guess.</p><button className="btn dark" onClick={runFutures} disabled={busy}>{busy?'SIMULATING 225 FUTURES…':'SIMULATE 225 FUTURES'} <Play size={14}/></button></div>
      <div className="future-results">
        {!futures?<div className="future-empty"><Orbit size={44}/><span>COUNTERFACTUAL SPACE</span><p>Awaiting a current habitat state.</p></div>:<><div className="future-top"><div><span>FUTURES ANALYZED</span><strong>{futures.futures_simulated}</strong></div><div><span>HORIZON</span><strong>{futures.horizon_hours}H</strong></div><div><span>BEST STABILITY</span><strong>{Math.round(futures.recommended.stability)}%</strong></div></div><div className="strategy-list">{futures.results.map((r,i)=><div className={`strategy ${i===0?'best':''}`} key={r.strategy}><span>{String(i+1).padStart(2,'0')}</span><b>{r.strategy}</b><div className="strategy-meter"><i style={{width:`${r.stability}%`}}/></div><strong>{Math.round(r.stability)}%</strong></div>)}</div>{backend==='online'&&futures.recommended.actions?.length>0&&<button className="execute-btn" onClick={execute} disabled={busy}><ShieldCheck size={15}/> EXECUTE RECOMMENDED PLAN ON DIGITAL TWIN</button>}</>}
      </div>
    </div>

    <ResourceLab snapshot={snapshot}/>
    {toast&&<div className="toast"><LockKeyhole size={14}/>{toast}</div>}
  </section>
}

function ResourceLab({snapshot}){
  const s=snapshot.state||{}; const cause=snapshot.analysis?.root_cause_key;
  return <div className="resource-lab">
    <div className="resource-head"><div><div className="kicker">05 / SURVIVAL INVENTION ENGINE</div><h2>When there is no spare,<br/><em>reconfigure what exists.</em></h2></div><p>A remote habitat cannot assume replacement parts arrive tomorrow. STARDUST treats inventory and non-critical equipment as a constraint graph for emergency recovery.</p></div>
    <div className="resource-grid">
      <div className="inventory"><div className="panel-label">LIVE RESOURCE INVENTORY</div>{(snapshot.inventory||[]).map(x=><div className="inventory-row" key={x.name}><StatusDot status={x.status}/><span>{x.name}</span><b>{x.value}</b></div>)}</div>
      <div className="invention-card"><div className="invent-icon"><Wrench size={24}/></div><span className="panel-label">CROSS-SYSTEM OPPORTUNITY</span><h3>{cause==='cooling_pump'?'No replacement pump available.':'Rover hardware can become habitat hardware.'}</h3><p>Rover-02 carries an auxiliary coolant pump with an estimated <b>83% interface compatibility</b>. In a pump-loss scenario, the planner can sacrifice rover availability to preserve thermal control.</p><div className="trade"><div><span>SACRIFICE</span><b>Rover-02 mobility</b></div><ArrowRight/><div><span>PROTECT</span><b>Habitat thermal loop</b></div></div><small>Concept recovery path · requires crew engineering validation before physical use.</small></div>
      <div className="crew-card"><div className="panel-label">CREW + HABITAT STATE</div><div className="crew-visual">{Array.from({length:6}).map((_,i)=><div key={i} className="crew-dot"><span>{i+1}</span></div>)}</div><div className="crew-stats"><div><span>CREW</span><b>{s.crew||6}/6</b></div><div><span>LAB</span><b>{s.lab_online===false?'OFFLINE':'ONLINE'}</b></div><div><span>GREENHOUSE</span><b>{s.greenhouse_online===false?'OFFLINE':'ONLINE'}</b></div><div><span>MODULE C</span><b>{s.module_c_isolated?'ISOLATED':'OPEN'}</b></div></div></div>
    </div>
  </div>
}

function Intelligence(){
  return <section className="intelligence">
    <div className="intelligence-visual"><div className="ai-orbit o1"/><div className="ai-orbit o2"/><div className="ai-orbit o3"/><div className="ai-core"><Sparkles size={28}/></div><span className="orbit-word w1">SENSE</span><span className="orbit-word w2">DIAGNOSE</span><span className="orbit-word w3">SIMULATE</span><span className="orbit-word w4">ACT</span></div>
    <div className="intelligence-copy"><div className="kicker light">06 / AUTONOMY LOOP</div><h2>One loop.<br/><em>No paid AI required.</em></h2><p>The safety decisions come from the digital twin, local machine learning and deterministic recovery simulation. A language model can be added later as a voice layer, but STARDUST does not depend on one.</p><div className="loop-list">{[['01','SENSE','Fuse telemetry from the habitat.'],['02','DETECT','Find behavior outside the learned nominal envelope.'],['03','DIAGNOSE','Trace the most consistent root-cause chain.'],['04','SIMULATE','Test hundreds of recovery trajectories.'],['05','ACT','Reconfigure the digital twin and verify recovery.']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><p>{x[2]}</p></div>)}</div></div>
  </section>
}

function Closing(){return <><section className="closing"><div className="closing-space"><div className="planet"/><div className="tiny-habitat"/></div><div className="closing-copy"><div className="kicker light">07 / STARDUST</div><h2><em>Earth is far.</em><br/>The habitat must think.</h2><p>A research prototype for autonomous, self-healing infrastructure beyond Earth: detect the unknown, explain the cascade, test the future, protect the crew.</p><a className="btn light" href="#mission-control">Run the blind test <ArrowUpRight size={14}/></a></div></section><footer><a href="#top" className="brand"><span>✦</span> stardust<i>.</i></a><span>Autonomous Self-Healing Habitat Intelligence</span><span>Digital twin research prototype · 2026</span></footer></>}

function App(){return <main><Hero/><Mission/><Architecture/><MissionControl/><Intelligence/><Closing/></main>}
createRoot(document.getElementById('root')).render(<App/>);
