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

// Nova paleta azul/teal/laranja alinhada ao redesign
const CORES = ["#0077B6","#0096C7","#00B4D8","#F77F00","#F4A261","#CC0000","#48CAE4","#ADE8F4"];

const TT = {
  background: "#fff",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

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
    style={{fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
    {Math.round(percent*100)}%
  </text>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderTop: `3px solid ${color}`,
      borderRadius: "var(--radius-md)",
      padding: "18px 20px",
      boxShadow: "var(--shadow-md)",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-lg)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <p className="roto-label">{label}</p>
      </div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 900,
        color,
        margin: 0,
        lineHeight: 1,
      }}>{value}</p>
      {sub && <p className="roto-muted" style={{ marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

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

  const pctColor = pct>30 ? "var(--roto-red)" : pct>15 ? "var(--warning)" : "var(--success)";

  return (
    <div className="roto-page">

      {/* ── Header ── */}
      <header className="roto-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src="/logo.png"
            alt="Roto Fermax"
            className="roto-header-logo"
          />
          <span className="roto-header-title">Gestão</span>
        </div>
        <button
          onClick={() => { localStorage.removeItem("user"); router.replace("/login"); }}
          className="roto-button-secondary"
          style={{ padding: "6px 14px", fontSize: 12, borderColor: "rgba(255,255,255,0.4)", color: "#fff", background: "rgba(255,255,255,0.15)" }}
        >
          Sair
        </button>
      </header>

      {/* ── Conteúdo ── */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px 48px" }}>

        {/* Título + filtros */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 24 }}>
          <div>
            <p className="roto-label">Dashboard</p>
            <h1 className="roto-title" style={{ fontSize: "clamp(22px,4vw,34px)", marginTop: 4 }}>
              Trabalho Invisível
            </h1>
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              {(["dia","semana","mes"] as Periodo[]).map(p => (
                <button
                  key={p}
                  onClick={() => mudarPeriodo(p)}
                  style={{
                    padding: "9px 18px",
                    border: "none",
                    background: periodo === p ? "var(--primary)" : "transparent",
                    color: periodo === p ? "#fff" : "var(--text-secondary)",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dataFiltro}
              onChange={e => mudarData(e.target.value)}
              className="roto-input"
              style={{ maxWidth: 180, margin: 0 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 40, height: 40, border: "3px solid var(--border)",
              borderTopColor: "var(--primary)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <p className="roto-muted" style={{ fontSize: 15 }}>Carregando dados...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              <KpiCard
                icon="👥"
                label="Mão de obra disponível"
                value={formatMin(capacidade)}
                sub={diasAtivos > 1 ? `${diasAtivos} dias` : undefined}
                color="var(--primary)"
              />
              <KpiCard
                icon="⏱"
                label="Tempo invisível"
                value={formatMin(totalMin)}
                color="var(--roto-red)"
              />
              <KpiCard
                icon="📊"
                label="% do tempo em invisível"
                value={`${pct}%`}
                sub={pct > 30 ? "⚠ Atenção: acima do esperado" : pct > 15 ? "Moderado" : "Dentro do esperado"}
                color={pctColor}
              />
            </div>

            {/* Barra de progresso */}
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: 24, boxShadow: "var(--shadow-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="roto-label">Ocupação do tempo disponível</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: pctColor }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: "var(--bg)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(pct, 100)}%`,
                  background: pctColor,
                  borderRadius: 4,
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>

            {/* Alerta gargalo */}
            {top && pctTop >= 40 && (
              <div className="roto-card-red" style={{ marginBottom: 24 }}>
                <p style={{ color: "var(--roto-red)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  ⚠ Gargalo detectado
                </p>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  <strong>{top.nome}</strong> representa <strong>{pctTop}%</strong> do tempo invisível no período.
                </p>
              </div>
            )}

            {/* ── Gráficos ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginBottom: 24 }}>

              {/* Pizza */}
              {atividades.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 20, boxShadow: "var(--shadow-md)" }}>
                  <p className="roto-label" style={{ marginBottom: 16 }}>Proporção por atividade</p>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={atividades} dataKey="minutos" nameKey="nome" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={PizzaLabel}>
                          {atividades.map((_,i) => <Cell key={i} fill={CORES[i%CORES.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} min`]} contentStyle={TT}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {atividades.slice(0,6).map((a,i) => (
                      <div key={a.nome} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <div style={{ width: 10, height: 10, background: CORES[i%CORES.length], flexShrink: 0, borderRadius: 2 }}/>
                        <span style={{ color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                        <span style={{ fontWeight: 700, flexShrink: 0, color: "var(--text)" }}>{a.minutos} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Barra horizontal */}
              {atividades.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 20, boxShadow: "var(--shadow-md)" }}>
                  <p className="roto-label" style={{ marginBottom: 16 }}>Minutos por atividade</p>
                  <div style={{ width: "100%", height: Math.max(220, atividades.length * 44) }}>
                    <ResponsiveContainer>
                      <BarChart data={atividades} layout="vertical" margin={{left:0,right:20}}>
                        <XAxis type="number" tick={{fill:"var(--muted)",fontSize:12}}/>
                        <YAxis type="category" dataKey="nome" width={130} tick={{fill:"var(--text-secondary)",fontSize:12}}/>
                        <Tooltip formatter={(v) => [`${v} min`,"Tempo"]} contentStyle={TT}/>
                        <Bar dataKey="minutos" fill="var(--primary)" radius={[0,6,6,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tendência total */}
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 20, boxShadow: "var(--shadow-md)" }}>
                <p className="roto-label" style={{ marginBottom: 16 }}>Tendência total — 7 dias</p>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={tendencia}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="dia" tick={{fill:"var(--muted)",fontSize:12}}/>
                      <YAxis tick={{fill:"var(--muted)",fontSize:12}}/>
                      <Tooltip formatter={(v) => [`${v} min`]} contentStyle={TT}/>
                      <Legend wrapperStyle={{fontSize:13,fontFamily:"'Inter',sans-serif"}}/>
                      <Line type="monotone" dataKey="capacidade" stroke="var(--border-hi)" strokeDasharray="4 4" name="Capacidade/dia" dot={false}/>
                      <Line type="monotone" dataKey="minutos" stroke="var(--primary)" strokeWidth={2.5} name="Invisível" dot={{fill:"var(--primary)",r:4}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Evolução por atividade */}
              {ativsUnicas.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 20, boxShadow: "var(--shadow-md)" }}>
                  <p className="roto-label" style={{ marginBottom: 16 }}>Evolução por atividade — 7 dias</p>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <LineChart data={evolucao}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                        <XAxis dataKey="dia" tick={{fill:"var(--muted)",fontSize:12}}/>
                        <YAxis tick={{fill:"var(--muted)",fontSize:12}}/>
                        <Tooltip formatter={(v) => [`${v} min`]} contentStyle={TT}/>
                        <Legend wrapperStyle={{fontSize:12,fontFamily:"'Inter',sans-serif"}}
                          formatter={(v)=>v.length>16?v.slice(0,16)+"…":v}/>
                        {ativsUnicas.map((nome,i) => (
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

            {/* Sem dados */}
            {atividades.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>📋</p>
                <p style={{ color: "var(--muted)", fontSize: 15 }}>Nenhuma atividade registrada neste período.</p>
              </div>
            )}

            {/* Exportar */}
            {logs.length > 0 && (
              <button
                onClick={() => exportarCSV(logs, `roto-invisivel-${periodo}-${dataFiltro}.csv`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 20px",
                  background: "#fff",
                  border: "1.5px solid var(--primary)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--primary)",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  marginTop: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--primary-light)")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                ⬇ Exportar dados ({logs.length} registros) — CSV
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
