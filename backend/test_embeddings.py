import os
import textwrap
from supabase import create_client
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPERBASEURL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPERBASE_SERVICE_ROLE_KEY"]

PDF_PATH = "human-nutrition-text.pdf"
TOP_K = 3

sb = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)

model = SentenceTransformer("all-MiniLM-L6-v2")

queries = [
    "What are micronutrients?",
    "water soluble vitamins"
]

for q in queries:

    e = model.encode(
        q,
        convert_to_numpy=True
    ).tolist()

    resp = sb.rpc(
        "match_documents",
        {
            "query_embedding": e,
            "match_count": TOP_K,
            "filter": {
                "source": PDF_PATH
            }
        }
    ).execute()

    print("\n" + "=" * 80)
    print("QUERY:", q)

    rows = resp.data or []

    for r in rows:
        print(
            f"Page {r['metadata'].get('page')} "
            f"Similarity {r['similarity']:.3f}"
        )

        print(
            textwrap.shorten(
                r["content"],
                width=150
            )
        )
