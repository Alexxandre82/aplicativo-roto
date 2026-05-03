// lib/crypto.ts
// Hash de senha usando Web Crypto API (nativo no Next.js, sem dependências)
// Formato armazenado: "sha256:<salt_hex>:<hash_hex>"

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + senha);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256:${saltHex}:${hashHex}`;
}

export async function verificarSenha(senha: string, armazenada: string): Promise<boolean> {
  // Compatibilidade retroativa: senhas antigas em texto puro
  if (!armazenada.startsWith("sha256:")) {
    return senha === armazenada;
  }

  const partes = armazenada.split(":");
  if (partes.length !== 3) return false;

  const [, saltHex, hashEsperado] = partes;
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + senha);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashCalculado = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return hashCalculado === hashEsperado;
}
