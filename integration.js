import { fetchJson } from "./httpUtil.js";

export function registerIntegrationRoutes(app, { getMiniCrmBaseUrl }) {
  const CLASSMATE_BASE = (process.env.CLASSMATE_API_BASE || "https://cvb-0pd8.onrender.com").replace(
    /\/$/,
    ""
  );

  app.get("/api/integration/status", async (req, res) => {
    const MINICRM_BASE = getMiniCrmBaseUrl();
    const result = {
      platform: { ok: true, at: new Date().toISOString() },
      minicrm: null,
      classmate: null,
      errors: [],
    };

    try {
      result.minicrm = await fetchJson(`${MINICRM_BASE}/api/health`);
    } catch (e) {
      result.errors.push({
        service: "MiniCRM",
        message: e.message,
        detail: e.body || e.code || null,
      });
      result.minicrm = { available: false };
    }

    try {
      result.classmate = await fetchJson(`${CLASSMATE_BASE}/health`);
    } catch (e) {
      result.errors.push({
        service: "ElectronicsStore",
        message: e.message,
        detail: e.body || e.code || null,
      });
      result.classmate = { available: false };
    }

    res.json(result);
  });

  app.post("/api/integration/booking-estimate", async (req, res) => {
    const MINICRM_BASE = getMiniCrmBaseUrl();
    const { suggestBody, serviceId } = req.body || {};
    if (!suggestBody || typeof suggestBody !== "object") {
      return res
        .status(400)
        .json({ error: "Укажите suggestBody (тело для POST /api/slots/suggest MiniCRM)." });
    }

    try {
      const [servicesRes, slotsRes, products] = await Promise.all([
        fetchJson(`${MINICRM_BASE}/api/services`),
        fetchJson(`${MINICRM_BASE}/api/slots/suggest`, {
          method: "POST",
          body: JSON.stringify(suggestBody),
        }),
        fetchJson(`${CLASSMATE_BASE}/api/products`),
      ]);

      const services = servicesRes?.data || [];
      const svc =
        (serviceId && services.find((s) => s.id === serviceId)) || services[0] || null;
      const servicePrice = svc?.price ?? 0;

      const list = Array.isArray(products) ? products : [];
      const inStock = list.filter((p) => p.inStock > 0);
      let recommended = null;
      if (inStock.length) {
        const budget = Math.max(servicePrice * 2, 5000);
        recommended =
          inStock.find((p) => p.price <= budget) ||
          inStock.reduce((a, b) => (a.price <= b.price ? a : b));
      }

      const equipmentCost = recommended?.price ?? 0;
      const totalEstimate = servicePrice + equipmentCost;

      res.json({
        step: "Параллельно: услуги MiniCRM, подбор слотов, каталог одногруппника",
        service: svc,
        slots: slotsRes,
        recommendedProduct: recommended,
        totals: {
          serviceRub: servicePrice,
          equipmentRub: equipmentCost,
          combinedRub: totalEstimate,
        },
      });
    } catch (e) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      res.status(status).json({
        error: e.message || "Ошибка интеграции",
        upstream: e.body || null,
      });
    }
  });

  app.post("/api/integration/booking-with-equipment", async (req, res) => {
    const MINICRM_BASE = getMiniCrmBaseUrl();
    const { clientName, clientPhone, serviceId, start, end, productId } = req.body || {};
    if (!clientName || !start || !end) {
      return res.status(400).json({
        error: "Нужны clientName, start, end (ISO). Опционально: clientPhone, serviceId, productId.",
      });
    }

    let appointment;
    let product = null;

    try {
      appointment = await fetchJson(`${MINICRM_BASE}/api/appointments`, {
        method: "POST",
        body: JSON.stringify({ clientName, clientPhone, serviceId, start, end }),
      });
    } catch (e) {
      return res.status(e.status || 502).json({
        error: `MiniCRM: ${e.message}`,
        step: "Создание записи",
        upstream: e.body || null,
      });
    }

    if (productId != null && productId !== "") {
      try {
        const products = await fetchJson(`${CLASSMATE_BASE}/api/products`);
        const list = Array.isArray(products) ? products : [];
        product = list.find((p) => p.id === Number(productId)) || null;
      } catch (e) {
        return res.status(502).json({
          error: `Каталог одногруппника: ${e.message}`,
          step: "Получение товара",
          appointment: appointment?.data || appointment,
          upstream: e.body || null,
        });
      }
    }

    const appt = appointment?.data || appointment;
    const servicePrice =
      (await (async () => {
        try {
          const s = await fetchJson(`${MINICRM_BASE}/api/services`);
          const row = (s?.data || []).find((x) => x.id === (serviceId || appt?.serviceId));
          return row?.price ?? 0;
        } catch {
          return 0;
        }
      })()) || 0;

    res.status(201).json({
      message:
        "Запись создана в MiniCRM; товар из каталога одногруппника учтён в смете (заказ в магазине — отдельная операция в их API).",
      appointment: appt,
      equipment: product,
      totals: {
        serviceRub: servicePrice,
        equipmentRub: product?.price ?? 0,
        combinedRub: servicePrice + (product?.price ?? 0),
      },
    });
  });
}
