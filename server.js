import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import { suggestSlots } from "./slotEngine.js";
import { registerClassmateRoutes } from "./classmateApi.js";
import { listAppointments, insertAppointment, getDbPath } from "./db.js";
import { registerIntegrationRoutes } from "./integration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiSpec = JSON.parse(readFileSync(join(__dirname, "openapi.json"), "utf8"));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/** В памяти: демо-данные для GET (услуги и записи) */
const services = [
  { id: "svc-1", title: "Индивидуальное занятие", defaultDurationMin: 60, price: 1500 },
  { id: "svc-2", title: "Консультация", defaultDurationMin: 30, price: 800 },
];

const getMiniCrmBaseUrl = () =>
  (process.env.PUBLIC_BASE_URL || process.env.MINICRM_BASE_URL || `http://127.0.0.1:${PORT}`).replace(
    /\/$/,
    ""
  );

registerClassmateRoutes(app);
registerIntegrationRoutes(app, { getMiniCrmBaseUrl });

/**
 * GET — получение данных (требование задания)
 * Примеры: /api/services, /api/appointments
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "MiniCRM Booking API", version: "1.0.0" });
});

app.get("/api/services", (req, res) => {
  res.json({ data: services });
});

app.get("/api/appointments", (req, res) => {
  const data = listAppointments();
  res.json({ data, count: data.length });
});

/**
 * POST — подбор слотов (бизнес-логика из практики 1–2: POST /slots/suggest)
 */
app.post("/api/slots/suggest", (req, res) => {
  try {
    const result = suggestSlots(req.body);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/**
 * POST — добавление клиентских данных / создание записи (требование задания)
 */
app.post("/api/appointments", (req, res) => {
  const { clientName, clientPhone, serviceId, start, end } = req.body || {};
  if (!clientName || !start || !end) {
    return res.status(400).json({
      error: "Укажите clientName, start, end (ISO 8601). clientPhone и serviceId — опционально.",
    });
  }
  const id = `appt-${Date.now()}`;
  const row = {
    id,
    clientName: String(clientName),
    clientPhone: clientPhone ? String(clientPhone) : null,
    serviceId: serviceId || "svc-1",
    start: String(start),
    end: String(end),
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  insertAppointment(row);
  res.status(201).json({ data: row, message: "Запись сохранена в SQLite" });
});

app.get("/openapi.json", (req, res) => {
  res.type("application/json").send(openApiSpec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "MiniCRM Booking API — Swagger UI",
    customCss: ".swagger-ui .topbar { display: none }",
  })
);

app.use(express.static(join(__dirname, "public")));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found", path: req.path });
  }
  next();
});

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`MiniCRM Booking API: http://localhost:${PORT} (при запуске локально)`);
  console.log(`MiniCRM Booking API: https://cvb-crm.onrender.com`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/services`);
  console.log(`  GET  /api/appointments`);
  console.log(`  POST /api/slots/suggest`);
  console.log(`  POST /api/appointments`);
  console.log(`  GET  /openapi.json`);
  console.log(`  GET  /api-docs — Swagger UI`);
  console.log(`  GET  /api/integration/status`);
});
