# ╔══════════════════════════════════════════════════════════════════════════╗
#   ingest.py  —  MAIN ENTRY POINT
#
#   Responsibilities:
#     1. Read PDF  (PyMuPDF)
#     2. Call chunking_strategies.build_final_chunks()   ← all logic there
#     3. Embed chunks  (SentenceTransformer)
#     4. Upload to Supabase
#
#   Install:
#   pip install pymupdf tiktoken supabase sentence-transformers nltk tqdm python-dotenv
# ╚══════════════════════════════════════════════════════════════════════════╝

import csv
import json
import os
import re
import fitz                          # PyMuPDF
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
from dotenv import load_dotenv, find_dotenv

# ── Import ALL chunking logic from chunking_strategies.py ─────────────────
from chunking import build_final_chunks

# ── Environment ───────────────────────────────────────────────────────────
load_dotenv(find_dotenv(usecwd=True))

SUPABASE_URL              = os.environ["SUPERBASEURL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPERBASE_SERVICE_ROLE_KEY"]

# ── Config ─────────────────────────────────────────────────────────────────
PDF_PATH    = "human-nutrition-text.pdf"
DOC_ID      = "nutrition-v1"
EMBED_MODEL = "all-MiniLM-L6-v2"

MAX_CHUNK_SIZE = 1000   # chars — passed to chunking_strategies
MIN_CHUNK_SIZE = 80    # chars — passed to chunking_strategies

BATCH_EMBED  = 100
BATCH_INSERT = 200
CSV_PATH = "chunks_export.csv"


# ╔══════════════════════════════════════════════════════════════════════════╗
#   STEP 1 — PDF READING
# ╚══════════════════════════════════════════════════════════════════════════╝

def clean_text(t: str) -> str:
    """Normalise whitespace and remove soft-hyphens from PDF text."""
    t = t.replace("\r", " ")
    t = re.sub(r"-\s*\n\s*", "", t)   # join hyphenated line breaks
    t = re.sub(r"\s+\n", "\n", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


def read_pdf_pages(path: str) -> list[dict]:
    """
    Reads every page of the PDF and returns:
        [{"page_number": int, "text": str}, ...]
    page_number is 1-based.
    """
    pages = []
    doc   = fitz.open(path)
    try:
        for i in range(len(doc)):
            raw  = doc[i].get_text("text") or ""
            text = clean_text(raw)
            pages.append({"page_number": i + 1, "text": text})
    finally:
        doc.close()
    return pages


# ╔══════════════════════════════════════════════════════════════════════════╗
#   STEP 2 — EMBED
# ╚══════════════════════════════════════════════════════════════════════════╝

def embed_chunks(chunks: list[dict], model: SentenceTransformer) -> list[dict]:
    """
    Adds an 'embedding' key to every chunk dict (in-place).
    Processes in batches of BATCH_EMBED for memory efficiency.
    """
    texts = [c["content"] for c in chunks]
    print(f"  Embedding {len(texts)} chunks (batch size = {BATCH_EMBED})...")

    all_vectors = []
    for i in tqdm(range(0, len(texts), BATCH_EMBED), desc="Embedding"):
        batch      = texts[i : i + BATCH_EMBED]
        embeddings = model.encode(batch, convert_to_numpy=True, show_progress_bar=False)
        all_vectors.extend(embeddings.tolist())

    for chunk, vec in zip(chunks, all_vectors):
        chunk["embedding"] = vec

    return chunks


# ╔══════════════════════════════════════════════════════════════════════════╗
#   STEP 3 — UPLOAD TO SUPABASE
# ╚══════════════════════════════════════════════════════════════════════════╝

def upload_chunks(chunks: list[dict], sb: Client) -> None:
    """Inserts final chunk rows into the 'chunks' table in batches."""
    print(f"  Uploading {len(chunks)} rows (batch size = {BATCH_INSERT})...")
    for i in tqdm(range(0, len(chunks), BATCH_INSERT), desc="Uploading"):
        batch = chunks[i : i + BATCH_INSERT]

        sb.table("chunks").insert(chunks[i:i + BATCH_INSERT]).execute()
        with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "doc_id",
                    "chunk_index",
                    "content",
                    "source",
                    "chapter_index",
                    "chapter_title",
                    "page_start",
                    "page_end",
                    "sub_chunk_index",
                    "char_count",
                    "word_count",
                    "token_count",
                    "embedding",
                ],
            )
            if f.tell() == 0:
                writer.writeheader()

            for chunk in batch:
                metadata = chunk.get("metadata", {})
                writer.writerow(
                    {
                        "doc_id": chunk.get("doc_id", ""),
                        "chunk_index": chunk.get("chunk_index", ""),
                        "content": chunk.get("content", ""),
                        "source": metadata.get("source", ""),
                        "chapter_index": metadata.get("chapter_index", ""),
                        "chapter_title": metadata.get("chapter_title", ""),
                        "page_start": metadata.get("page_start", ""),
                        "page_end": metadata.get("page_end", ""),
                        "sub_chunk_index": metadata.get("sub_chunk_index", ""),
                        "char_count": metadata.get("char_count", ""),
                        "word_count": metadata.get("word_count", ""),
                        "token_count": metadata.get("token_count", ""),
                        "embedding": json.dumps(chunk.get("embedding", [])),
                    }
                )

        sb.table("chunks").insert(batch).execute()


# ╔══════════════════════════════════════════════════════════════════════════╗
#   MAIN
# ╚══════════════════════════════════════════════════════════════════════════╝

def main():
    # ── Supabase ───────────────────────────────────────────────────────────
    sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # ── Embedding model ────────────────────────────────────────────────────
    print("Loading embedding model...")
    model = SentenceTransformer(EMBED_MODEL)

    # ── Clear old data ─────────────────────────────────────────────────────
    print(f"Clearing old chunks for doc_id='{DOC_ID}'...")
    sb.table("chunks").delete().eq("doc_id", DOC_ID).execute()

    # ── Step 1: Read PDF ───────────────────────────────────────────────────
    print(f"\n[1/3] Reading PDF: {PDF_PATH}")
    pages = read_pdf_pages(PDF_PATH)
    print(f"      Pages read: {len(pages)}")

    # ── Step 2: Chunk (delegated to chunking_strategies.py) ───────────────
    print("\n[2/3] Chunking  (structured → recursive fallback)...")
    final_chunks = build_final_chunks(
        pages          = pages,
        doc_id         = DOC_ID,
        pdf_path       = PDF_PATH,
        max_chunk_size = MAX_CHUNK_SIZE,
        min_chunk_size = MIN_CHUNK_SIZE,
    )
    print(f"      Final chunks ready: {len(final_chunks)}")

    # ── Step 3: Embed ──────────────────────────────────────────────────────
    print("\n[3/3] Embedding + Uploading...")
    embed_chunks(final_chunks, model)

    # ── Step 4: Upload ─────────────────────────────────────────────────────
    upload_chunks(final_chunks, sb)

    print(f"\n✅  Done! Inserted {len(final_chunks)} chunks into Supabase.")


if __name__ == "__main__":
    main()
