# ╔══════════════════════════════════════════════════════════════════════════╗
#   chunking_strategies.py
#
#   All chunking logic lives here.
#   ingest.py imports from this file — no chunking code in ingest.py.
#
#   Strategies:
#     1. Structured Chunking  — chapter-level grouping (header detection)
#     2. Recursive Chunking   — splits oversized chapters recursively
#        └─ \n\n  →  \n  →  NLTK sentences  →  hard cut (last resort)
#     3. build_final_chunks() — glue: structured first, recursive fallback
# ╚══════════════════════════════════════════════════════════════════════════╝

import re
import nltk
import tiktoken
nltk.download("punkt",     quiet=True)
nltk.download("punkt_tab", quiet=True)
enc = tiktoken.get_encoding("cl100k_base")
DEFAULT_MAX_CHUNK_SIZE = 1000   # characters
DEFAULT_MIN_CHUNK_SIZE = 100    # characters

#   STRATEGY 1 — STRUCTURED CHUNKING  (chapter / section level)
def _is_chapter_header_page(text: str) -> bool:
    """
    Returns True if this page contains the recurring Hawai'i nutrition
    textbook chapter header.
    Pattern: "UNIVERSITY OF HAWAI…" (diacritic/punctuation tolerant).
    """
    return re.search(r"university\s+of\s+hawai", text, re.IGNORECASE) is not None


def _guess_chapter_title(text: str) -> str:
    """
    Extracts a chapter title from text that appears BEFORE the header line.
    Falls back to the first 120 characters when no clean title is found.
    """
    m = re.search(r"university\s+of\s+hawai", text, re.IGNORECASE)
    if m:
        title = re.sub(r"\s+", " ", text[: m.start()]).strip()
        if 10 <= len(title) <= 180:
            return title
    return (re.sub(r"\s+", " ", text).strip())[:120] or "Untitled Chapter"


def structured_chapter_chunks(pages: list[dict]) -> list[dict]:
    if not pages:
        return []

    # Locate all pages that open a new chapter
    chapter_starts = [
        i for i, p in enumerate(pages)
        if _is_chapter_header_page(p["text"])
    ]

    # No chapters detected → treat the whole document as one block
    if not chapter_starts:
        all_text = " ".join(p["text"] for p in pages).strip()
        return [
            {
                "chapter_index":     0,
                "title":             _guess_chapter_title(pages[0]["text"]),
                "page_start":        pages[0]["page_number"],
                "page_end":          pages[-1]["page_number"],
                "chunk_char_count":  len(all_text),
                "chunk_word_count":  len(all_text.split()),
                # FIX: use tiktoken instead of len/4 approximation
                "chunk_token_count": len(enc.encode(all_text)),
                "chunk_text":        all_text,
            }
        ]

    # Build chapter slices
    chunks = []
    for ci, s in enumerate(chapter_starts):
        e      = (chapter_starts[ci + 1] - 1) if (ci + 1 < len(chapter_starts)) else (len(pages) - 1)
        slice_ = pages[s : e + 1]
        text   = " ".join(p["text"] for p in slice_).strip()
        title  = _guess_chapter_title(slice_[0]["text"])

        chunks.append(
            {
                "chapter_index":     ci,
                "title":             title,
                "page_start":        slice_[0]["page_number"],
                "page_end":          slice_[-1]["page_number"],
                "chunk_char_count":  len(text),
                "chunk_word_count":  len(text.split()),
                # FIX: use tiktoken instead of len/4 approximation
                "chunk_token_count": len(enc.encode(text)),
                "chunk_text":        text,
            }
        )

    return chunks


#   STRATEGY 2 — RECURSIVE CHUNKING  (fallback for oversized blocks)
def _recursive_split(text: str, max_size: int) -> list[str]:
    if len(text) <= max_size:
        return [text]

    # ── Level 1: paragraph split
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) > 1:
        result = []
        for para in paragraphs:
            result.extend(_recursive_split(para, max_size))
        return result
        
    # ── Level 2: line split
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if len(lines) > 1:
        result = []
        for line in lines:
            result.extend(_recursive_split(line, max_size))
        return result

    # ── Level 3: sentence split (NLTK) ────────────────────────────────────
    sentences = nltk.sent_tokenize(text)
    if len(sentences) > 1:
        chunks: list[str] = []
        current: list[str] = []
        current_len = 0

        for sent in sentences:
            # FIX: flush current buffer when adding the next sentence would
            # exceed max_size, but only if current is non-empty.
            # Original code had correct logic; this comment clarifies intent.
            if current_len + len(sent) > max_size and current:
                chunks.append(" ".join(current))
                current, current_len = [], 0
            current.append(sent)
            current_len += len(sent)

        if current:
            chunks.append(" ".join(current))

        # Each sentence-group might still be large → recurse once more
        result = []
        for c in chunks:
            result.extend(_recursive_split(c, max_size))
        return result

    # ── Level 4: hard character cut (single unsplittable blob) ────────────
    return [text[i : i + max_size] for i in range(0, len(text), max_size)]


def recursive_chunk_text(
    text: str,
    max_chunk_size: int = DEFAULT_MAX_CHUNK_SIZE,
    min_chunk_size: int = DEFAULT_MIN_CHUNK_SIZE,
) -> list[str]:
    raw = _recursive_split(text, max_chunk_size)
    # Architecture step: "Remove tiny chunks" — applied once, after all splits
    return [c for c in raw if len(c) >= min_chunk_size]

#   GLUE — build_final_chunks()
#   Called by ingest.py — combines both strategies
def build_final_chunks(
    pages: list[dict],
    doc_id: str,
    pdf_path: str,
    max_chunk_size: int = DEFAULT_MAX_CHUNK_SIZE,
    min_chunk_size: int = DEFAULT_MIN_CHUNK_SIZE,
) -> list[dict]:
    # ── Step 1: structural chunking
    chapter_chunks = structured_chapter_chunks(pages)
    print(f"  Structured chunks (chapters) detected : {len(chapter_chunks)}")

    final_chunks: list[dict] = []
    global_idx = 0  # unique index across ALL chapters and sub-chunks

    # ── Step 2: recursive fallback for oversized chapters 
    for ch in chapter_chunks:
        text     = ch["chunk_text"]
        char_len = ch["chunk_char_count"]

        if char_len <= max_chunk_size:
            # Fits within limit → keep as a single chunk (sub_chunk_index = 0)
            sub_texts = [text]
        else:
            # Too large → split recursively; tiny fragments removed inside
            sub_texts = recursive_chunk_text(text, max_chunk_size, min_chunk_size)

        # ── Step 3: attach metadata and build final row dicts
        for sub_i, sub_text in enumerate(sub_texts):
            # FIX: token count is consistent — tiktoken used here AND in
            # structured_chapter_chunks() (was len/4 there previously)
            token_count = len(enc.encode(sub_text))

            final_chunks.append(
                {
                    "doc_id":      doc_id,
                    "chunk_index": global_idx,
                    "content":     sub_text,
                    "metadata": {
                        "source":          pdf_path,
                        "chapter_index":   ch["chapter_index"],
                        "chapter_title":   ch["title"],
                        "page_start":      ch["page_start"],
                        "page_end":        ch["page_end"],
                        "sub_chunk_index": sub_i,
                        "char_count":      len(sub_text),
                        "word_count":      len(sub_text.split()),
                        "token_count":     token_count,
                    },
                }
            )
            global_idx += 1

    print(f"  Final chunks produced                 : {len(final_chunks)}")
    return final_chunks
