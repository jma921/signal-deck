const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizeHost(host: string): string {
  const value = host.trim().toLowerCase();
  if (value === "::1") return value;
  if (value.startsWith("[")) return value.replace(/:\d+$/, "");
  if (value.includes(":")) return value.split(":")[0] ?? value;
  return value;
}

export function isLoopbackRequest(req: Request, requestIp?: string | null): boolean {
  if (requestIp) {
    const normalizedIp = requestIp.startsWith("::ffff:") ? requestIp.slice(7) : requestIp;
    if (LOOPBACK_HOSTS.has(normalizedIp)) return true;
  }

  const url = new URL(req.url);
  if (LOOPBACK_HOSTS.has(normalizeHost(url.host))) return true;

  const host = req.headers.get("host");
  return host != null && LOOPBACK_HOSTS.has(normalizeHost(host));
}

export function localOnlyResponse() {
  return Response.json({ error: "This endpoint is only available from the local machine." }, { status: 403 });
}
