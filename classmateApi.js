import { fetchJson } from "./httpUtil.js";

const DEFAULT_CLASSMATE_ORIGIN = "https://cvb-0pd8.onrender.com";

export function registerClassmateRoutes(app) {
  const BASE = (process.env.CLASSMATE_API_BASE || DEFAULT_CLASSMATE_ORIGIN).replace(/\/$/, "");

  app.get("/api/classmate/health", async (req, res) => {
    try {
      const data = await fetchJson(`${BASE}/health`);
      res.json({ source: "classmate", url: `${BASE}/health`, data });
    } catch (e) {
      res.status(e.status && e.status < 600 ? e.status : 502).json({
        error: e.message,
        source: "classmate",
        detail: e.body || e.code || null,
      });
    }
  });

  app.get("/api/classmate/products", async (req, res) => {
    try {
      const productsUrl = `${BASE}/api/products`;
      const data = await fetchJson(productsUrl);
      res.json({ source: "classmate", url: productsUrl, data });
    } catch (e) {
      res.status(e.status && e.status < 600 ? e.status : 502).json({
        error: e.message,
        source: "classmate",
        detail: e.body || e.code || null,
      });
    }
  });

  app.post("/api/classmate/products", async (req, res) => {
    try {
      const productsUrl = `${BASE}/api/products`;
      const data = await fetchJson(productsUrl, {
        method: "POST",
        body: JSON.stringify(req.body || {}),
      });
      res.status(201).json({ source: "classmate", url: productsUrl, data });
    } catch (e) {
      const code = e.status >= 400 && e.status < 600 ? e.status : 502;
      res.status(code).json({
        error: e.message,
        source: "classmate",
        detail: e.body || e.code || null,
      });
    }
  });
}
