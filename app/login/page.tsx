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

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          {/* Logo */}
          <div style={{ marginBottom: 16 }}>
            <img
              src="/logo.png"
              alt="Roto Fermax"
              style={{
                height: 48,
                width: "auto",
                objectFit: "contain",
                background: "#fff",
                borderRadius: 6,
                padding: "6px 12px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            />
          </div>
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
                <label className="login-label">Carga horária diária (minutos)</label>
                <input
                  type="number"
                  placeholder="501"
                  value={cargaHoraria}
                  min="60"
                  max="720"
                  onChange={(e) => setCargaHoraria(e.target.value)}
                />
                <p className="login-hint-small">Turno completo = 501 min · Meio período = 240 min</p>
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
