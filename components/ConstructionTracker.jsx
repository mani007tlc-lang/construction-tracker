\
'use client';
import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import * as XLSX from "xlsx";

// --- Minimal UI shims (since we don't ship shadcn in this quick deploy) --- //
function Card({children}){ return <div style={{background:'#fff',borderRadius:16,boxShadow:'0 8px 14px rgba(0,0,0,.04)'}}>{children}</div>}
function CardContent({children,style}){ return <div style={{padding:16,...style}}>{children}</div>}
function Button({children,onClick,variant="solid",style}){
  const base={padding:'6px 12px',borderRadius:12,cursor:'pointer',border:'1px solid #e5e7eb',background:variant==="solid"?"#2563eb":"transparent",color:variant==="solid"?"#fff":"#2563eb"};
  return <button onClick={onClick} style={{...base,...style}}>{children}</button>;
}
function Input(props){ return <input {...props} style={{padding:'8px 10px',borderRadius:12,border:'1px solid #d1d5db',width:'100%'}}/>; }
function Select({value,onChange,options}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:'8px 10px',borderRadius:12,border:'1px solid #d1d5db',width:'100%'}}>
    {options.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}

// ---------------- CPWD PRODUCTIVITY (sample extended) ---------------- //
const CPWD_PRODUCTIVITY={
  site_clearing:450,excav_soft:18,excav_hard:10,excav_rock:5,trench_excav:15,backfilling:22,compaction:120,
  concrete_manual:3.5,concrete_pump:6.5,rebar_fabrication:120,rebar_erection:90,formwork_shuttering:8,column_shuttering:6,slab_formwork:10,
  brick_masonry:1.2,block_masonry:1.6,stone_masonry:0.9,plaster_12mm:10,plaster_20mm:8,tile_flooring:9,granite_flooring:3.5,painting:45,putty:55,
  conduit_laying:55,wire_laying:80,plumbing_ppr:35,fire_piping:22
};

// calendar helpers
function addWorkingDays(startDate, durationDays, calendar){
  let d=new Date(startDate); let days=0;
  while(days<durationDays){
    d.setDate(d.getDate()+1);
    const dow=d.getDay(), iso=d.toISOString().slice(0,10);
    const isWeekend=!calendar.workingDays.includes(dow);
    const isHoliday=calendar.holidays.includes(iso);
    if(!isWeekend && !isHoliday) days++;
  }
  return d;
}
function scheduleWithCalendar(tasks,start,calendar){
  const map=new Map(); tasks.forEach(t=>map.set(t.id,t));
  return tasks.map(t=>{
    const pred=map.get(t.predecessor);
    const s=pred&&pred.finish?new Date(pred.finish):new Date(start);
    const f=addWorkingDays(s,Number(t.durationDays||0),calendar);
    return {...t,start:s.toISOString().slice(0,10),finish:f.toISOString().slice(0,10)};
  });
}
function computeCriticalPath(tasks){
  const map=new Map(); tasks.forEach(t=>map.set(t.id,t));
  const memo={};
  const dfs=id=> memo[id] ?? (memo[id]=(Number(map.get(id)?.durationDays||0)+(map.get(id)?.predecessor?dfs(map.get(id).predecessor):0)));
  let longest=0; tasks.forEach(t=> longest=Math.max(longest,dfs(t.id)));
  const set=new Set(); tasks.forEach(t=> dfs(t.id)===longest && set.add(t.id));
  return {duration:longest,set};
}

