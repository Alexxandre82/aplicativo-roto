"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const SESSAO_KEY = "roto_sessao_ativa";

type SessaoSalva = {
  atividadeId: string;
  atividadeNome: string;
  inicio: string;
};

// ─── Logo inline ─────────────────────────────────────────────────────────────
function RotoLogo() {
  return (
    <img
      src="/logo.png"
      alt="Roto Fermax"
      className="roto-header-logo"
    />
  );
}

export default function OperadorPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);

  const [busca, setBusca] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedActivityNome, setSelectedActivityNome] = useState("");
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [inicio, setInicio] = useState<Date | null>(null);
  const [tempo, setTempo] = useState(0);

  const [confirmando, setConfirmando] = useState(false);
  const [ajusteManual, setAjusteManual] = useState(false);
  const [minutosManuais, setMinutosManuais] = useState("");

  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [sessaoRecuperada, setSessaoRecuperada] = useState(false);

  const confirmacaoRef = useRef<HTMLDivElement>(null);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { router.replace("/login"); return; }
    const profile = JSON.parse(savedUser);
    setUser(profile);
    loadActivities(profile);
    loadHistorico(profile.id);
  }, [router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (confirmando && confirmacaoRef.current) {
      setTimeout(() => {
        confirmacaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [confirmando]);

  // ─── Carregar atividades ──────────────────────────────────────────────────
  async function loadActivities(profile: any) {
    const { data } = await supabase
      .from("activity_catalog")
      .select("id, nome, categoria, setor, impacto")
      .order("nome", { ascending: true });
    if (data) { setActivities(data); tentarRecuperarSessao(data); }
  }

  function tentarRecuperarSessao(lista: any[]) {
    try {
      const raw = localStorage.getItem(SESSAO_KEY);
      if (!raw) return;
      const sessao: SessaoSalva = JSON.parse(raw);
      const atividadeExiste = lista.find((a) => a.id === sessao.atividadeId);
      if (!atividadeExiste) { localStorage.removeItem(SESSAO_KEY); return; }
      const inicioRecuperado = new Date(sessao.inicio);
      const agora = new Date();
      const diffHoras = (agora.getTime() - inicioRecuperado.getTime()) / 3600000;
      if (diffHoras > 12) { localStorage.removeItem(SESSAO_KEY); return; }
      setSelectedActivity(sessao.atividadeId);
      setSelectedActivityNome(sessao.atividadeNome);
      setInicio(inicioRecuperado);
      setTempo(Math.floor((agora.getTime() - inicioRecuperado.getTime()) / 1000));
      setSessaoRecuperada(true);
    } catch { localStorage.removeItem(SESSAO_KEY); }
  }

  // ─── Cronômetro ───────────────────────────────────────────────────────────
  useEffect(() => {
    let interval: any;
    if (inicio && !confirmando) {
      interval = setInterval(() => {
        setTempo(Math.floor((Date.now() - inicio.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [inicio, confirmando]);

  // ─── Histórico ────────────────────────────────────────────────────────────
  async function loadHistorico(userId: string) {
    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
    const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("operator_id", userId)
      .gte("inicio", inicioDia.toISOString())
      .lte("inicio", fimDia.toISOString())
      .order("inicio", { ascending: false });
    if (data) setHistorico(data);
  }

  // ─── Ações ────────────────────────────────────────────────────────────────
  function selecionarAtividade(a: any) {
    setSelectedActivity(a.id);
    setSelectedActivityNome(a.nome);
    setBusca("");
    setDropdownAberto(false);
  }

  function iniciar() {
    if (!selectedActivity) { alert("Selecione uma atividade."); return; }
    const agora = new Date();
    setInicio(agora);
    setTempo(0);
    setConfirmando(false);
    setAjusteManual(false);
    setMinutosManuais("");
    setSessaoRecuperada(false);
    localStorage.setItem(SESSAO_KEY, JSON.stringify({
      atividadeId: selectedActivity,
      atividadeNome: selectedActivityNome,
      inicio: agora.toISOString(),
    }));
  }

  function abrirConfirmacao() {
    const minutosCalculados = Math.max(1, Math.ceil(tempo / 60));
    setMinutosManuais(String(minutosCalculados));
    setConfirmando(true);
  }

  async function salvarAtividade() {
    if (!inicio || !user) return;
    const fim = new Date();
    const minutosCalculados = Math.max(1, Math.ceil((fim.getTime() - inicio.getTime()) / 60000));
    const minutosFinal = ajusteManual ? Number(minutosManuais) : minutosCalculados;
    if (!minutosFinal || minutosFinal < 1) { alert("Informe um tempo válido."); return; }
    const atividade = activities.find((a) => a.id === selectedActivity);
    if (!atividade) { alert("Atividade não encontrada."); return; }
    const { error } = await supabase.from("activity_logs").insert([{
      operator_id: user.id,
      atividade_nome: atividade.nome,
      categoria: atividade.categoria,
      setor: atividade.setor,
      impacto: atividade.impacto,
      motivo: ajusteManual ? "Esqueci o celular / ajuste manual" : null,
      observacao: ajusteManual ? `Tempo ajustado manualmente para ${minutosFinal} minutos.` : null,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      duration_minutes: minutosFinal,
      manual_adjusted: ajusteManual,
      session_id: crypto.randomUUID(),
    }]);
    if (error) { alert("Erro ao salvar: " + error.message); return; }
    localStorage.removeItem(SESSAO_KEY);
    resetar();
    await loadHistorico(user.id);
  }

  function resetar() {
    setInicio(null); setTempo(0);
    setSelectedActivity(""); setSelectedActivityNome("");
    setBusca(""); setConfirmando(false);
    setAjusteManual(false); setMinutosManuais("");
    setSessaoRecuperada(false);
  }

  function cancelarAtividade() { localStorage.removeItem(SESSAO_KEY); resetar(); }

  // ─── Formatação ───────────────────────────────────────────────────────────
  function formatarTempo(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  }

  function formatarHora(data: string) {
    return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const minutosCalculados = Math.max(1, Math.ceil(tempo / 60));
  const atividadesFiltradas = activities.filter((a) =>
    a.nome.toLowerCase().includes(busca.toLowerCase())
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="roto-page">

      {/* ── Header ── */}
      <header className="roto-header">
        <RotoLogo />
        <div className="roto-header-user">
          <button
            onClick={() => { localStorage.removeItem("user"); router.replace("/login"); }}
            className="roto-button-secondary"
            style={{ padding: "6px 14px", fontSize: 12, borderColor: "rgba(255,255,255,0.4)", color: "#fff", background: "rgba(255,255,255,0.15)" }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 48px" }}>

        {/* Painel label */}
        <div style={{ marginBottom: 16 }}>
          <p className="roto-label">Painel do Operador</p>
          <h1 className="roto-title" style={{ fontSize: "clamp(22px,5vw,30px)", marginTop: 4 }}>
            {user?.nome || "Operador"}
          </h1>
        </div>

        {/* Sessão recuperada */}
        {sessaoRecuperada && inicio && (
          <div className="roto-card-red" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "var(--roto-red)", margin: 0 }}>
                  Sessão recuperada
                </p>
                <p className="roto-muted" style={{ marginTop: 2 }}>
                  Cronômetro retomado desde {formatarHora(inicio.toISOString())}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Sem atividade ── */}
        {!inicio ? (
          <div className="roto-card-primary">
            <p className="roto-label" style={{ marginBottom: 12 }}>Selecione a atividade</p>

            <div className="relative" ref={dropdownRef}>
              <input
                ref={buscaRef}
                type="text"
                className="roto-input"
                placeholder={selectedActivityNome || "Buscar atividade..."}
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setDropdownAberto(true); }}
                onFocus={() => setDropdownAberto(true)}
                autoComplete="off"
              />

              {dropdownAberto && (
                <div
                  className="absolute w-full mt-1 z-50"
                  style={{
                    background: "#fff",
                    border: "1.5px solid var(--border-hi)",
                    borderRadius: "var(--radius-sm)",
                    boxShadow: "var(--shadow-md)",
                    maxHeight: "52dvh",
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {atividadesFiltradas.length === 0 ? (
                    <p style={{ padding: "14px 16px", color: "var(--muted)", fontSize: 14 }}>
                      Nenhuma atividade encontrada.
                    </p>
                  ) : (
                    atividadesFiltradas.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => selecionarAtividade(a)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "13px 16px",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          background: a.id === selectedActivity ? "var(--primary-light)" : "transparent",
                          color: a.id === selectedActivity ? "var(--primary)" : "var(--text)",
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 15,
                          fontWeight: a.id === selectedActivity ? 700 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {a.nome}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedActivityNome && !dropdownAberto && (
              <div style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: "var(--primary-light)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(0,119,182,0.2)",
              }}>
                <span style={{ color: "var(--primary)", fontSize: 16 }}>✔</span>
                <span style={{ color: "var(--primary)", fontSize: 14, fontWeight: 600 }}>
                  {selectedActivityNome}
                </span>
              </div>
            )}

            <button
              onClick={iniciar}
              disabled={!selectedActivity}
              className="roto-button-cta"
              style={{ marginTop: 16 }}
            >
              ▶ Iniciar atividade
            </button>
          </div>

        ) : (
          <>
            {/* ── Em andamento ── */}
            <div className="roto-card-teal" style={{ textAlign: "center" }}>
              <span className="roto-badge roto-badge-teal" style={{ marginBottom: 8 }}>
                ● Em andamento
              </span>

              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginTop: 8,
                marginBottom: 4,
              }}>
                {selectedActivityNome}
              </p>

              <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />

              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(64px, 20vw, 88px)",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: confirmando ? "var(--muted)" : "var(--primary)",
                margin: "8px 0 16px",
                opacity: confirmando ? 0.4 : 1,
                lineHeight: 1,
              }}>
                {formatarTempo(tempo)}
              </p>

              {!confirmando && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={abrirConfirmacao} className="roto-button-danger">
                    ⏹ Finalizar atividade
                  </button>
                  <button onClick={cancelarAtividade} className="roto-button-secondary" style={{ width: "100%" }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* ── Confirmação (abaixo do timer) ── */}
            {confirmando && (
              <div ref={confirmacaoRef} className="roto-card-primary" style={{ marginTop: 16 }}>
                <p className="roto-label" style={{ marginBottom: 8 }}>Confirmar finalização</p>
                <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 16 }}>
                  {selectedActivityNome}
                </p>

                {/* Tempo em destaque */}
                <div style={{
                  textAlign: "center",
                  background: "var(--primary-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "20px 16px",
                  marginBottom: 16,
                }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 72, fontWeight: 900, color: "var(--primary)", margin: 0, lineHeight: 1 }}>
                    {minutosCalculados}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>minutos registrados</p>
                </div>

                {/* Checkbox ajuste */}
                <label style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "14px",
                  background: "var(--bg)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  marginBottom: 12,
                }}>
                  <input
                    type="checkbox"
                    checked={ajusteManual}
                    onChange={(e) => setAjusteManual(e.target.checked)}
                    style={{ marginTop: 2, accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Esqueci o celular / ajustar tempo manualmente
                  </span>
                </label>

                {ajusteManual && (
                  <div style={{ marginBottom: 12 }}>
                    <label className="roto-label" style={{ marginBottom: 6, display: "block" }}>
                      Tempo real gasto (minutos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={minutosManuais}
                      onChange={(e) => setMinutosManuais(e.target.value)}
                      className="roto-input"
                    />
                  </div>
                )}

                <button onClick={salvarAtividade} className="roto-button">
                  ✓ Salvar atividade
                </button>
                <button
                  onClick={() => { setConfirmando(false); setAjusteManual(false); }}
                  className="roto-button-secondary"
                  style={{ width: "100%", marginTop: 10 }}
                >
                  ← Continuar atividade
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Histórico ── */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setMostrarHistorico(!mostrarHistorico)}
            className="roto-button-secondary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span>Histórico de hoje ({historico.length})</span>
            <span>{mostrarHistorico ? "▲" : "▼"}</span>
          </button>

          {mostrarHistorico && (
            <div className="roto-card" style={{ marginTop: 10 }}>
              {historico.length === 0 ? (
                <p className="roto-muted" style={{ textAlign: "center", padding: "16px 0" }}>
                  Nenhuma atividade registrada hoje.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {historico.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "14px 0",
                        borderBottom: idx < historico.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.atividade_nome}
                        </p>
                        <p className="roto-muted" style={{ marginTop: 2 }}>
                          {formatarHora(item.inicio)} → {formatarHora(item.fim)}
                          {item.manual_adjusted && " · ajuste manual"}
                        </p>
                      </div>
                      <span className="roto-badge roto-badge-primary" style={{ flexShrink: 0 }}>
                        {item.duration_minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
