"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

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

    const matriculaLimpa = matricula.trim();
    const senhaLimpa = senha.trim();

    if (!matriculaLimpa || !senhaLimpa) {
      setErro("Preencha a matrícula e a senha.");
      setLoading(false);
      return;
    }

    const emailFake = `${matriculaLimpa}@roto.com`;
    const senhaSegura = `${senhaLimpa}-roto`;

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: emailFake,
        password: senhaSegura,
      });

    if (authError || !authData.user) {
      setErro("Matrícula ou senha inválida.");
      setLoading(false);
      return;
    }

    let { data: perfil } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!perfil) {
      const { data: perfilPorMatricula } = await supabase
        .from("profiles")
        .select("*")
        .eq("matricula", matriculaLimpa)
        .maybeSingle();

      perfil = perfilPorMatricula;
    }

    if (!perfil) {
      setErro("Usuário existe, mas o perfil não foi criado. Refaça o cadastro ou crie o perfil no Supabase.");
      setLoading(false);
      return;
    }

    if (perfil.ativo !== true) {
      setErro("Perfil inativo.");
      setLoading(false);
      return;
    }

    const { senha: _, ...perfilSeguro } = perfil;
    localStorage.setItem("user", JSON.stringify(perfilSeguro));

    if (perfil.perfil === "gestor" || perfil.perfil === "admin") {
      window.location.href = "/gestor";
    } else {
      window.location.href = "/operador";
    }
  }

  async function cadastrar() {
    setLoading(true);
    setErro("");

    const nomeLimpo = nome.trim();
    const matriculaLimpa = matricula.trim();
    const senhaLimpa = senha.trim();

    if (!nomeLimpo || !matriculaLimpa || !senhaLimpa) {
      setErro("Preencha nome, matrícula e senha.");
      setLoading(false);
      return;
    }

    if (senhaLimpa.length < 4) {
      setErro("A senha deve ter ao menos 4 caracteres.");
      setLoading(false);
      return;
    }

    const [hh, mm] = cargaHoraria.split(":").map(Number);
    const minutos = (hh || 0) * 60 + (mm || 0);

    if (!minutos || minutos < 60) {
      setErro("Carga horária inválida.");
      setLoading(false);
      return;
    }

    const emailFake = `${matriculaLimpa}@roto.com`;
    const senhaSegura = `${senhaLimpa}-roto`;

    const isGestor = nomeLimpo.toUpperCase().endsWith("GESTOR");
    const nomeFinal = isGestor
      ? nomeLimpo.replace(/GESTOR$/i, "").trim()
      : nomeLimpo;

    const { data: perfilExistente } = await supabase
      .from("profiles")
      .select("*")
      .eq("matricula", matriculaLimpa)
      .maybeSingle();

    if (perfilExistente) {
      setErro("Esta matrícula já possui perfil. Volte para login.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailFake,
      password: senhaSegura,
    });

    if (authError || !authData.user) {
      setErro("Esta matrícula já existe no Auth, mas está sem perfil. Apague o usuário no Supabase Auth e cadastre novamente.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: authData.user.id,
        nome: nomeFinal,
        matricula: matriculaLimpa,
        senha: "migrated_to_auth",
        perfil: isGestor ? "gestor" : "operador",
        ativo: true,
        minutos_dia: minutos,
      },
    ]);

    if (profileError) {
      setErro("Usuário criado no Auth, mas falhou ao criar perfil: " + profileError.message);
      setLoading(false);
      return;
    }

    setErro("");
    setModoCadastro(false);
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
                <label
                  className="login-label"
                  style={{
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Carga horária diária
                </label>

                <input
                  type="time"
                  value={cargaHoraria}
                  onChange={(e) => setCargaHoraria(e.target.value)}
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
            onClick={() => {
              setModoCadastro(!modoCadastro);
              setErro("");
            }}
            className="login-secondary"
          >
            {modoCadastro ? "Voltar para login" : "Criar cadastro"}
          </button>
        </div>
      </div>
    </main>
  );
}