export default function ConstructionTracker(){
  const [user,setUser]=useState(null);
  const [projects,setProjects]=useState([{id:crypto.randomUUID(),name:"Project 1",start:"2025-01-01"}]);
  const [activeProject,setActiveProject]=useState(projects[0].id);

  const [calendar,setCalendar]=useState({workingDays:[1,2,3,4,5,6],holidays:[],shiftStart:"08:00",shiftEnd:"20:00"});
  const [workHours,setWorkHours]=useState(12);
  const [tasks,setTasks]=useState([]);

  const [form,setForm]=useState({name:\"\",activity:\"excav_soft\",quantity:\"\",durationDays:\"\",skilledPct:60,equipment:\"Excavator\",unitCost:\"\",predecessor:\"\",material:\"\",materialQty:\"\",materialLead:3});

  const project=projects.find(p=>p.id===activeProject);
  const projectTasks=tasks.filter(t=>t.project===activeProject);

  const importBOQ=e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=evt=>{
      const wb=XLSX.read(evt.target.result,{type:'binary'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:\"\"});
      setTasks(rows.map((r,i)=>({
        id:crypto.randomUUID(),project:activeProject,
        name:r.Task||`Row ${i+1}`,activity:r.Code||\"excav_soft\",quantity:r.Quantity||0,
        durationDays:r.Duration||1,skilledPct:r.SkilledPct||60,
        equipment:r.Equipment||\"N/A\",unitCost:r.UnitCost||0,
        predecessor:r.Predecessor||\"\",material:r.Material||\"\",materialQty:r.MaterialQty||0,materialLead:r.MaterialLead||3
      })));
    };
    reader.readAsBinaryString(f);
  };

  const addTask=()=>{
    if(!form.name||!form.quantity||!form.durationDays) return;
    setTasks([...tasks,{id:crypto.randomUUID(),project:activeProject,...form}]);
    setForm({...form,name:\"\",quantity:\"\",durationDays:\"\"});
  };
  const removeTask=id=> setTasks(tasks.filter(t=>t.id!==id));

  const calc=t=>{
    const qty=+t.quantity||0,dur=+t.durationDays||0,prod=CPWD_PRODUCTIVITY[t.activity]||1;
    const workerDays=qty/prod,manpower=dur?workerDays/dur:0,skilled=(manpower*t.skilledPct)/100,unskilled=manpower-skilled;
    const equipmentHours=dur*workHours,cost=qty*(+t.unitCost||0);
    return {workerDays:+workerDays.toFixed(2),manpowerAvg:+manpower.toFixed(2),skilled:+skilled.toFixed(2),unskilled:+unskilled.toFixed(2),equipmentHours:+equipmentHours.toFixed(2),cost:+cost.toFixed(2)};
  };

  const scheduled=scheduleWithCalendar(projectTasks,project?.start,calendar);
  const cp=computeCriticalPath(scheduled);
  const procurement=scheduled.filter(t=>t.material).map(t=>{
    const d=new Date(t.start); d.setDate(d.getDate()-Number(t.materialLead||0));
    return {task:t.name,material:t.material,qty:t.materialQty,orderBy:d.toISOString().slice(0,10)};
  });
  let run=0; const sCurve=scheduled.map((t,i)=>{run+=calc(t).cost; return {index:i+1,cost:run};});
  const totals=scheduled.reduce((a,t)=>{const c=calc(t); a.workerDays+=c.workerDays; a.cost+=c.cost; a.equipmentHours+=c.equipmentHours; return a;},{workerDays:0,cost:0,equipmentHours:0});

  const exportMSP=()=>{
    const xml=`<?xml version=\"1.0\"?><Project><Name>${project?.name}</Name><Tasks>${
      scheduled.map((t,i)=>`<Task><UID>${i+1}</UID><Name>${t.name}</Name><Start>${t.start}T${calendar.shiftStart}:00</Start><Finish>${t.finish}T${calendar.shiftEnd}:00</Finish><Duration>PT${t.durationDays}D</Duration></Task>`).join('')
    }</Tasks></Project>`;
    const blob=new Blob([xml],{type:'application/xml'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='project.xml'; a.click(); URL.revokeObjectURL(url);
  };

  const login=()=>setUser({id:1,name:'Manager'});

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:24}}>
      <motion.h1 initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className=\"text-2xl font-semibold\">
        Construction Project Management Suite
      </motion.h1>

      {!user && (
        <Card><CardContent style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><b>Log in (demo)</b></div><Button onClick={login}>Login</Button>
        </CardContent></Card>
      )}

      <Card><CardContent style={{display:'grid',gap:12,gridTemplateColumns:'1fr 1fr auto auto'}}>
        <div>
          <div>Project</div>
          <select value={activeProject} onChange={e=>setActiveProject(e.target.value)} style={{padding:6,borderRadius:8}}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <div>Start date</div>
          <Input type=\"date\" value={project?.start} onChange={e=>setProjects(projects.map(p=>p.id===activeProject?{...p,start:e.target.value}:p))}/>
        </div>
        <Button onClick={()=>setProjects([...projects,{id:crypto.randomUUID(),name:`Project ${projects.length+1}`,start:project?.start}])}>+ Project</Button>
        <Button onClick={exportMSP} variant=\"outline\">Export MSP</Button>
      </CardContent></Card>

      <Card><CardContent style={{display:'grid',gap:12,gridTemplateColumns:'1fr 1fr'}}>
        <div>
          <div>Working days</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,marginTop:6,fontSize:12}}>
            {[\"Sun\",\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\"].map((d,i)=>(
              <Button key={i} variant={calendar.workingDays.includes(i)?'solid':'outline'}
                onClick={()=>setCalendar({...calendar,workingDays:calendar.workingDays.includes(i)?calendar.workingDays.filter(x=>x!==i):[...calendar.workingDays,i]})}>{d}</Button>
            ))}
          </div>
        </div>
        <div>
          <div>Add holiday</div>
          <Input type=\"date\" onChange={e=>e.target.value && setCalendar({...calendar,holidays:[...new Set([...calendar.holidays,e.target.value])]})}/>
          <div style={{fontSize:12,marginTop:6,color:'#6b7280'}}>{calendar.holidays.join(', ')||'No holidays'}</div>
        </div>
      </CardContent></Card>

      <Card><CardContent style={{display:'grid',gap:12,gridTemplateColumns:'repeat(3,1fr)'}}>
        <div><div>Work hours/day</div><Input type=\"number\" value={workHours} onChange={e=>setWorkHours(+e.target.value)}/></div>
        <div><div>Import BOQ</div><Input type=\"file\" accept=\".xls,.xlsx\" onChange={importBOQ}/></div>
      </CardContent></Card>

      <Card><CardContent>
        <div style={{display:'grid',gap:10,gridTemplateColumns:'repeat(4,1fr)'}}>
          <Input placeholder=\"Task name\" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <Select value={form.activity} onChange={v=>setForm({...form,activity:v})}
                  options={Object.keys(CPWD_PRODUCTIVITY).map(k=>({value:k,label:k}))}/>
          <Input type=\"number\" placeholder=\"Qty\" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/>
          <Input type=\"number\" placeholder=\"Dur (d)\" value={form.durationDays} onChange={e=>setForm({...form,durationDays:e.target.value})}/>
        </div>
        <div style={{display:'grid',gap:10,gridTemplateColumns:'repeat(4,1fr)',marginTop:10}}>
          <Input type=\"number\" placeholder=\"Skilled %\" value={form.skilledPct} onChange={e=>setForm({...form,skilledPct:+e.target.value})}/>
          <Input placeholder=\"Equipment\" value={form.equipment} onChange={e=>setForm({...form,equipment:e.target.value})}/>
          <Input type=\"number\" placeholder=\"Unit cost\" value={form.unitCost} onChange={e=>setForm({...form,unitCost:e.target.value})}/>
          <Input placeholder=\"Predecessor (Task ID)\" value={form.predecessor} onChange={e=>setForm({...form,predecessor:e.target.value})}/>
        </div>
        <div style={{display:'grid',gap:10,gridTemplateColumns:'repeat(3,1fr)',marginTop:10}}>
          <Input placeholder=\"Material\" value={form.material} onChange={e=>setForm({...form,material:e.target.value})}/>
          <Input placeholder=\"Material qty\" value={form.materialQty} onChange={e=>setForm({...form,materialQty:e.target.value})}/>
          <Input type=\"number\" placeholder=\"Material lead (d)\" value={form.materialLead} onChange={e=>setForm({...form,materialLead:e.target.value})}/>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}><Button onClick={addTask}>Add task</Button></div>
      </CardContent></Card>

      <Card><CardContent style={{overflowX:'auto',padding:0}}>
        <table style={{width:'100%',fontSize:13}}>
          <thead><tr style={{background:'#f3f4f6'}}>
            <th className=\"p-3\">ID</th><th>Task</th><th>Act</th><th>Qty</th><th>Dur</th><th>Start</th><th>Finish</th><th>Wk-days</th><th>Manp</th><th>Cost</th><th></th>
          </tr></thead>
          <tbody>
          {scheduled.map(t=>{const c=calc(t);const isCP=cp.set.has(t.id);
            return(<tr key={t.id} style={{background:isCP?'#fee2e2':'transparent',borderTop:'1px solid #e5e7eb'}}>
              <td style={{padding:8}}>{t.id.slice(0,5)}</td><td>{t.name}</td><td>{t.activity}</td><td style={{textAlign:'right'}}>{t.quantity}</td>
              <td style={{textAlign:'right'}}>{t.durationDays}</td><td>{t.start}</td><td>{t.finish}</td>
              <td style={{textAlign:'right'}}>{c.workerDays}</td><td style={{textAlign:'right'}}>{c.manpowerAvg}</td><td style={{textAlign:'right'}}>₹{c.cost}</td>
              <td style={{textAlign:'right'}}><Button variant=\"outline\" onClick={()=>removeTask(t.id)}>X</Button></td>
            </tr>);})}
          </tbody>
        </table>
      </CardContent></Card>

      <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
        <Card><CardContent><div>Total worker-days</div><h3>{totals.workerDays.toFixed(2)}</h3></CardContent></Card>
        <Card><CardContent><div>Total equipment hours</div><h3>{totals.equipmentHours.toFixed(2)}</h3></CardContent></Card>
        <Card><CardContent><div>Total cost</div><h3>₹ {totals.cost.toFixed(2)}</h3></CardContent></Card>
        <Card><CardContent><div>Critical path duration</div><h3>{cp.duration} days</h3></CardContent></Card>
      </div>

      <Card><CardContent><h3>Manpower Histogram</h3>
        <ResponsiveContainer width=\"100%\" height={260}><BarChart data={scheduled.map(t=>({name:t.name,manpower:calc(t).manpowerAvg}))}>
          <XAxis dataKey=\"name\" hide/><YAxis/><Tooltip/><Bar dataKey=\"manpower\" radius={[8,8,0,0]}/>
        </BarChart></ResponsiveContainer>
      </CardContent></Card>

      <Card><CardContent><h3>Cost S-Curve</h3>
        <ResponsiveContainer width=\"100%\" height={260}><LineChart data={sCurve}><CartesianGrid strokeDasharray=\"3 3\"/><XAxis dataKey=\"index\"/><YAxis/><Tooltip/><Legend/><Line type=\"monotone\" dataKey=\"cost\" dot={false}/></LineChart></ResponsiveContainer>
      </CardContent></Card>

      <Card><CardContent><h3>Procurement plan</h3>
        <table style={{width:'100%',fontSize:13}}><thead><tr style={{background:'#f3f4f6'}}><th>Task</th><th>Material</th><th>Qty</th><th>Order by</th></tr></thead>
        <tbody>{procurement.map((p,i)=>(<tr key={i} style={{borderTop:'1px solid #e5e7eb'}}><td>{p.task}</td><td>{p.material}</td><td>{p.qty}</td><td>{p.orderBy}</td></tr>))}</tbody></table>
      </CardContent></Card>
    </div>
  );
}
