// npm install groq-sdk
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ----------------------
// GROQ
// ----------------------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ----------------------
// SUPABASE
// ----------------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// ----------------------
// EMBEDDING MODEL
// ----------------------
let extractor: any = null;

function getPageLabel(chunk: any) {
  if (chunk?.metadata?.page != null) {
    return String(chunk.metadata.page)
  }

  const pageStart = chunk?.metadata?.page_start
  const pageEnd = chunk?.metadata?.page_end

  if (pageStart != null && pageEnd != null) {
    return pageStart === pageEnd ? String(pageStart) : `${pageStart}-${pageEnd}`
  }

  return '?'
}

function toCitations(chunks: any[]) {
  const seen = new Set<string>()

  return chunks
    .map((chunk, index) => ({
      page: getPageLabel(chunk),
      text: chunk?.content ?? '',
      highlight: chunk?.content ?? '',
      source: index + 1,
    }))
    .filter((citation) => {
      const signature = `${citation.page}::${citation.text}::${citation.highlight}`
      if (seen.has(signature)) return false
      seen.add(signature)
      return true
    })
}

async function getEmbedding(text: string) {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}

// ----------------------
// API ROUTE
// ----------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message?.trim();

    if (!message) {
      return Response.json(
        { error: "Empty query" },
        { status: 400 }
      );
    }

    // Generate query embedding
    const queryEmbedding = await getEmbedding(message);

    // Retrieve relevant chunks
    const { data: chunks, error } = await supabase.rpc(
      "match_documents",
      {
        query_embedding: queryEmbedding,
        match_count: 8,
        filter: {
          source: "human-nutrition-text.pdf",
        },
      }
    );

    if (error) {
      throw error;
    }

    const context = (chunks || [])
      .map(
        (c: any, i: number) =>
          `[${i + 1}] (Page ${
            c.metadata?.page ?? "?"
          }) ${c.content}`
      )
      .join("\n\n");

    if (!context) {
      return Response.json({
        answer: 'No relevant context was found for that question.',
        sources: [],
        citations: [],
      });
    }

    const prompt = `
You are a strict RAG assistant.

Rules:
1. Answer ONLY from the provided context.
2. Cite sources like [1], [2].
3. Mention page numbers when possible.


QUESTION:
${message}

CONTEXT:
${context}
`;

    // ----------------------
    // GROQ LLM
    // ----------------------
    const completion =
      await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

    const answer =
      completion.choices[0]?.message?.content ||
      "No response generated.";

    return Response.json({
      answer,
      sources: chunks,
      citations: toCitations(chunks || []),
    });
  } catch (error: any) {
    console.error(error);

    return Response.json(
      {
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}