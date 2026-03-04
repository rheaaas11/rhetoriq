import { useState, useRef, useCallback, useEffect } from "react";

// ── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert linguistic analyst and speech coach with deep knowledge of rhetoric, persuasion theory (Logos, Ethos, Pathos), syntax analysis, pragmatics, ELL frameworks, register, and audience awareness.

CRITICAL INSTRUCTION: Return ONLY a valid, complete JSON object. No markdown fences, no preamble, no text after. Keep all string values concise (under 150 words each).

{
  "overview": { "wordCount":0,"sentenceCount":0,"avgSentenceLength":0,"readabilityLevel":"","estimatedDeliveryTime":"","detectedEvent":"","detectedFormality":"","detectedPurpose":"","detectedAudience":"","overallScore":0,"summary":"" },
  "persuasion": {
    "overallPersuasivenessScore":0,
    "logos":{"score":0,"analysis":"","instances":[{"text":"","comment":""}],"suggestions":[""]},
    "ethos":{"score":0,"analysis":"","instances":[{"text":"","comment":""}],"suggestions":[""]},
    "pathos":{"score":0,"analysis":"","instances":[{"text":"","comment":""}],"suggestions":[""]}
  },
  "linguistic": {
    "syntax":{"score":0,"analysis":"","patterns":[""],"suggestions":[""]},
    "lexicalChoices":{"score":0,"analysis":"","powerWords":[""],"weakWords":[{"word":"","suggestion":""}],"suggestions":[""]},
    "register":{"current":"","appropriate":true,"analysis":"","suggestion":""},
    "cohesion":{"score":0,"analysis":"","suggestions":[""]}
  },
  "improvements":[{"priority":"high","category":"","originalText":"","improvedText":"","explanation":""}],
  "enhancedScript":"",
  "potentialQuestions":[{"type":"audience","question":"","tip":""},{"type":"reflective","question":"","tip":""},{"type":"critical","question":"","tip":""}]
}

