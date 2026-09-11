export async function submitJson<T>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.error || data?.message || "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}