#!/usr/bin/env python3
"""
study_ingest.py

Phase 5 - builds the Study index from coached hands:

- Finds hands_silver rows that have GTO + learning_tag
  and are not yet in study_chunks.
- Builds a text summary per hand.
- Calls the embeddings API.
- Inserts into public.study_chunks.
"""

import os
import sys
import logging
from typing import List, Dict, Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor, register_uuid

from openai import OpenAI

# --------------------------------------------------------------------- logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)
register_uuid()

# --------------------------------------------------------------------- .env helpers (similar to coach_worker)

def load_env_file(path: Optional[str] = None) -> None:
    """
    Load key=value lines from a .env file into os.environ
    if they are not already set.
    """
    # --- CHANGED SECTION START ---
    if path is None:
        # Look in the current folder (backend)
        path = ".env"
    # --- CHANGED SECTION END ---

    if not os.path.exists(path):
        logger.info(".env file not found at %s - skipping .env load", path)
        return
    
    # ... (rest of the function stays the same)

    logger.info("Loading environment variables from %s", path)
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception as e:
        logger.warning("Failed to load .env file %s: %s", path, e)


def get_db_url() -> str:
    """
    Match coach_worker.py logic:
    accept DATABASE_URL or SUPABASE_* fallbacks.
    """
    db_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
    )
    if not db_url:
        raise RuntimeError("DATABASE_URL / SUPABASE_DB_URL is missing")
    return db_url


# --------------------------------------------------------------------- env bootstrap

# Load ~/.env so DATABASE_URL, OPENAI_API_KEY, etc. are available
load_env_file()

try:
    DB_URL = get_db_url()
except RuntimeError as e:
    logger.error(str(e))
    sys.exit(1)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY is not set (add it to ~/.env)")
    sys.exit(1)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

client = OpenAI(api_key=OPENAI_API_KEY)


def pg_conn():
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)


# --------------------------------------------------------------------- helpers

def build_content(row: Dict[str, Any]) -> str:
    """
    Build a single text chunk for a hand using the coach output +
    some metadata. This is what we will embed and store.
    """
    site = row.get("site") or "Unknown"
    stakes = row.get("stakes_bucket") or row.get("stakes_raw") or "Unknown stakes"
    hero_pos = row.get("hero_position") or row.get("position_norm") or "Unknown position"
    street = row.get("street_reached") or "preflop"
    tags = row.get("learning_tag") or []
    tags_str = ", ".join(tags) if tags else "none"

    header = (
        f"Site: {site} | Stakes: {stakes} | Hero position: {hero_pos} | "
        f"Street reached: {street}\n"
        f"Coach tags: [{tags_str}]\n\n"
    )

    gto = (row.get("gto_strategy") or "").strip()
    dev = (row.get("exploit_deviation") or "").strip()

    body_parts: List[str] = []
    if gto:
        body_parts.append("GTO Strategy:\n" + gto)
    if dev:
        body_parts.append(
            "\nExploit Deviation (what went wrong / how to adjust):\n" + dev
        )

    body = "\n".join(body_parts) if body_parts else "No strategy text."
    return header + body


def embed_text(text: str) -> List[float]:
    """Call embedding model and return vector."""
    resp = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return resp.data[0].embedding


# --------------------------------------------------------------------- main SQL

FETCH_SQL = """
select
  hs.hand_id,
  hs.user_id,
  hs.stakes_bucket,
  hs.stakes_raw,
  hs.position_norm,
  hs.hero_position,
  hs.site,
  hs.street_reached,
  hs.gto_strategy,
  hs.exploit_deviation,
  coalesce(hs.learning_tag, '{}') as learning_tag
from public.hands_silver hs
left join public.study_chunks sc
  on sc.source = 'hand' and sc.ref_id = hs.hand_id::text
where hs.gto_strategy is not null
  and hs.learning_tag is not null
  and sc.id is null
order by hs.hand_date nulls last, hs.hand_id
limit %s;
"""

INSERT_SQL = """
insert into public.study_chunks (
  user_id,
  source,
  ref_id,
  content,
  tokens,
  stakes_bucket,
  position_norm,
  street,
  tags,
  embedding
) values (
  %(user_id)s,
  'hand',
  %(ref_id)s,
  %(content)s,
  %(tokens)s,
  %(stakes_bucket)s,
  %(position_norm)s,
  %(street)s,
  %(tags)s,
  %(embedding)s
);
"""


def fetch_new_hands(limit: int = 50) -> List[Dict[str, Any]]:
    with pg_conn() as conn, conn.cursor() as cur:
        cur.execute(FETCH_SQL, (limit,))
        return cur.fetchall()


def insert_chunks(rows: List[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    with pg_conn() as conn, conn.cursor() as cur:
        for r in rows:
            cur.execute(INSERT_SQL, r)
    return len(rows)


def run_once(batch_size: int = 20) -> None:
    logger.info("study_ingest: starting, batch_size=%d", batch_size)
    hands = fetch_new_hands(batch_size)
    if not hands:
        logger.info("study_ingest: no new coached hands to index.")
        return

    prepared_rows: List[Dict[str, Any]] = []
    for h in hands:
        content = build_content(h)
        emb = embed_text(content)

        prepared_rows.append(
            {
                "user_id": h["user_id"],
                "ref_id": str(h["hand_id"]),
                "content": content,
                "tokens": len(content.split()),  # rough token estimate
                "stakes_bucket": h.get("stakes_bucket"),
                "position_norm": h.get("hero_position") or h.get("position_norm"),
                "street": h.get("street_reached"),
                "tags": h.get("learning_tag") or [],
                "embedding": emb,
            }
        )

    inserted = insert_chunks(prepared_rows)
    logger.info("study_ingest: inserted %d study_chunks rows.", inserted)


# --------------------------------------------------------------------- entrypoint

if __name__ == "__main__":
    try:
        bs = int(os.getenv("STUDY_BATCH_SIZE", "20"))
    except ValueError:
        bs = 20
    run_once(batch_size=bs)

