"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { hashSenha, verificarSenha } from "@/lib/crypto";

export default function LoginPage() {
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("501");
  const [modoCadastro, setModoCadastro] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar() {
    setLoading(true);
    setErro("");

    if (!matricula.trim() || !senha.trim()) {
      setErro("Preencha a matrícula e a senha.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("matricula", matricula.trim())
      .eq("ativo", true)
      .maybeSingle();

    if (error || !data) {
      setErro("Matrícula ou senha inválida.");
      setLoading(false);
      return;
    }

    const senhaCorreta = await verificarSenha(senha.trim(), data.senha);

    if (!senhaCorreta) {
      setErro("Matrícula ou senha inválida.");
      setLoading(false);
      return;
    }

    const { senha: _, ...perfilSeguro } = data;
    localStorage.setItem("user", JSON.stringify(perfilSeguro));

    if (data.perfil === "gestor" || data.perfil === "admin") {
      window.location.href = "/gestor";
    } else {
      window.location.href = "/operador";
    }
  }

  async function cadastrar() {
    setLoading(true);
    setErro("");

    if (!nome.trim() || !matricula.trim() || !senha.trim()) {
      setErro("Preencha nome, matrícula e senha.");
      setLoading(false);
      return;
    }

    if (senha.trim().length < 4) {
      setErro("A senha deve ter ao menos 4 caracteres.");
      setLoading(false);
      return;
    }

    const minutos = parseInt(cargaHoraria);
    if (!minutos || minutos < 60 || minutos > 720) {
      setErro("Carga horária inválida (entre 60 e 720 minutos).");
      setLoading(false);
      return;
    }

    const { data: existente } = await supabase
      .from("profiles")
      .select("id")
      .eq("matricula", matricula.trim())
      .maybeSingle();

    if (existente) {
      setErro("Essa matrícula já está cadastrada.");
      setLoading(false);
      return;
    }

    const senhaHash = await hashSenha(senha.trim());

    const { error } = await supabase.from("profiles").insert([
      {
        nome: nome.trim(),
        matricula: matricula.trim(),
        senha: senhaHash,
        perfil: "operador",
        ativo: true,
        minutos_dia: minutos,
      },
    ]);

    if (error) {
      setErro("Erro ao criar cadastro.");
      setLoading(false);
      return;
    }

    setModoCadastro(false);
    setErro("");
    setNome("");
    setMatricula("");
    setSenha("");
    setCargaHoraria("501");
  }

  function formatarMinutos(minStr: string) {
    const min = Number(minStr);
    if (!min || min < 1) return "";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (m === 0) return `${h}hr`;
    return `${h}:${m.toString().padStart(2, "0")}`;
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>{modoCadastro ? "Criar cadastro" : "Acesso ao Sistema"}</h1>
          <p className="login-subtitle">
            {modoCadastro
              ? "Cadastre-se para registrar suas atividades."
              : "Entre com sua matrícula e senha."}
          </p>
        </div>

        <div className="login-form">
          {modoCadastro && (
            <>
              <input
                type="text"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <div>
                <label className="login-label" style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block" }}>
                  Carga horária diária
                </label>
                <input
                  type="number"
                  placeholder="Ex: 501"
                  value={cargaHoraria}
                  min="60"
                  max="720"
                  onChange={(e) => setCargaHoraria(e.target.value)}
                />
                <p className="login-hint-small" style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 6 }}>
                  Turno completo = 501 min <span style={{ color: "var(--primary-light)", fontWeight: 600, marginLeft: 4 }}>({formatarMinutos(cargaHoraria)})</span>
                </p>
              </div>
            </>
          )}

          <input
            type="text"
            placeholder="Matrícula"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            autoCapitalize="none"
            onKeyDown={(e) => !modoCadastro && e.key === "Enter" && entrar()}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => !modoCadastro && e.key === "Enter" && entrar()}
          />

          {erro && <div className="login-error">{erro}</div>}

          <button
            onClick={modoCadastro ? cadastrar : entrar}
            disabled={loading}
            className="login-primary"
          >
            {loading ? "Aguarde..." : modoCadastro ? "Criar cadastro" : "Entrar"}
          </button>

          <button
            onClick={() => { setModoCadastro(!modoCadastro); setErro(""); }}
            className="login-secondary"
          >
            {modoCadastro ? "Voltar para login" : "Criar cadastro"}
          </button>
        </div>
      </div>
    </main>
  );
}
