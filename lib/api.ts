const isServer = typeof window === "undefined";

const API_BASE = isServer
  ? (process.env.API_URL ?? "http://localhost:3000")
  : "/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    /* O corpo traz `error` com a regra que falhou — validação de campo,
       alvo inexistente, ciclo de requisitos. Sem isto o narrador só via
       "API 400" e o painel de relações não consegue explicar o bloqueio. */
    let detail = "";
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error) detail = ` — ${body.error}`;
    } catch {
      /* resposta sem JSON: o status já basta */
    }
    throw new Error(`API ${res.status} ${res.statusText}: ${path}${detail}`);
  }

  return res.json() as Promise<T>;
}
