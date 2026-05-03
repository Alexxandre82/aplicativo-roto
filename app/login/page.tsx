"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { hashSenha, verificarSenha } from "@/lib/crypto";

export default function LoginPage() {
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("08:21");
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

    // Usando Supabase Auth nativo (adicionamos sufixo para burlar o limite mínimo de 6 chars do Supabase)
    const emailFake = `${matricula.trim()}@roto.com`;
    const senhaSegura = `${senha.trim()}-roto`;
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailFake,
      password: senhaSegura,
    });

    if (authError || !authData.user) {
      setErro("Matrícula ou senha inválida. " + (authError?.message || ""));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (error || !data) {
      setErro("Perfil não encontrado ou inativo.");
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

    const [hh, mm] = cargaHoraria.split(":").map(Number);
    const minutos = (hh || 0) * 60 + (mm || 0);
    
    if (!minutos || minutos < 60) {
      setErro("Carga horária inválida (mínimo de 1 hora).");
      setLoading(false);
      return;
    }

    const senhaSegura = `${senha.trim()}-roto`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `${matricula.trim()}@roto.com`,
      password: senhaSegura,
    });

    if (authError || !authData.user) {
      setErro("Erro: " + (authError?.message || "Matrícula já em uso."));
      setLoading(false);
      return;
    }

    const isGestor = nome.trim().toUpperCase().endsWith("GESTOR");
    const nomeFinal = isGestor ? nome.trim().replace(/GESTOR$/i, "").trim() : nome.trim();

    const { error } = await supabase.from("profiles").insert([
      {
        id: authData.user.id,
        nome: nomeFinal,
        matricula: matricula.trim(),
        senha: "migrated_to_auth",
        perfil: isGestor ? "gestor" : "operador",
        ativo: true,
        minutos_dia: minutos,
      },
    ]);

    if (error) {
      setErro("Erro ao criar perfil. " + (error?.message || ""));
      setLoading(false);
      return;
    }

    setModoCadastro(false);
    setErro("");
    setNome("");
    setMatricula("");
    setSenha("");
    setCargaHoraria("08:21");
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
                  type="time"
                  value={cargaHoraria}
                  onChange={(e) => setCargaHoraria(e.target.value)}
                  style={{ cursor: "text" }}
                />
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
