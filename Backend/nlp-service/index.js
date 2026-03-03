require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
const Redis = require("redis");
const Sentiment = require("sentiment");
const Filter = require("bad-words");

const app = express();
app.use(express.json());

const sentiment = new Sentiment();
const filter = new Filter();

const PORT = process.env.PORT || 3002;

// ---------- Database & Redis Configuration ----------
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || "postgres"}:${process.env.DB_PASSWORD || "nandha102"}@${
    process.env.DB_HOST || "localhost"
  }:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || "db_mini"}`;

const REDIS_URL =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`;

const OLLAMA_BASE_URL =
  process.env.OLLAMA_URL ||
  process.env.OLLAMA_BASE_URL ||
  "http://localhost:11434";

// ---------- PostgreSQL Connection ----------
const pgPool = new Pool({ connectionString: DATABASE_URL });

// ---------- Redis Connection ----------
const redisClient = Redis.createClient({ url: REDIS_URL });
redisClient.on("error", (err) => console.error("❌ Redis error:", err));

async function initRedis() {
  if (!redisClient.isOpen) await redisClient.connect();
}

// ---------- Toxicity Detection ----------
const extraToxicWords = new Set(["idiot", "stupid", "kill", "hate", "trash"]);
function checkToxicity(text) {
  const hasProfanity = filter.isProfane(text);
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of extraToxicWords) if (lower.includes(w)) hits++;
  const toxicScore = (hasProfanity ? 0.7 : 0) + Math.min(0.3, hits * 0.1);
  return {
    toxicity: toxicScore >= 0.25,
    score: toxicScore,
    reasons: { profanity: hasProfanity, matches: hits },
  };
}

// ---------- Save Analysis to PostgreSQL ----------
async function saveAnalysis({
  community_id,
  text,
  sentimentLabel,
  sentimentScore,
  toxicityObj,
  modelResponse,
}) {
  const sql = `INSERT INTO nlp_analyses 
  (community_id, text, sentiment_label, sentiment_score, toxicity, toxicity_score, model_response, created_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id`;
  const values = [
    community_id || null,
    text,
    sentimentLabel,
    sentimentScore,
    toxicityObj.toxicity,
    toxicityObj.score,
    modelResponse,
  ];
  try {
    const res = await pgPool.query(sql, values);
    return res.rows[0].id;
  } catch (err) {
    console.error("❌ Failed to save analysis:", err.message);
    return null;
  }
}

// ---------- Fetch Relevant Docs (RAG) ----------
async function fetchRelevantDocs(text, limit = 3) {
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);
  if (!words.length) return [];
  const whereClauses = words.map((_, i) => `content ILIKE $${i + 1}`).join(" OR ");
  const values = words.map((w) => `%${w}%`);
  const sql = `SELECT id, title, content FROM documents WHERE ${whereClauses} LIMIT $${values.length + 1}`;
  values.push(limit);
  try {
    const res = await pgPool.query(sql, values);
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching docs:", err.message);
    return [];
  }
}

// ---------- Call Ollama Model ----------
async function callOllama(prompt, model = "llama2") {
  try {
    const resp = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      { model, prompt, max_tokens: 256 },
      { timeout: 60000 }
    );
    if (resp.data && resp.data.output) return resp.data.output;
    if (resp.data && resp.data[0] && resp.data[0].content) return resp.data[0].content;
    return typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
  } catch (err) {
    console.error("❌ Ollama call failed:", err.message);
    return null;
  }
}

// ---------- Test Route ----------
app.get("/test", (req, res) => {
  res.json({ message: "✅ Test route working — server is active!" });
});
// ---------- Test Route ----------


// ---------- NLP Analysis Route ----------
app.post("/api/nlp/analyze", async (req, res) => {
  await initRedis();
  const { text, community_id } = req.body || {};
  if (!text || typeof text !== "string")
    return res.status(400).json({ error: "text missing or invalid" });

  const cacheKey = `nlp:analysis:${Buffer.from(text).toString("base64").slice(0, 64)}`;

  try {
    // 1️⃣ Check Redis Cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("⚡ Returning cached result");
      return res.json({ cached: true, ...JSON.parse(cached) });
    }

    // 2️⃣ Sentiment Analysis
    const s = sentiment.analyze(text);
    const sentimentScore = s.comparative ?? s.score ?? 0;
    let sentimentLabel = "neutral";
    if (sentimentScore > 0.2) sentimentLabel = "positive";
    if (sentimentScore < -0.2) sentimentLabel = "negative";

    console.log(`🧠 Sentiment → ${sentimentLabel} (score: ${sentimentScore})`);

    // 3️⃣ Toxicity
    const toxicityObj = checkToxicity(text);
    console.log(`☣️ Toxicity → ${toxicityObj.toxicity ? "Toxic" : "Clean"} (score: ${toxicityObj.score})`);

    // 4️⃣ RAG
    const docs = await fetchRelevantDocs(text, 3);
    const context = docs.map((d) => `Title: ${d.title}\n${d.content}`).join("\n\n---\n\n");

    const prompt = `You are a helpful moderation assistant.
Analyze this message and respond with:
1) Verdict: ok / needs_quarantine
2) Reason
3) Suggested action (if needed)

Message:
${text}

Context:
${context || "(no matching docs found)"}\n\nAnswer concisely.`;

    // 5️⃣ LLM Call (cached)
    const modelCacheKey = `nlp:model:${Buffer.from(prompt).toString("base64").slice(0, 128)}`;
    let modelResponse = await redisClient.get(modelCacheKey);
    if (!modelResponse) {
      const gen = await callOllama(prompt, process.env.OLLAMA_MODEL || "llama2");
      modelResponse = gen || "No model response";
      await redisClient.setEx(modelCacheKey, 60 * 5, modelResponse);
    }

    // 6️⃣ Save to PostgreSQL
    const savedId = await saveAnalysis({
      community_id,
      text,
      sentimentLabel,
      sentimentScore,
      toxicityObj,
      modelResponse,
    });

    // 7️⃣ Build Result
    const result = {
      id: savedId,
      text,
      sentiment: { label: sentimentLabel, score: sentimentScore },
      toxicity: toxicityObj,
      rag: { docsCount: docs.length, docs: docs.map((d) => ({ id: d.id, title: d.title })) },
      model: modelResponse,
    };

    // Cache in Redis for 2 minutes
    await redisClient.setEx(cacheKey, 60 * 2, JSON.stringify(result));

    res.json(result);
  } catch (err) {
    console.error("❌ Analyze error:", err.message);
    res.status(500).json({ error: "internal error" });
  }
});

// ---------- Health Route ----------
app.get("/", (req, res) => res.send("🚀 NLP Service is running successfully!"));

// ---------- Route Debug Log (Express 5 Safe) ----------
if (app._router && app._router.stack) {
  app._router.stack
    .filter((r) => r.route)
    .forEach((r) => {
      const method = Object.keys(r.route.methods)[0].toUpperCase();
      console.log(`🛣️ Registered route: ${method} ${r.route.path}`);
    });
} else {
  console.log("⚠️ Route list not available in Express 5 — skipping route print.");
}

// ---------- Start Server ----------
app.listen(PORT, () => console.log(`✅ NLP Service running on port ${PORT}`));
