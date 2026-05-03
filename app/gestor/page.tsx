"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";

type Periodo = "dia" | "semana" | "mes";

const CORES = ["#CC0000","#e63329","#ff6b6b","#990000","#ff9999","#660000","#ffb3b3","#330000"];

function getIntervalo(periodo: Periodo, dataBase: string) {
  const [ano, mes, dia] = dataBase.split("-").map(Number);
  const base = new Date(ano, mes - 1, dia);
  if (periodo === "dia") return { inicio: new Date(ano,mes-1,dia,0,0,0), fim: new Date(ano,mes-1,dia,23,59,59) };
  if (periodo === "semana") {
    const dow = base.getDay();
    const ini = new Date(base); ini.setDate(base.getDate()-dow); ini.setHours(0,0,0,0);
    const fim = new Date(ini); fim.setDate(ini.getDate()+6); fim.setHours(23,59,59);
    return { inicio: ini, fim };
  }
  return { inicio: new Date(ano,mes-1,1,0,0,0), fim: new Date(ano,mes,0,23,59,59) };
}

function formatMin(min: number) {
  const h = Math.floor(min/60), m = min%60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function exportarCSV(logs: any[], nome: string) {
  const cab = ["Data","Hora início","Hora fim","Operador","Atividade","Categoria","Minutos","Ajuste manual"];
  const lin = logs.map(l => [
    new Date(l.inicio).toLocaleDateString("pt-BR"),
    new Date(l.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),
    new Date(l.fim).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),
    l.profiles?.nome||l.operator_id, l.atividade_nome, l.categoria||"",
    l.duration_minutes, l.manual_adjusted?"Sim":"Não",
  ]);
  const csv = [cab,...lin].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href=url; a.download=nome; a.click();
  URL.revokeObjectURL(url);
}

function PizzaLabel({cx,cy,midAngle,innerRadius,outerRadius,percent}: any) {
  if (percent < 0.08) return null;
  const R = Math.PI/180, r = innerRadius+(outerRadius-innerRadius)*0.55;
  return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)}
    fill="white" textAnchor="middle" dominantBaseline="central"
    style={{fontSize:12,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}}>
    {Math.round(percent*100)}%
  </text>;
}

const TT = { background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:4, fontFamily:"'Barlow',sans-serif", fontSize:13 };

