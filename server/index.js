/**
 * pilot999 contact API
 *
 * Env:
 *  - PORT (default 3000)
 *  - SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false")
 *  - SMTP_USER, SMTP_PASS
 *  - SMTP_FROM (e.g. "pilot999 <no-reply@yourdomain.com>")
 *  - SMTP_TO (destination inbox)
 *  - ALLOWED_ORIGIN (optional, default "*"; when proxied via nginx you can leave it unset)
 */
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import cors from "cors";
import "dotenv/config";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "256kb" }));

const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
app.use(
  cors({
    origin: allowedOrigin === "*" ? true : allowedOrigin,
    methods: ["POST", "OPTIONS"],
  }),
);

app.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function buildTransport() {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const auth = user && pass ? { user, pass } : undefined;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });
}

function sanitizeText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 5000);
}

function validateEmail(email) {
  const e = String(email || "").trim();
  if (e.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

app.post("/contact", async (req, res) => {
  const name = sanitizeText(req.body?.name);
  const email = sanitizeText(req.body?.email);
  const message = sanitizeText(req.body?.message);

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "Missing fields." });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ ok: false, error: "Invalid email." });
  }

  let transporter;
  try {
    transporter = buildTransport();
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server email not configured." });
  }

  const to = requireEnv("SMTP_TO");
  const from = requireEnv("SMTP_FROM");

  const subject = `pilot999: new message from ${name}`;
  const text = `Name: ${name}\nEmail: ${email}\n\n${message}\n`;

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject,
      text,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ ok: false, error: "Email send failed." });
  }
});

const port = Number(process.env.PORT || "3000");
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`pilot999 contact API listening on :${port}`);
});
