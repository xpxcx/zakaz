export async function fetchJson(url, options = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const headers = { Accept: "application/json" };
    if (options.body) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: { ...headers, ...(options.headers || {}) },
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("Превышено время ожидания ответа");
      err.code = "TIMEOUT";
      throw err;
    }
    if (e.code === "ENOTFOUND" || e.code === "ECONNREFUSED") {
      const err = new Error("Сервис недоступен");
      err.code = "UNREACHABLE";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
