import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import { pipeline } from "@xenova/transformers";
import Sentiment from "sentiment";
import Filter from "bad-words";

dotenv.config();
const { Pool } = pkg;

/*****************************************************************************************
 CONFIG
*****************************************************************************************/

const SETTINGS = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://user:password@localhost:5432/governance_app",

  EMBEDDING_MODEL: "Xenova/all-MiniLM-L6-v2",
  LLM_MODEL: "Xenova/phi-3-mini-4k-instruct",

  PORT: 8001,
  TOP_K: 5,
  SIMILARITY_THRESHOLD: 0.7,
};

/*****************************************************************************************
 DATABASE
*****************************************************************************************/

const pool = new Pool({
  connectionString: SETTINGS.DATABASE_URL,
});

async function searchSimilarEmbeddings(
  embedding,
  communityId,
  sourceType,
  topK,
  threshold
) {
  const query = `
    SELECT source_id,
           1 - (embedding <=> $1::vector) AS similarity_score,
           text_content,
           metadata,
           created_at
    FROM embeddings
    WHERE community_id = $2
      AND source_type = $3
      AND (1 - (embedding <=> $1::vector)) >= $4
    ORDER BY embedding <=> $1::vector
    LIMIT $5;
  `;

  const vectorString = `[${embedding.join(",")}]`;

  const { rows } = await pool.query(query, [
    vectorString,
    communityId,
    sourceType,
    threshold,
    topK,
  ]);

  return rows;
}

async function getComplaints(communityId, fromDate, toDate, limit) {
  let query = `
    SELECT complaint_id, title, description, category,
           severity, status, is_urgent, created_at
    FROM complaints
    WHERE community_id = $1
  `;

  const params = [communityId];

  if (fromDate) {
    query += ` AND created_at >= $${params.length + 1}`;
    params.push(fromDate);
  }

  if (toDate) {
    query += ` AND created_at <= $${params.length + 1}`;
    params.push(toDate);
  }

  query += ` ORDER BY created_at DESC`;

  if (limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const { rows } = await pool.query(query, params);
  return rows;
}

/*****************************************************************************************
 MODELS
*****************************************************************************************/

let embeddingPipeline;
let llmPipeline;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      "feature-extraction",
      SETTINGS.EMBEDDING_MODEL
    );
  }
  return embeddingPipeline;
}

async function getLLMPipeline() {
  if (!llmPipeline) {
    llmPipeline = await pipeline("text-generation", SETTINGS.LLM_MODEL);
  }
  return llmPipeline;
}

/*****************************************************************************************
 RAG SERVICE
*****************************************************************************************/

async function answerPolicyQuestion(question, communityId, topK) {
  const embedder = await getEmbeddingPipeline();
  const embedding = await embedder(question, {
    pooling: "mean",
    normalize: true,
  });

  const docs = await searchSimilarEmbeddings(
    Array.from(embedding.data),
    communityId || 0,
    "policy",
    topK,
    0.5
  );

  if (!docs.length) {
    return {
      answer: "No relevant policy documents found.",
      sources: [],
      confidence: "LOW",
    };
  }

  const context = docs
    .map((d, i) => `[Document ${i + 1}]\n${d.text_content}`)
    .join("\n\n");

  const prompt = `
Answer ONLY using the policy documents below.

${context}

Question: ${question}
Answer:
`;

  const generator = await getLLMPipeline();
  const output = await generator(prompt, { max_new_tokens: 300 });

  const avgSim =
    docs.reduce((s, d) => s + d.similarity_score, 0) / docs.length;

  return {
    answer: output[0].generated_text,
    sources: docs.map((d) => ({
      id: d.source_id,
      similarity: d.similarity_score,
    })),
    confidence: avgSim > 0.8 ? "HIGH" : avgSim > 0.6 ? "MEDIUM" : "LOW",
  };
}

/*****************************************************************************************
 MODERATION
*****************************************************************************************/

const sentiment = new Sentiment();
const profanityFilter = new Filter();

function analyzeModeration(text) {
  const sent = sentiment.analyze(text);
  const toxic = profanityFilter.isProfane(text);

  return {
    sentiment_label: sent.score >= 0 ? "POSITIVE" : "NEGATIVE",
    sentiment_score: sent.score,
    toxicity_label: toxic ? "TOXIC" : "SAFE",
    toxicity_score: toxic ? 0.9 : 0.1,
  };
}

/*****************************************************************************************
 EXPRESS APP
*****************************************************************************************/

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.json({
    service: "Community Governance AI/NLP Service",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", async (_, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", database: true });
  } catch {
    res.status(500).json({ status: "degraded", database: false });
  }
});

/*****************************************************************************************
 ENDPOINTS
*****************************************************************************************/

app.post("/ai/complaints/similar", async (req, res) => {
  const { community_id, title, description, top_k, similarity_threshold } =
    req.body;

  const embedder = await getEmbeddingPipeline();
  const embedding = await embedder(`${title}\n${description}`, {
    pooling: "mean",
    normalize: true,
  });

  const results = await searchSimilarEmbeddings(
    Array.from(embedding.data),
    community_id,
    "complaint",
    top_k || SETTINGS.TOP_K,
    similarity_threshold || SETTINGS.SIMILARITY_THRESHOLD
  );

  res.json({
    count: results.length,
    similar_complaints: results,
  });
});

app.post("/ai/complaints/summary", async (req, res) => {
  const { community_id, from_date, to_date, max_items } = req.body;
  const complaints = await getComplaints(
    community_id,
    from_date,
    to_date,
    max_items
  );

  res.json({
    total_complaints: complaints.length,
    urgent_count: complaints.filter((c) => c.is_urgent).length,
    summary_text: `Analyzed ${complaints.length} complaints.`,
  });
});

app.post("/ai/policy/qa", async (req, res) => {
  const { question, community_id, top_k } = req.body;
  const result = await answerPolicyQuestion(
    question,
    community_id,
    top_k || 3
  );
  res.json(result);
});

app.post("/ai/moderation/sentiment", async (req, res) => {
  res.json(analyzeModeration(req.body.text));
});

/*****************************************************************************************
 START SERVER
*****************************************************************************************/

app.listen(SETTINGS.PORT, () => {
  console.log(`🚀 AI Service running at http://localhost:${SETTINGS.PORT}`);
});

