/** Relative URLs — same origin as the orchestrator admin server. */
export function getTokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getTokenFromUrl();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const r = await fetch(path, { ...init, headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