Max: 3 instances per persuasion type, 5 improvements, 6 questions (2 per type).`;

const buildPrompt = (speech, event, formality, purpose, audience) =>
  `EVENT: ${event||"detect"}\nFORMALITY: ${formality||"detect"}\nPURPOSE: ${purpose||"detect"}\nAUDIENCE: ${audience||"detect"}\n\nSPEECH:\n${speech}\n\nReturn only the JSON.`;

// ── JSON repair ───────────────────────────────────────────────────────────────

function extractJSON(text) {
  let t = text.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  const start = t.indexOf("{");
  if (start===-1) throw new Error("No JSON found");
  let depth=0, end=-1;
  for (let i=start;i<t.length;i++){
    if(t[i]==="{") depth++;
    else if(t[i]==="}"){depth--;if(depth===0){end=i;break;}}
  }
  const s = end!==-1?t.slice(start,end+1):t.slice(start);
  try { return JSON.parse(s); } catch {
    let r=s, br=0, bk=0, inS=false, esc=false;
    for (const c of r){
      if(esc){esc=false;continue;} if(c==="\\"){esc=true;continue;}
      if(c==='"'){inS=!inS;continue;} if(inS)continue;
      if(c==="{")br++;else if(c==="}")br--;else if(c==="[")bk++;else if(c==="]")bk--;
    }
    if(inS)r+='"';
    for(let i=0;i<bk;i++)r+="]";
    for(let i=0;i<br;i++)r+="}";
    return JSON.parse(r);
  }
}

// ── PDF export ────────────────────────────────────────────────────────────────

function exportPDF(analysis, speech, meta) {
  const win = window.open("","_blank");
  if(!win)return;
  const sc=(s)=>s>=70?"#16a34a":s>=40?"#d97706":"#dc2626";
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>RhetorIQ Report</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.6}
h1{color:#1e293b;border-bottom:3px solid #D4A853;padding-bottom:12px}h2{color:#B8860B;margin-top:28px;font-size:16px;border-bottom:1px solid #e2e8f0;padding-bottom:5px}
h3{color:#374151;font-size:14px;margin:16px 0 5px}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:12px 0}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}.lbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:3px}
.big{font-size:24px;font-weight:bold}.chip{display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;margin:2px}
.orig{background:#fef2f2;padding:9px;border-radius:6px;border-left:3px solid #ef4444;margin:5px 0;font-size:12px;font-style:italic}
.impr{background:#f0fdf4;padding:9px;border-radius:6px;border-left:3px solid #22c55e;margin:5px 0;font-size:12px;font-style:italic}
.qcard{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:11px;margin:7px 0}
.enhanced{background:#f8fafc;padding:20px;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.8}
.impcard{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:9px 0}
@media print{body{margin:20px}}</style></head><body>
<h1>🎤 RhetorIQ — Speech Analysis Report</h1>
<p style="color:#64748b;font-size:12px">Generated ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}${meta?.event?" · "+meta.event:""}</p>
<h2>Overview</h2><div class="grid">
<div class="card"><div class="lbl">Overall Score</div><div class="big" style="color:${sc(analysis.overview.overallScore)}">${analysis.overview.overallScore}/100</div></div>
<div class="card"><div class="lbl">Words / Sentences</div><div class="big">${analysis.overview.wordCount}/${analysis.overview.sentenceCount}</div></div>
<div class="card"><div class="lbl">Delivery Time</div><div style="font-size:15px;font-weight:600">${analysis.overview.estimatedDeliveryTime}</div></div>
<div class="card"><div class="lbl">Readability</div><div style="font-weight:600">${analysis.overview.readabilityLevel}</div></div>
<div class="card"><div class="lbl">Purpose</div><div style="font-weight:600">${analysis.overview.detectedPurpose}</div></div>
<div class="card"><div class="lbl">Audience</div><div style="font-weight:600">${analysis.overview.detectedAudience}</div></div>
</div><p style="font-size:13px">${analysis.overview.summary}</p>
<h2>Persuasion</h2><div class="grid">
<div class="card"><div class="lbl">⚖️ Logos</div><div class="big" style="color:${sc(analysis.persuasion.logos.score)}">${analysis.persuasion.logos.score}/100</div><p style="font-size:12px;margin-top:6px">${analysis.persuasion.logos.analysis}</p></div>
<div class="card"><div class="lbl">🎓 Ethos</div><div class="big" style="color:${sc(analysis.persuasion.ethos.score)}">${analysis.persuasion.ethos.score}/100</div><p style="font-size:12px;margin-top:6px">${analysis.persuasion.ethos.analysis}</p></div>
<div class="card"><div class="lbl">❤️ Pathos</div><div class="big" style="color:${sc(analysis.persuasion.pathos.score)}">${analysis.persuasion.pathos.score}/100</div><p style="font-size:12px;margin-top:6px">${analysis.persuasion.pathos.analysis}</p></div>
</div>
<h2>Linguistic</h2>
<h3>Syntax — ${analysis.linguistic.syntax.score}/100</h3><p style="font-size:13px">${analysis.linguistic.syntax.analysis}</p>${analysis.linguistic.syntax.patterns?.map(p=>`<span class="chip">${p}</span>`).join("")||""}
<h3>Lexical Choices — ${analysis.linguistic.lexicalChoices.score}/100</h3><p style="font-size:13px">${analysis.linguistic.lexicalChoices.analysis}</p>${analysis.linguistic.lexicalChoices.weakWords?.map(w=>`<div style="font-size:12px;margin:3px 0"><span style="color:#dc2626;text-decoration:line-through">${w.word}</span> → <span style="color:#16a34a">${w.suggestion}</span></div>`).join("")||""}
<h3>Register</h3><p style="font-size:13px"><strong>${analysis.linguistic.register.current}</strong> — ${analysis.linguistic.register.appropriate?"✅ Appropriate":"⚠️ Needs adjustment"}</p><p style="font-size:13px">${analysis.linguistic.register.analysis}</p>
<h3>Cohesion — ${analysis.linguistic.cohesion.score}/100</h3><p style="font-size:13px">${analysis.linguistic.cohesion.analysis}</p>
<h2>Improvements</h2>${analysis.improvements?.map(imp=>`<div class="impcard"><div style="font-size:10px;color:#64748b;margin-bottom:7px;text-transform:uppercase">[${imp.priority}] ${imp.category}</div><div class="orig">Original: "${imp.originalText}"</div><div class="impr">Improved: "${imp.improvedText}"</div><p style="font-size:12px;color:#374151;margin-top:7px">${imp.explanation}</p></div>`).join("")||""}
<h2>Questions</h2>${analysis.potentialQuestions?.map(q=>`<div class="qcard"><div style="font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px">${q.type}</div><div style="font-weight:600;font-size:13px;margin-bottom:4px">"${q.question}"</div><div style="font-size:12px;color:#64748b">💡 ${q.tip}</div></div>`).join("")||""}
<h2>Enhanced Script</h2><div class="enhanced">${analysis.enhancedScript}</div>
</body></html>`);
  win.document.close();
  setTimeout(()=>win.print(),600);
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const Sugg = ({text}) => (
  <div style={{display:"flex",gap:"8px",marginBottom:"5px",fontSize:"13px",color:"#94a3b8",alignItems:"flex-start"}}>
    <span style={{color:"#D4A853",flexShrink:0}}>→</span>{text}
  </div>
);

const Chip = ({label,val,color,bg,border,textColor}) => (
  <div style={{background:bg,borderRadius:"8px",padding:"10px 14px",border:`1px solid ${border}`}}>
    <div style={{fontSize:"9px",color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"4px"}}>{label}</div>
    <div style={{fontSize:"13px",color:color||textColor,fontWeight:"600"}}>{val}</div>
  </div>
);

const PBadge = ({priority}) => {
  const m={high:["#7f1d1d","#fca5a5","HIGH"],medium:["#78350f","#fcd34d","MED"],low:["#1e3a5f","#93c5fd","LOW"]};
  const [bg,fg,lbl]=m[priority]||m.low;
  return <span style={{background:bg,color:fg,padding:"2px 8px",borderRadius:"4px",fontSize:"10px",fontWeight:"800",letterSpacing:"0.1em"}}>{lbl}</span>;
};

