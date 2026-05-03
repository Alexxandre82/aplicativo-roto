"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      router.replace("/login");
      return;
    }

    const user = JSON.parse(savedUser);

    if (user.perfil === "gestor" || user.perfil === "admin") {
      router.replace("/gestor");
    } else {
      router.replace("/operador");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Carregando sistema...</h1>
        <p className="mt-2 text-slate-400">Redirecionando...</p>
      </div>
    </main>
  );
}