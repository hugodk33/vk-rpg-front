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
    throw new Error(`API ${res.status} ${res.statusText}: ${path}`);
  }

  return res.json() as Promise<T>;
}