const ScoreRing = ({score,size=72,label,color,trackColor,textColor}) => {
  const r=(size-10)/2, circ=2*Math.PI*r, offset=circ-((score||0)/100)*circ;
  const pal={gold:"#D4A853",teal:"#2DD4BF",rose:"#FB7185",violet:"#A78BFA"};
  const sc=pal[color]||pal.gold;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={sc} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 1.2s ease"}}/>
        <text x={size/2} y={size/2+5} textAnchor="middle" fill={textColor}
          fontSize="13" fontWeight="bold"
          style={{transform:`rotate(90deg) translate(0px, -${size}px)`}}>{score}</text>
      </svg>
      {label && <span style={{fontSize:"10px",color:"#94a3b8",textAlign:"center",maxWidth:size+10}}>{label}</span>}
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────

export default function RhetorIQ() {
  const [dark, setDark] = useState(true);
  const [view, setView] = useState("home"); // home | analyse | history | results
  const [speech, setSpeech] = useState("");
  const [event, setEvent] = useState("");
  const [formality, setFormality] = useState("");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState(0);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const fileRef = useRef();
  const stageRef = useRef();

  // Theme tokens
  const D = dark;
  const bg       = D ? "#060d1a"              : "#f1f5f9";
  const card     = D ? "rgba(15,23,42,0.95)"  : "#ffffff";
  const border   = D ? "rgba(212,168,83,0.2)" : "rgba(212,168,83,0.4)";
  const txt      = D ? "#e2e8f0"              : "#1e293b";
  const muted    = D ? "#94a3b8"              : "#64748b";
  const iBg      = D ? "rgba(255,255,255,0.04)": "#f8fafc";
  const iBorder  = D ? "rgba(255,255,255,0.12)": "#cbd5e1";
  const track    = D ? "#1e293b"              : "#e2e8f0";
  const scC      = (s) => s>=70?"#2DD4BF":s>=40?"#D4A853":"#FB7185";

  // ── Load history from storage ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("rhetoriq-history");
        if (res?.value) setHistory(JSON.parse(res.value));
      } catch { /* no history yet */ }
      setHistoryLoaded(true);
    })();
  }, []);

  const saveToHistory = async (analysisData, speechText, meta) => {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      speech: speechText,
      meta,
      analysis: analysisData,
      score: analysisData.overview.overallScore,
      event: analysisData.overview.detectedEvent || meta.event || "Untitled",
      wordCount: analysisData.overview.wordCount,
      preview: speechText.slice(0, 120) + (speechText.length > 120 ? "…" : ""),
    };
    const updated = [entry, ...history].slice(0, 20); // keep last 20
    setHistory(updated);
    try { await window.storage.set("rhetoriq-history", JSON.stringify(updated)); } catch {}
  };

  const deleteHistory = async (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try { await window.storage.set("rhetoriq-history", JSON.stringify(updated)); } catch {}
  };

  const loadHistoryItem = (item) => {
    setSpeech(item.speech);
    setEvent(item.meta?.event || "");
    setFormality(item.meta?.formality || "");
    setPurpose(item.meta?.purpose || "");
    setAudience(item.meta?.audience || "");
    setAnalysis(item.analysis);
    setActiveTab("overview");
    setView("results");
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file)return;
    const reader = new FileReader();
    reader.onload = (ev) => setSpeech(ev.target.result);
    reader.readAsText(file);
  };

  // ── Analyse ───────────────────────────────────────────────────────────────
  const analyse = useCallback(async () => {
    if (!speech.trim()) { setError("Please enter or upload a speech first."); return; }
    setLoading(true); setError(""); setAnalysis(null); setLoadStage(0);
    stageRef.current = setInterval(() => setLoadStage(s => (s+1)%5), 4000);
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildPrompt(speech, event, formality, purpose, audience) }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.content?.map(b=>b.text||"").join("")||"";
      const parsed = extractJSON(raw);
      clearInterval(stageRef.current);
      setAnalysis(parsed);
      setActiveTab("overview");
      setView("results");
      await saveToHistory(parsed, speech, { event, formality, purpose, audience });
    } catch(err) {
      clearInterval(stageRef.current);
      setError("Analysis failed: " + err.message);
    } finally { setLoading(false); }
  }, [speech, event, formality, purpose, audience, history]);

  const copyText = (t) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  const loadStages = ["Reading your speech…","Analysing rhetoric…","Scoring linguistics…","Generating improvements…","Finalising report…"];
  const tabs = [
    {id:"overview",label:"📊 Overview"},
    {id:"persuasion",label:"🎯 Persuasion"},
    {id:"linguistic",label:"🔤 Linguistic"},
    {id:"improvements",label:"✏️ Improvements"},
    {id:"enhanced",label:"✨ Enhanced"},
    {id:"questions",label:"❓ Questions"},
  ];

  // ── Shared input styles ───────────────────────────────────────────────────
  const inputStyle = { width:"100%",background:iBg,border:`1px solid ${iBorder}`,borderRadius:"8px",padding:"10px 14px",color:txt,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"Georgia,serif" };
  const selectStyle = { ...inputStyle, background: D?"#0f172a":"#f8fafc" };
  const btnGold = { background:"linear-gradient(135deg,#D4A853,#B8860B)",border:"none",color:"#0f172a",borderRadius:"8px",cursor:"pointer",fontWeight:"700",fontFamily:"Georgia,serif" };
  const btnGhost = { background:"transparent",border:"1px solid rgba(212,168,83,0.3)",color:"#D4A853",borderRadius:"8px",cursor:"pointer",fontFamily:"Georgia,serif" };

  // ── NAV ───────────────────────────────────────────────────────────────────
  const renderNav = () => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"40px",flexWrap:"wrap",gap:"12px",width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:"24px"}}>
        <div>
          <div style={{fontSize:"9px",letterSpacing:"0.25em",color:"#D4A853",textTransform:"uppercase",marginBottom:"4px"}}>Linguistic Intelligence</div>
          <div style={{fontSize:"clamp(22px,4vw,36px)",fontWeight:"700",color:"#D4A853",letterSpacing:"-0.5px",lineHeight:1}}>RhetorIQ</div>
        </div>
        <div style={{display:"flex",gap:"4px",marginTop:"4px"}}>
          {[{id:"home",label:"Analyse"},{id:"history",label:`History${history.length?` (${history.length})`:""}` }].map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              style={{padding:"6px 14px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"600",
                background:view===n.id||((view==="analyse"||view==="results")&&n.id==="home")?"rgba(212,168,83,0.15)":"transparent",
                color:view===n.id||((view==="analyse"||view==="results")&&n.id==="home")?"#D4A853":muted,fontFamily:"Georgia,serif"}}>
              {n.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={()=>setDark(!D)}
        style={{...btnGhost,padding:"7px 14px",fontSize:"12px"}}>
        {D?"☀️ Light":"🌙 Dark"}
      </button>
    </div>
  );

  // ── HOME / ANALYSE VIEW ───────────────────────────────────────────────────
  const renderHome = () => (
    <div style={{background:card,border:`1px solid ${border}`,borderRadius:"16px",padding:"40px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",marginBottom:"28px"}}>
        {[
          {label:"Event / Occasion",val:event,set:setEvent,ph:"e.g. TEDx Talk, Job Interview, Wedding Toast…"},
          {label:"Target Audience",val:audience,set:setAudience,ph:"e.g. Business executives, High school students…"},
        ].map(({label,val,set,ph})=>(
          <div key={label}>
            <label style={{display:"block",fontSize:"10px",letterSpacing:"0.1em",color:"#D4A853",marginBottom:"6px",textTransform:"uppercase"}}>{label}</label>
            <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={inputStyle}/>
          </div>
        ))}
        {[
          {label:"Formality Level",val:formality,set:setFormality,opts:["Highly Formal","Formal","Semi-formal","Informal","Casual"]},
          {label:"Purpose",val:purpose,set:setPurpose,opts:["Persuade","Inform","Inspire","Entertain","Celebrate","Argue","Propose"]},
        ].map(({label,val,set,opts})=>(
          <div key={label}>
            <label style={{display:"block",fontSize:"10px",letterSpacing:"0.1em",color:"#D4A853",marginBottom:"6px",textTransform:"uppercase"}}>{label}</label>
            <select value={val} onChange={e=>set(e.target.value)} style={{...selectStyle,color:val?txt:muted}}>
              <option value="">Auto-detect</option>
              {opts.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
          <label style={{fontSize:"10px",letterSpacing:"0.1em",color:"#D4A853",textTransform:"uppercase"}}>Your Speech / Script</label>
          <button onClick={()=>fileRef.current.click()}
            style={{background:"rgba(212,168,83,0.1)",border:"1px solid rgba(212,168,83,0.3)",color:"#D4A853",padding:"5px 12px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif"}}>
            ↑ Upload .txt
          </button>
          <input ref={fileRef} type="file" accept=".txt" onChange={handleFile} style={{display:"none"}}/>
        </div>
        <textarea
          value={speech}
          onChange={e => setSpeech(e.target.value)}
          placeholder="Paste your speech or script here…"
          rows={12}
          style={{
            width:"100%", boxSizing:"border-box", display:"block",
            background:iBg, border:`1px solid ${iBorder}`, borderRadius:"8px",
            padding:"16px", color:txt, fontSize:"14px", lineHeight:"1.7",
            resize:"vertical", outline:"none", fontFamily:"Georgia,serif",
            verticalAlign:"top",
          }}
        />
        {speech && <div style={{fontSize:"12px",color:muted,marginTop:"4px"}}>
          {speech.trim().split(/\s+/).length} words · {speech.trim().split(/[.!?]+/).filter(Boolean).length} sentences
        </div>}
      </div>
      {error && <div style={{color:"#fb7185",fontSize:"13px",marginTop:"12px",padding:"10px 14px",background:"rgba(251,113,133,0.08)",borderRadius:"8px",border:"1px solid rgba(251,113,133,0.2)"}}>{error}</div>}
      <button onClick={analyse} style={{...btnGold,marginTop:"22px",width:"100%",padding:"15px",fontSize:"15px",letterSpacing:"0.05em"}}>
        Analyse Speech →
      </button>
    </div>
  );

  // ── LOADING VIEW ──────────────────────────────────────────────────────────
  const renderLoading = () => (
    <div style={{background:card,border:`1px solid ${border}`,borderRadius:"16px",padding:"80px 32px",textAlign:"center"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={{fontSize:"40px",display:"inline-block",animation:"spin 1.5s linear infinite",marginBottom:"20px"}}>⟳</div>
      <div style={{fontSize:"16px",color:"#D4A853",marginBottom:"8px",animation:"pulse 2s ease-in-out infinite"}}>{loadStages[loadStage]}</div>
      <div style={{fontSize:"12px",color:muted,marginBottom:"24px"}}>Thorough analysis takes 15–25 seconds</div>
      <div style={{display:"flex",justifyContent:"center",gap:"6px"}}>
        {loadStages.map((_,i)=>(
          <div key={i} style={{width:"8px",height:"8px",borderRadius:"50%",background:i<=loadStage?"#D4A853":iBorder,transition:"background 0.4s"}}/>
        ))}
      </div>
    </div>
  );

  // ── HISTORY VIEW ──────────────────────────────────────────────────────────
  const renderHistory = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <div>
          <h2 style={{margin:"0 0 4px",fontSize:"20px",fontWeight:"600",color:txt}}>Analysis History</h2>
          <p style={{margin:0,fontSize:"13px",color:muted}}>{history.length} saved {history.length===1?"analysis":"analyses"}</p>
        </div>
        {history.length > 0 && (
          <button onClick={async()=>{setHistory([]);try{await window.storage.set("rhetoriq-history","[]");}catch{}}}
            style={{...btnGhost,padding:"7px 14px",fontSize:"12px",borderColor:"rgba(251,113,133,0.3)",color:"#fb7185"}}>
            Clear All
          </button>
        )}
      </div>
      {!historyLoaded && <div style={{color:muted,textAlign:"center",padding:"40px"}}>Loading history…</div>}
      {historyLoaded && history.length === 0 && (
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"16px",padding:"60px 32px",textAlign:"center"}}>
          <div style={{fontSize:"40px",marginBottom:"16px"}}>📂</div>
          <div style={{fontSize:"16px",color:muted,marginBottom:"8px"}}>No analyses yet</div>
          <div style={{fontSize:"13px",color:muted,marginBottom:"24px"}}>Your past speech analyses will appear here automatically.</div>
          <button onClick={()=>setView("home")} style={{...btnGold,padding:"10px 24px",fontSize:"14px"}}>Analyse a Speech →</button>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        {history.map(item => (
          <div key={item.id} style={{background:card,border:`1px solid ${iBorder}`,borderRadius:"12px",padding:"18px 20px",display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:"200px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}}>
                <span style={{fontSize:"15px",fontWeight:"600",color:txt}}>{item.event}</span>
                <span style={{fontSize:"20px",fontWeight:"700",color:scC(item.score)}}>{item.score}<span style={{fontSize:"11px",color:muted}}>/100</span></span>
              </div>
              <div style={{fontSize:"12px",color:muted,marginBottom:"6px"}}>
                {new Date(item.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                {item.wordCount ? ` · ${item.wordCount} words` : ""}
                {item.analysis?.overview?.detectedFormality ? ` · ${item.analysis.overview.detectedFormality}` : ""}
              </div>
              <div style={{fontSize:"12px",color:muted,fontStyle:"italic",lineHeight:1.5}}>{item.preview}</div>
            </div>
            <div style={{display:"flex",gap:"8px",flexShrink:0}}>
              <button onClick={()=>loadHistoryItem(item)}
                style={{...btnGold,padding:"8px 16px",fontSize:"12px"}}>View →</button>
              <button onClick={()=>deleteHistory(item.id)}
                style={{background:"rgba(251,113,133,0.08)",border:"1px solid rgba(251,113,133,0.2)",color:"#fb7185",padding:"8px 12px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif"}}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── RESULTS VIEW ──────────────────────────────────────────────────────────
  const renderResults = () => {
    if (!analysis) return null;
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
          <button onClick={()=>{setView("home");setAnalysis(null);setShowEnhanced(false);setSpeech("");setEvent("");setFormality("");setPurpose("");setAudience("");}}
            style={{...btnGhost,padding:"8px 16px",fontSize:"13px"}}>← New Analysis</button>
          <button onClick={()=>exportPDF(analysis,speech,{event,formality,purpose,audience})}
            style={{...btnGold,padding:"8px 20px",fontSize:"13px"}}>⬇ Export PDF</button>
        </div>

        {/* Score hero */}
        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"16px",padding:"28px 36px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"32px",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:"170px"}}>
            <div style={{fontSize:"11px",color:muted,marginBottom:"5px"}}>
              {[analysis.overview.detectedEvent,analysis.overview.detectedFormality,analysis.overview.estimatedDeliveryTime].filter(Boolean).join(" · ")}
            </div>
            <div style={{fontSize:"44px",fontWeight:"700",color:"#D4A853",lineHeight:1}}>
              {analysis.overview.overallScore}<span style={{fontSize:"15px",color:muted}}>/100</span>
            </div>
            <div style={{fontSize:"10px",color:muted,marginTop:"3px",marginBottom:"10px"}}>Overall Score</div>
            <p style={{fontSize:"13px",color:muted,margin:0,lineHeight:1.6}}>{analysis.overview.summary}</p>
          </div>
          <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}>
            <ScoreRing score={analysis.persuasion.logos.score} label="Logos" color="teal" trackColor={track} textColor={txt}/>
            <ScoreRing score={analysis.persuasion.ethos.score} label="Ethos" color="violet" trackColor={track} textColor={txt}/>
            <ScoreRing score={analysis.persuasion.pathos.score} label="Pathos" color="rose" trackColor={track} textColor={txt}/>
            <ScoreRing score={analysis.persuasion.overallPersuasivenessScore} label="Persuasion" color="gold" trackColor={track} textColor={txt}/>
          </div>
        </div>

        {/* Tabs */}
        <div style={{background:D?"rgba(15,23,42,0.6)":"#e2e8f0",border:`1px solid ${iBorder}`,borderRadius:"10px",padding:"5px",display:"flex",gap:"2px",marginBottom:"14px",flexWrap:"wrap"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{padding:"7px 12px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"600",transition:"all 0.2s",
                background:activeTab===t.id?"#D4A853":"transparent",
                color:activeTab===t.id?"#0f172a":muted,fontFamily:"Georgia,serif"}}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{background:card,border:`1px solid ${border}`,borderRadius:"16px",padding:"28px"}}>

          {/* OVERVIEW */}
          {activeTab==="overview" && (
            <div>
              <h2 style={{margin:"0 0 20px",fontSize:"18px",fontWeight:"600",color:txt}}>Speech Overview</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"10px",marginBottom:"20px"}}>
                {[["Word Count",analysis.overview.wordCount],["Sentences",analysis.overview.sentenceCount],
                  ["Avg Length",analysis.overview.avgSentenceLength+" words"],["Readability",analysis.overview.readabilityLevel],
                  ["Delivery",analysis.overview.estimatedDeliveryTime],["Purpose",analysis.overview.detectedPurpose],
                  ["Audience",analysis.overview.detectedAudience],["Formality",analysis.overview.detectedFormality]
                ].map(([l,v])=>(
                  <div key={l} style={{background:iBg,borderRadius:"9px",padding:"12px",border:`1px solid ${iBorder}`}}>
                    <div style={{fontSize:"9px",color:"#D4A853",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"4px"}}>{l}</div>
                    <div style={{fontSize:"13px",fontWeight:"600",color:txt}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:D?"rgba(212,168,83,0.05)":"#fef9ec",borderLeft:"3px solid #D4A853",padding:"14px 18px",borderRadius:"0 8px 8px 0"}}>
                <p style={{margin:0,lineHeight:1.7,color:D?"#cbd5e1":"#374151",fontSize:"14px"}}>{analysis.overview.summary}</p>
              </div>
            </div>
          )}

          {/* PERSUASION */}
          {activeTab==="persuasion" && (
            <div>
              <h2 style={{margin:"0 0 5px",fontSize:"18px",fontWeight:"600",color:txt}}>Rhetorical Analysis</h2>
              <p style={{color:muted,marginBottom:"20px",fontSize:"13px"}}>Aristotle's three modes of persuasion</p>
              {[
                {key:"logos",label:"Logos",sub:"Logic & Evidence",color:"#2DD4BF",icon:"⚖️"},
                {key:"ethos",label:"Ethos",sub:"Credibility & Trust",color:"#A78BFA",icon:"🎓"},
                {key:"pathos",label:"Pathos",sub:"Emotion & Connection",color:"#FB7185",icon:"❤️"},
              ].map(({key,label,sub,color,icon})=>{
                const d=analysis.persuasion[key];
                return (
                  <div key={key} style={{border:`1px solid ${color}30`,borderRadius:"12px",padding:"18px",marginBottom:"14px",background:`${color}07`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px",flexWrap:"wrap",gap:"8px"}}>
                      <div>
                        <div style={{fontSize:"15px",fontWeight:"600",color}}>{icon} {label}</div>
                        <div style={{fontSize:"12px",color:muted}}>{sub}</div>
                      </div>
                      <div style={{fontSize:"24px",fontWeight:"700",color}}>{d.score}<span style={{fontSize:"12px",color:muted}}>/100</span></div>
                    </div>
                    <p style={{color:D?"#cbd5e1":"#374151",lineHeight:1.7,marginBottom:"10px",fontSize:"13px"}}>{d.analysis}</p>
                    {d.instances?.length>0&&(
                      <div style={{marginBottom:"10px"}}>
                        <div style={{fontSize:"9px",color:muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"6px"}}>Identified Instances</div>
                        {d.instances.map((ins,i)=>(
                          <div key={i} style={{background:D?"rgba(0,0,0,0.3)":"#f8fafc",borderRadius:"7px",padding:"8px 11px",marginBottom:"5px",border:`1px solid ${iBorder}`}}>
                            <div style={{fontSize:"12px",fontStyle:"italic",marginBottom:"3px",color:txt}}>"{ins.text}"</div>
                            <div style={{fontSize:"11px",color:muted}}>{ins.comment}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.suggestions?.map((s,i)=><Sugg key={i} text={s}/>)}
                  </div>
                );
              })}
            </div>
          )}

          {/* LINGUISTIC */}
          {activeTab==="linguistic" && (
            <div>
              <h2 style={{margin:"0 0 18px",fontSize:"18px",fontWeight:"600",color:txt}}>Linguistic Analysis</h2>
              {[
                {title:"Syntax & Sentence Structure",score:analysis.linguistic.syntax.score,body:(
                  <>
                    <p style={{color:D?"#cbd5e1":"#374151",fontSize:"13px",lineHeight:1.7,marginBottom:"10px"}}>{analysis.linguistic.syntax.analysis}</p>
                    {analysis.linguistic.syntax.patterns?.length>0&&<div style={{marginBottom:"10px"}}><div style={{fontSize:"9px",color:muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"6px"}}>Patterns Detected</div><div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{analysis.linguistic.syntax.patterns.map((p,i)=><span key={i} style={{background:"rgba(45,212,191,0.1)",color:"#2DD4BF",padding:"2px 8px",borderRadius:"4px",fontSize:"11px"}}>{p}</span>)}</div></div>}
                    {analysis.linguistic.syntax.suggestions?.map((s,i)=><Sugg key={i} text={s}/>)}
                  </>
                )},
                {title:"Lexical Choices",score:analysis.linguistic.lexicalChoices.score,body:(
                  <>
                    <p style={{color:D?"#cbd5e1":"#374151",fontSize:"13px",lineHeight:1.7,marginBottom:"10px"}}>{analysis.linguistic.lexicalChoices.analysis}</p>
                    {analysis.linguistic.lexicalChoices.powerWords?.length>0&&<div style={{marginBottom:"11px"}}><div style={{fontSize:"9px",color:muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"6px"}}>Strong Choices</div><div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{analysis.linguistic.lexicalChoices.powerWords.map((w,i)=><span key={i} style={{background:"rgba(212,168,83,0.15)",color:"#D4A853",padding:"2px 8px",borderRadius:"4px",fontSize:"11px",fontWeight:"600"}}>{w}</span>)}</div></div>}
                    {analysis.linguistic.lexicalChoices.weakWords?.length>0&&<div style={{marginBottom:"11px"}}><div style={{fontSize:"9px",color:muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"6px"}}>Words to Strengthen</div>{analysis.linguistic.lexicalChoices.weakWords.map((w,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"4px",fontSize:"13px"}}><span style={{color:"#fb7185",textDecoration:"line-through"}}>{w.word}</span><span style={{color:muted}}>→</span><span style={{color:"#2DD4BF"}}>{w.suggestion}</span></div>)}</div>}
                    {analysis.linguistic.lexicalChoices.suggestions?.map((s,i)=><Sugg key={i} text={s}/>)}
                  </>
                )},
                {title:"Register & Tone",score:null,body:(
                  <>
                    <div style={{display:"flex",gap:"10px",marginBottom:"10px",flexWrap:"wrap"}}>
                      <Chip label="Current" val={analysis.linguistic.register.current} bg={iBg} border={iBorder} textColor={txt}/>
                      <Chip label="Appropriate?" val={analysis.linguistic.register.appropriate?"Yes ✓":"Needs adjustment"} color={analysis.linguistic.register.appropriate?"#2DD4BF":"#fb7185"} bg={iBg} border={iBorder} textColor={txt}/>
                    </div>
                    <p style={{color:D?"#cbd5e1":"#374151",fontSize:"13px",lineHeight:1.7,marginBottom:"8px"}}>{analysis.linguistic.register.analysis}</p>
                    {!analysis.linguistic.register.appropriate&&<Sugg text={analysis.linguistic.register.suggestion}/>}
                  </>
                )},
                {title:"Cohesion & Flow",score:analysis.linguistic.cohesion.score,body:(
                  <>
                    <p style={{color:D?"#cbd5e1":"#374151",fontSize:"13px",lineHeight:1.7,marginBottom:"10px"}}>{analysis.linguistic.cohesion.analysis}</p>
                    {analysis.linguistic.cohesion.suggestions?.map((s,i)=><Sugg key={i} text={s}/>)}
                  </>
                )},
              ].map(({title,score,body})=>(
                <div key={title} style={{border:`1px solid ${iBorder}`,borderRadius:"11px",padding:"16px",marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"11px"}}>
                    <div style={{fontWeight:"600",fontSize:"14px",color:txt}}>{title}</div>
                    {score!=null&&<div style={{fontSize:"17px",fontWeight:"700",color:scC(score)}}>{score}<span style={{fontSize:"11px",color:muted}}>/100</span></div>}
                  </div>
                  {body}
                </div>
              ))}
            </div>
          )}

          {/* IMPROVEMENTS */}
          {activeTab==="improvements" && (
            <div>
              <h2 style={{margin:"0 0 5px",fontSize:"18px",fontWeight:"600",color:txt}}>Priority Improvements</h2>
              <p style={{color:muted,marginBottom:"18px",fontSize:"13px"}}>Specific line-by-line edits to elevate your speech</p>
              {(!analysis.improvements||!analysis.improvements.length)&&<p style={{color:muted}}>No major improvements needed — excellent work!</p>}
              {analysis.improvements?.map((imp,i)=>(
                <div key={i} style={{border:`1px solid ${iBorder}`,borderRadius:"11px",padding:"15px",marginBottom:"11px",background:D?"rgba(255,255,255,0.02)":"#fafafa"}}>
                  <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"9px"}}>
                    <PBadge priority={imp.priority}/>
                    <span style={{fontSize:"11px",color:muted,background:D?"rgba(255,255,255,0.06)":"#f1f5f9",padding:"2px 8px",borderRadius:"4px"}}>{imp.category}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
                    <div style={{background:"rgba(251,113,133,0.08)",borderRadius:"7px",padding:"9px",border:"1px solid rgba(251,113,133,0.2)"}}>
                      <div style={{fontSize:"9px",color:"#fb7185",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"4px"}}>Original</div>
                      <div style={{fontSize:"12px",lineHeight:1.6,fontStyle:"italic",color:txt}}>"{imp.originalText}"</div>
                    </div>
                    <div style={{background:"rgba(45,212,191,0.08)",borderRadius:"7px",padding:"9px",border:"1px solid rgba(45,212,191,0.2)"}}>
                      <div style={{fontSize:"9px",color:"#2DD4BF",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"4px"}}>Improved</div>
                      <div style={{fontSize:"12px",lineHeight:1.6,fontStyle:"italic",color:txt}}>"{imp.improvedText}"</div>
                    </div>
                  </div>
                  <p style={{fontSize:"12px",color:muted,margin:0,lineHeight:1.6}}>{imp.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* ENHANCED */}
          {activeTab==="enhanced" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"15px",flexWrap:"wrap",gap:"8px"}}>
                <div>
                  <h2 style={{margin:"0 0 3px",fontSize:"18px",fontWeight:"600",color:txt}}>Enhanced Script</h2>
                  <p style={{color:muted,fontSize:"12px",margin:0}}>AI-improved version preserving your voice</p>
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={()=>setShowEnhanced(!showEnhanced)}
                    style={{background:"rgba(212,168,83,0.1)",border:"1px solid rgba(212,168,83,0.3)",color:"#D4A853",padding:"6px 12px",borderRadius:"7px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif"}}>
                    {showEnhanced?"Show Original":"Show Enhanced"}
                  </button>
                  <button onClick={()=>copyText(showEnhanced?analysis.enhancedScript:speech)}
                    style={{background:iBg,border:`1px solid ${iBorder}`,color:muted,padding:"6px 12px",borderRadius:"7px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif"}}>
                    {copied?"✓ Copied":"Copy"}
                  </button>
                </div>
              </div>
              <div style={{background:D?"rgba(0,0,0,0.4)":"#f8fafc",borderRadius:"10px",padding:"20px",lineHeight:"1.9",fontSize:"14px",color:D?"#cbd5e1":"#374151",border:`1px solid ${iBorder}`,whiteSpace:"pre-wrap"}}>
                {showEnhanced?analysis.enhancedScript:speech}
              </div>
            </div>
          )}

          {/* QUESTIONS */}
          {activeTab==="questions" && (
            <div>
              <h2 style={{margin:"0 0 5px",fontSize:"18px",fontWeight:"600",color:txt}}>Questions to Consider</h2>
              <p style={{color:muted,marginBottom:"20px",fontSize:"13px"}}>Prepare for audience questions, deepen your thinking, and anticipate challenges</p>
              {[
                {type:"audience",label:"Likely Audience Questions",color:"#2DD4BF",icon:"👥"},
                {type:"reflective",label:"Reflective Prompts",color:"#A78BFA",icon:"💭"},
                {type:"critical",label:"Critical Challenges",color:"#FB7185",icon:"⚡"},
              ].map(({type,label,color,icon})=>{
                const qs=analysis.potentialQuestions?.filter(q=>q.type===type)||[];
                if(!qs.length)return null;
                return (
                  <div key={type} style={{marginBottom:"22px"}}>
                    <div style={{fontSize:"11px",color,marginBottom:"9px",letterSpacing:"0.05em",fontWeight:"600"}}>{icon} {label}</div>
                    {qs.map((q,i)=>(
                      <div key={i} style={{border:`1px solid ${color}25`,borderRadius:"9px",padding:"13px",marginBottom:"8px",background:`${color}06`}}>
                        <div style={{fontSize:"14px",marginBottom:"5px",lineHeight:1.5,fontWeight:"500",color:txt}}>"{q.question}"</div>
                        <div style={{fontSize:"12px",color:muted,lineHeight:1.5}}>💡 {q.tip}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    );
  };

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",width:"100%",background:bg,fontFamily:"Georgia,serif",color:txt,transition:"background 0.3s"}}>
      {D&&<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse at 20% 20%,rgba(212,168,83,0.05) 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(45,212,191,0.03) 0%,transparent 60%)"}}/>}
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:"1200px",margin:"0 auto",padding:"32px 40px"}}>
        {renderNav()}
        {loading && renderLoading()}
        {!loading && (view==="home" || view==="analyse") && renderHome()}
        {!loading && view==="history" && renderHistory()}
        {!loading && view==="results" && renderResults()}
      </div>
    </div>
  );
}