export default function GestorPage() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [totalMin, setTotalMin] = useState(0);
  const [capacidade, setCapacidade] = useState(0);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [tendencia, setTendencia] = useState<any[]>([]);
  const [evolucao, setEvolucao] = useState<any[]>([]);
  const [ativsUnicas, setAtivsUnicas] = useState<string[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [diasAtivos, setDiasAtivos] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) { router.replace("/login"); return; }
    const p = JSON.parse(u);
    if (p.perfil !== "gestor" && p.perfil !== "admin") { router.replace("/operador"); return; }
    supabase.from("profiles").select("perfil,ativo").eq("id",p.id).maybeSingle().then(({data})=>{
      if (!data||!data.ativo||(data.perfil!=="gestor"&&data.perfil!=="admin")) {
        localStorage.removeItem("user"); router.replace("/login");
      }
    });
    loadDados(periodo, dataFiltro);
  }, [router]);

  async function loadDados(p: Periodo, data: string) {
    setLoading(true);
    const {inicio,fim} = getIntervalo(p, data);
    const {data: rawLogs} = await supabase.from("activity_logs").select("*,profiles(nome)")
      .gte("inicio",inicio.toISOString()).lte("inicio",fim.toISOString());
    const {data: ops} = await supabase.from("profiles").select("minutos_dia").eq("ativo",true).eq("perfil","operador");
    const minDia = (ops||[]).reduce((a,o)=>a+(o.minutos_dia||501),0);
    const dias = Math.round((fim.getTime()-inicio.getTime())/(1000*60*60*24))+1;
    setDiasAtivos(dias);
    setCapacidade(minDia*dias);
    const total = (rawLogs||[]).reduce((a,l)=>a+(l.duration_minutes||0),0);
    setTotalMin(total);
    setLogs(rawLogs||[]);
    const mapa: Record<string,number> = {};
    (rawLogs||[]).forEach(l=>{ const n=l.atividade_nome||"Sem nome"; mapa[n]=(mapa[n]||0)+(l.duration_minutes||0); });
    setAtividades(Object.entries(mapa).map(([nome,minutos])=>({nome,minutos})).sort((a,b)=>b.minutos-a.minutos));
    const tend: any[] = [], evol: any[] = [];
    const allAtivs = new Set<string>();
    for (let i=6;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const {inicio:iD,fim:fD} = getIntervalo("dia",d.toISOString().split("T")[0]);
      const {data: dL} = await supabase.from("activity_logs").select("duration_minutes,atividade_nome")
        .gte("inicio",iD.toISOString()).lte("inicio",fD.toISOString());
      const label = d.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit"});
      const soma = (dL||[]).reduce((a,l)=>a+(l.duration_minutes||0),0);
      tend.push({dia:label,minutos:soma,capacidade:minDia});
      const diaAtiv: any = {dia:label};
      (dL||[]).forEach(l=>{ const n=l.atividade_nome||"Sem nome"; allAtivs.add(n); diaAtiv[n]=(diaAtiv[n]||0)+(l.duration_minutes||0); });
      evol.push(diaAtiv);
    }
    setTendencia(tend);
    setAtivsUnicas(Array.from(allAtivs));
    setEvolucao(evol);
    setLoading(false);
  }

  function mudarPeriodo(p: Periodo) { setPeriodo(p); loadDados(p,dataFiltro); }
  function mudarData(d: string) { setDataFiltro(d); loadDados(periodo,d); }

  const pct = capacidade>0 ? Math.round((totalMin/capacidade)*100) : 0;
  const top = atividades[0];
  const pctTop = totalMin>0&&top ? Math.round((top.minutos/totalMin)*100) : 0;

  return (
    <main className="roto-page pb-10" style={{maxWidth:"100%"}}>

      {/* ── HEADER ── */}
      <div style={{maxWidth:1400,margin:"0 auto"}}>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <p className="roto-muted">CD Fermax</p>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:900,letterSpacing:"0.04em",textTransform:"uppercase",margin:0,lineHeight:1}}>
              Trabalho Invisível
            </h1>
          </div>
          <button onClick={()=>{localStorage.removeItem("user");router.replace("/login");}} className="roto-button-secondary">Sair</button>
        </div>

        {/* ── FILTROS ── */}
        <div className="roto-card mb-6" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:8,flex:1,minWidth:240}}>
            {(["dia","semana","mes"] as Periodo[]).map(p=>(
              <button key={p} onClick={()=>mudarPeriodo(p)} style={{
                flex:1,padding:"12px 8px",border:periodo===p?"2px solid var(--roto-red)":"1px solid var(--border)",
                background:periodo===p?"var(--roto-red-bg)":"transparent",
                color:periodo===p?"var(--roto-red)":"#444444",
                fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,
                letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",borderRadius:4,
              }}>
                {p==="dia"?"Dia":p==="semana"?"Semana":"Mês"}
              </button>
            ))}
          </div>
          <input type="date" value={dataFiltro} onChange={e=>mudarData(e.target.value)}
            className="roto-input" style={{maxWidth:200,margin:0}} />
        </div>

        {loading ? (
          <div className="roto-card text-center py-16">
            <p className="roto-muted" style={{fontSize:16}}>Carregando dados...</p>
          </div>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:24}}>
              {/* Disponível */}
              <div className="roto-card text-center" style={{borderTop:"3px solid var(--border-hi)"}}>
                <p className="roto-muted" style={{fontSize:14}}>Mão de obra disponível</p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(32px,4vw,52px)",fontWeight:900,margin:"8px 0 0",lineHeight:1}}>{formatMin(capacidade)}</p>
                {diasAtivos>1&&<p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>{diasAtivos} dias</p>}
              </div>
              {/* Invisível */}
              <div className="roto-card text-center" style={{borderTop:"3px solid var(--roto-red)"}}>
                <p className="roto-muted" style={{fontSize:14}}>Tempo invisível</p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(32px,4vw,52px)",fontWeight:900,margin:"8px 0 0",lineHeight:1,color:"var(--roto-red)"}}>{formatMin(totalMin)}</p>
              </div>
              {/* Percentual */}
              <div className="roto-card text-center" style={{borderTop:`3px solid ${pct>30?"var(--danger)":pct>15?"#d97706":"var(--roto-red)"}`}}>
                <p className="roto-muted" style={{fontSize:14}}>% do tempo em invisível</p>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(32px,4vw,52px)",fontWeight:900,margin:"8px 0 0",lineHeight:1,color:pct>30?"var(--danger)":pct>15?"#d97706":"var(--roto-red)"}}>{pct}%</p>
                <div style={{height:6,background:"var(--border)",borderRadius:2,marginTop:12,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:pct>30?"var(--danger)":pct>15?"#d97706":"var(--roto-red)",transition:"width 0.5s"}}/>
                </div>
              </div>
            </div>

            {/* Alerta */}
            {top&&pctTop>=40&&(
              <div className="roto-card mb-6" style={{borderLeft:"4px solid var(--danger)",borderTop:"1px solid var(--border)"}}>
                <p style={{color:"var(--danger)",fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase"}}>⚠ Gargalo detectado</p>
                <p style={{fontSize:15,marginTop:4}}><strong>{top.nome}</strong> representa <strong>{pctTop}%</strong> do tempo invisível no período.</p>
              </div>
            )}

            {/* ── GRÁFICOS 2 COLUNAS ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:20,marginBottom:20}}>

              {/* Pizza */}
              {atividades.length>0&&(
                <div className="roto-card">
                  <p className="roto-muted" style={{fontSize:14,marginBottom:16}}>Proporção por atividade</p>
                  <div style={{width:"100%",height:260}}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={atividades} dataKey="minutos" nameKey="nome" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={PizzaLabel}>
                          {atividades.map((_,i)=><Cell key={i} fill={CORES[i%CORES.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v)=>[`${v} min`]} contentStyle={TT}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                    {atividades.map((a,i)=>(
                      <div key={a.nome} style={{display:"flex",alignItems:"center",gap:8,fontSize:14}}>
                        <div style={{width:10,height:10,background:CORES[i%CORES.length],flexShrink:0,borderRadius:2}}/>
                        <span style={{color:"var(--text-secondary)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nome}</span>
                        <span style={{fontWeight:700,flexShrink:0}}>{a.minutos} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Barra horizontal */}
              {atividades.length>0&&(
                <div className="roto-card">
                  <p className="roto-muted" style={{fontSize:14,marginBottom:16}}>Minutos por atividade</p>
                  <div style={{width:"100%",height:Math.max(220,atividades.length*44)}}>
                    <ResponsiveContainer>
                      <BarChart data={atividades} layout="vertical" margin={{left:0,right:20}}>
                        <XAxis type="number" tick={{fill:"var(--muted)",fontSize:12}}/>
                        <YAxis type="category" dataKey="nome" width={130} tick={{fill:"var(--text-secondary)",fontSize:13}}/>
                        <Tooltip formatter={(v)=>[`${v} min`,"Tempo"]} contentStyle={TT}/>
                        <Bar dataKey="minutos" fill="var(--roto-red)" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tendência total */}
              <div className="roto-card">
                <p className="roto-muted" style={{fontSize:14,marginBottom:16}}>Tendência total — 7 dias</p>
                <div style={{width:"100%",height:260}}>
                  <ResponsiveContainer>
                    <LineChart data={tendencia}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="dia" tick={{fill:"var(--muted)",fontSize:12}}/>
                      <YAxis tick={{fill:"var(--muted)",fontSize:12}}/>
                      <Tooltip formatter={(v)=>[`${v} min`]} contentStyle={TT}/>
                      <Legend wrapperStyle={{fontSize:13,fontFamily:"'Barlow Condensed',sans-serif"}}/>
                      <Line type="monotone" dataKey="capacidade" stroke="var(--border-hi)" strokeDasharray="4 4" name="Capacidade/dia" dot={false}/>
                      <Line type="monotone" dataKey="minutos" stroke="var(--roto-red)" strokeWidth={2} name="Invisível" dot={{fill:"var(--roto-red)",r:4}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Evolução por atividade */}
              {ativsUnicas.length>0&&(
                <div className="roto-card">
                  <p className="roto-muted" style={{fontSize:14,marginBottom:16}}>Evolução por atividade — 7 dias</p>
                  <div style={{width:"100%",height:260}}>
                    <ResponsiveContainer>
                      <LineChart data={evolucao}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                        <XAxis dataKey="dia" tick={{fill:"var(--muted)",fontSize:12}}/>
                        <YAxis tick={{fill:"var(--muted)",fontSize:12}}/>
                        <Tooltip formatter={(v)=>[`${v} min`]} contentStyle={TT}/>
                        <Legend wrapperStyle={{fontSize:12,fontFamily:"'Barlow Condensed',sans-serif"}}
                          formatter={(v)=>v.length>16?v.slice(0,16)+"…":v}/>
                        {ativsUnicas.map((nome,i)=>(
                          <Line key={nome} type="monotone" dataKey={nome}
                            stroke={CORES[i%CORES.length]} strokeWidth={2} connectNulls
                            dot={{fill:CORES[i%CORES.length],r:3}}/>
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {atividades.length===0&&(
              <div className="roto-card text-center py-12">
                <p style={{color:"var(--muted)",fontSize:16}}>Nenhuma atividade registrada neste período.</p>
              </div>
            )}

            {logs.length>0&&(
              <button onClick={()=>exportarCSV(logs,`roto-invisivel-${periodo}-${dataFiltro}.csv`)} className="roto-button-secondary w-full" style={{fontSize:14,padding:"14px"}}>
                ⬇ Exportar dados ({logs.length} registros) — CSV
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
