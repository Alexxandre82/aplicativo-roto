"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const SESSAO_KEY = "roto_sessao_ativa";

type SessaoSalva = {
  atividadeId: string;
  atividadeNome: string;
  inicio: string; // ISO string
};

export default function OperadorPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);

  // Seleção com busca
  const [busca, setBusca] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedActivityNome, setSelectedActivityNome] = useState("");
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cronômetro
  const [inicio, setInicio] = useState<Date | null>(null);
  const [tempo, setTempo] = useState(0);

  // Confirmação / ajuste
  const [confirmando, setConfirmando] = useState(false);
  const [ajusteManual, setAjusteManual] = useState(false);
  const [minutosManuais, setMinutosManuais] = useState("");

  // Histórico
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  // Sessão recuperada
  const [sessaoRecuperada, setSessaoRecuperada] = useState(false);

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { router.replace("/login"); return; }

    const profile = JSON.parse(savedUser);
    setUser(profile);
    loadActivities(profile);
    loadHistorico(profile.id);
  }, [router]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ─── Carregar atividades + tentar recuperar sessão ────────────────────────
  async function loadActivities(profile: any) {
    const { data } = await supabase
      .from("activity_catalog")
      .select("id, nome, categoria, setor, impacto")
      .order("nome", { ascending: true });

    if (data) {
      setActivities(data);
      tentarRecuperarSessao(data);
    }
  }

  function tentarRecuperarSessao(lista: any[]) {
    try {
      const raw = localStorage.getItem(SESSAO_KEY);
      if (!raw) return;

      const sessao: SessaoSalva = JSON.parse(raw);
      const atividadeExiste = lista.find((a) => a.id === sessao.atividadeId);
      if (!atividadeExiste) {
        localStorage.removeItem(SESSAO_KEY);
        return;
      }

      const inicioRecuperado = new Date(sessao.inicio);
      const agora = new Date();
      const diffHoras = (agora.getTime() - inicioRecuperado.getTime()) / 3600000;

      // Ignora sessões com mais de 12h (provavelmente esquecida)
      if (diffHoras > 12) {
        localStorage.removeItem(SESSAO_KEY);
        return;
      }

      setSelectedActivity(sessao.atividadeId);
      setSelectedActivityNome(sessao.atividadeNome);
      setInicio(inicioRecuperado);
      setTempo(Math.floor((agora.getTime() - inicioRecuperado.getTime()) / 1000));
      setSessaoRecuperada(true);
    } catch {
      localStorage.removeItem(SESSAO_KEY);
    }
  }

  // ─── Cronômetro ──────────────────────────────────────────────────────────
  useEffect(() => {
    let interval: any;
    if (inicio && !confirmando) {
      interval = setInterval(() => {
        setTempo(Math.floor((Date.now() - inicio.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [inicio, confirmando]);

  // ─── Histórico ───────────────────────────────────────────────────────────
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

  // ─── Ações ───────────────────────────────────────────────────────────────
  function selecionarAtividade(a: any) {
    setSelectedActivity(a.id);
    setSelectedActivityNome(a.nome);
    setBusca("");
    setDropdownAberto(false);
  }

  function iniciar() {
    if (!selectedActivity) {
      alert("Selecione uma atividade.");
      return;
    }

    const agora = new Date();
    setInicio(agora);
    setTempo(0);
    setConfirmando(false);
    setAjusteManual(false);
    setMinutosManuais("");
    setSessaoRecuperada(false);

    // Salvar sessão no localStorage
    const sessao: SessaoSalva = {
      atividadeId: selectedActivity,
      atividadeNome: selectedActivityNome,
      inicio: agora.toISOString(),
    };
    localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao));
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

    if (!minutosFinal || minutosFinal < 1) {
      alert("Informe um tempo válido.");
      return;
    }

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
    setInicio(null);
    setTempo(0);
    setSelectedActivity("");
    setSelectedActivityNome("");
    setBusca("");
    setConfirmando(false);
    setAjusteManual(false);
    setMinutosManuais("");
    setSessaoRecuperada(false);
  }

  function cancelarAtividade() {
    localStorage.removeItem(SESSAO_KEY);
    resetar();
  }

  // ─── Formatação ──────────────────────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="roto-page pb-10">
      <div className="mx-auto max-w-md">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="roto-muted">Painel do Operador</p>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(32px,6vw,52px)", fontWeight:900, letterSpacing:"0.04em", textTransform:"uppercase", margin:0, lineHeight:1.1}}>
              {user?.nome || "Operador"}
            </h1>
          </div>
          <button
            onClick={() => { localStorage.removeItem("user"); router.replace("/login"); }}
            className="roto-button-secondary"
          >
            Sair
          </button>
        </div>

        {/* Aviso de sessão recuperada */}
        {sessaoRecuperada && inicio && (
          <div className="roto-card mb-4" style={{ borderColor: "var(--roto-red)", borderLeftWidth:"3px" }}>
            <p className="text-sm font-bold" style={{color:"var(--roto-red)", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.08em", textTransform:"uppercase"}}>⚡ Sessão recuperada</p>
            <p className="roto-muted mt-1" style={{fontSize:"12px"}}>
              Cronômetro retomado desde {formatarHora(inicio.toISOString())}. Use ajuste manual se o tempo estiver errado.
            </p>
          </div>
        )}

        {/* Estado: sem atividade em andamento */}
        {!inicio ? (
          <div className="roto-card">
            <label className="roto-muted">Selecione a atividade</label>

            {/* Campo de busca com dropdown */}
            <div className="relative mt-3" ref={dropdownRef}>
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
                <div className="absolute z-50 w-full mt-1 overflow-hidden shadow-xl"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius:"4px", boxShadow:"0 4px 16px rgba(0,0,0,0.12)" }}>
                  {atividadesFiltradas.length === 0 ? (
                    <p className="px-4 py-3 text-sm roto-muted">Nenhuma atividade encontrada.</p>
                  ) : (
                    atividadesFiltradas.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => selecionarAtividade(a)}
                        className="w-full text-left px-4 border-none cursor-pointer transition-colors"
                        style={{
                          background: a.id === selectedActivity ? "rgba(204,0,0,0.08)" : "transparent",
                          color: a.id === selectedActivity ? "var(--roto-red)" : "var(--text)",
                          borderBottom: "1px solid var(--border)",
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 17,
                          fontWeight: a.id === selectedActivity ? 700 : 500,
                          padding: "14px 16px",
                        }}
                      >
                        {a.nome}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Atividade selecionada */}
            {selectedActivityNome && !dropdownAberto && (
              <div className="mt-3 flex items-center gap-2 px-3 py-3" style={{background:"rgba(204,0,0,0.07)", borderLeft:"3px solid var(--roto-red)", borderRadius:"2px"}}>
                <span style={{color:"var(--roto-red)"}}>▶</span>
                <span style={{color:"var(--roto-red)", fontSize:17, fontWeight:700}}>{selectedActivityNome}</span>
              </div>
            )}

            <button
              onClick={iniciar}
              disabled={!selectedActivity}
              className="roto-button mt-5"
              style={!selectedActivity ? { opacity: 0.4, cursor: "not-allowed" } : {}}
            >
              ▶ Iniciar atividade
            </button>
          </div>

        ) : (
          /* Estado: atividade em andamento */
          <div className="roto-card text-center">
            <p className="roto-muted">Em andamento</p>

            {/* Nome da atividade em destaque */}
            <p className="mt-3 px-2 leading-snug"
              style={{fontFamily:"'Barlow Condensed',sans-serif", fontSize:"22px", fontWeight:800, color:"var(--roto-red)", textTransform:"uppercase", letterSpacing:"0.06em"}}>
              {selectedActivityNome}
            </p>

            {/* Linha separadora */}
            <div style={{height:"1px", background:"var(--border)", margin:"16px 0"}} /> 

            {/* Cronômetro */}
            <p className="tabular-nums leading-none"
              style={{fontFamily:"'Barlow Condensed',sans-serif", fontSize:"80px", fontWeight:900, letterSpacing:"-0.02em", color:"var(--text)", margin:"12px 0 20px"}}>
              {formatarTempo(tempo)}
            </p>

            <button onClick={abrirConfirmacao} className="roto-button-danger">
              ⏹ Finalizar
            </button>

            <button
              onClick={cancelarAtividade}
              className="roto-button-secondary mt-3 w-full"
            >
              Cancelar atividade
            </button>
          </div>
        )}

        {/* Histórico do dia */}
        <button
          onClick={() => setMostrarHistorico(!mostrarHistorico)}
          className="roto-button-secondary mt-6 w-full"
        >
          {mostrarHistorico
            ? "Ocultar histórico de hoje"
            : `Ver histórico de hoje (${historico.length})`}
        </button>

        {mostrarHistorico && (
          <div className="roto-card mt-4">
            <p className="font-bold">Histórico de hoje</p>

            {historico.length === 0 ? (
              <p className="roto-muted mt-3 text-sm">Nenhuma atividade registrada hoje.</p>
            ) : (
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {historico.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-gray-200 pb-3 last:border-b-0"
                  >
                    <p className="font-bold">{item.atividade_nome}</p>
                    <p className="text-sm roto-muted">
                      {formatarHora(item.inicio)} até {formatarHora(item.fim)}
                    </p>
                    <p className="text-sm">
                      {item.duration_minutes} min
                      {item.manual_adjusted && " • ajuste manual"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {confirmando && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-5 py-8" style={{background:"rgba(0,0,0,0.5)"}}>
          <div className="roto-card w-full max-w-md max-h-[90vh] overflow-y-auto">
            <p className="roto-muted">Confirmar finalização</p>
            <h2 className="mt-1 font-bold" style={{fontFamily:"'Barlow Condensed',sans-serif", fontSize:"20px", letterSpacing:"0.04em", textTransform:"uppercase"}}>{selectedActivityNome}</h2>

            <p className="my-6 text-center tabular-nums" style={{fontFamily:"'Barlow Condensed',sans-serif", fontSize:"72px", fontWeight:900, color:"var(--roto-red)"}}>
              {minutosCalculados}<span style={{fontSize:"32px", fontWeight:600, color:"var(--muted)", marginLeft:"6px"}}>min</span>
            </p>

            <label className="flex items-center gap-3 rounded-xl bg-gray-100 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={ajusteManual}
                onChange={(e) => setAjusteManual(e.target.checked)}
              />
              <span className="text-sm">Esqueci o celular / ajustar tempo manual</span>
            </label>

            {ajusteManual && (
              <div className="mt-4">
                <label className="text-sm roto-muted">Tempo real gasto (minutos)</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={minutosManuais}
                  onChange={(e) => setMinutosManuais(e.target.value)}
                  className="roto-input mt-2"
                />
              </div>
            )}

            <button onClick={salvarAtividade} className="roto-button mt-6">
              Salvar atividade
            </button>

            <button
              onClick={() => { setConfirmando(false); setAjusteManual(false); }}
              className="roto-button-secondary mt-3 w-full"
            >
              Continuar atividade
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
