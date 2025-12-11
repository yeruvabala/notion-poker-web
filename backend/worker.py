#!/usr/bin/env python3

import os, re, sys, time
from datetime import datetime

import boto3
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ----- Env -------------------------------------------------------------------
HOME = os.path.expanduser("~")
ENV_PATH = os.path.join(HOME, ".env")
load_dotenv(ENV_PATH)  # cron-safe explicit load

DB_URL = os.getenv("DATABASE_URL")  # must include ?sslmode=require
REGION = os.getenv("AWS_REGION", "us-east-1")
BUCKET = os.getenv("AWS_S3_BUCKET")
AWS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SEC = os.getenv("AWS_SECRET_ACCESS_KEY")
BATCH  = int(os.getenv("HAND_FILES_BATCH", "5"))

if not DB_URL or "sslmode=require" not in (DB_URL or ""):
    print("ERROR: DATABASE_URL missing or not enforcing TLS (?sslmode=require).", file=sys.stderr)
    sys.exit(1)
if not BUCKET:
    print("ERROR: AWS_S3_BUCKET is required.", file=sys.stderr)
    sys.exit(1)

# ----- Utils -----------------------------------------------------------------
def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"{ts} | {msg}", flush=True)

def pg():
    return psycopg2.connect(DB_URL)

def s3_client():
    kwargs = {"region_name": REGION}
    if AWS_KEY and AWS_SEC:
        kwargs.update(aws_access_key_id=AWS_KEY, aws_secret_access_key=AWS_SEC)
    return boto3.client("s3", **kwargs)

S3 = s3_client()

def parse_s3_path(storage_path: str):
    storage_path = (storage_path or "").strip()
    m = re.match(r"^s3://([^/]+)/(.+)$", storage_path)
    if m:
        return m.group(1), m.group(2)
    return BUCKET, storage_path

def download_text(bucket: str, key: str) -> str:
    obj = S3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read().decode("utf-8", errors="replace")


# ----- Hand splitting --------------------------------------------------------

# Generic "hand header" patterns used by many sites.
# Examples this will match:
#   "PokerStars Hand #1234567890:  Hold'em ..."
#   "Americas Cardroom Hand #123456789:  Holdem ..."
#   "Ignition Hand #123456789:  Hold'em ..."
#   "ClubGG Hand #123456789:  Hold'em ..."
#   "***** Hand History for Game 123456789 *****"
HAND_HEADER_RE = re.compile(
    r"""^(
          .*Hand\ #\d+.*              # most modern sites: 'SiteName Hand #123...'
        | \*{3,}\s*Hand\ History\ for\ Game\ \d+.*   # '*** Hand History for Game 123...'
       )""",
    re.MULTILINE | re.VERBOSE
)

def split_into_blocks(txt: str):
    """
    Split a hand history file into per-hand text blocks.

    Strategy:
      1) Normalize newlines to '\n'.
      2) Try to detect standard "hand header" lines using HAND_HEADER_RE.
         Each match marks the start of a new hand.
      3) Slice from each header to the next header -> one block per hand.
      4) If no headers are found (unknown format), fall back to splitting
         on blank lines, like the original implementation.

    Returns:
        List[str] where each element is one full hand history.
    """
    norm = txt.replace("\r\n", "\n")

    matches = list(HAND_HEADER_RE.finditer(norm))

    if matches:
        blocks = []
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(norm)
            chunk = norm[start:end].strip()
            # basic sanity filter: avoid tiny junk blocks
            if len(chunk) > 50:
                blocks.append(chunk)
        return blocks

    # Fallback: unknown format, use old "blank line" heuristic
    raw_blocks = [b.strip() for b in re.split(r"\n\s*\n", norm)]
    return [b for b in raw_blocks if len(b) > 50]


# ----- DB ops ----------------------------------------------------------------
CLAIM_SQL = """
WITH cte AS (
  SELECT id, user_id, storage_path
  FROM public.hand_files
  WHERE status IN ('new','error')
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT %s
)
UPDATE public.hand_files h
   SET status = 'processing'
  FROM cte
 WHERE h.id = cte.id
RETURNING h.id, cte.user_id, cte.storage_path;
"""

def claim_hand_files(limit: int):
    with pg() as conn, conn.cursor() as cur:
        cur.execute(CLAIM_SQL, (limit,))
        rows = cur.fetchall()
        conn.commit()
        return rows

INSERT_HANDS_SQL = """
  INSERT INTO public.hands (user_id, source_used, raw_text)
  VALUES %s
"""

def insert_hands(user_id, blocks):
    if not blocks:
        return 0
    rows = [(user_id, "upload", b) for b in blocks]
    with pg() as conn, conn.cursor() as cur:
        execute_values(cur, INSERT_HANDS_SQL, rows, page_size=200)
        conn.commit()
    return len(rows)

def set_status(file_id, status, err=None):
    with pg() as conn, conn.cursor() as cur:
        if err is None:
            cur.execute(
                "UPDATE public.hand_files SET status=%s WHERE id=%s",
                (status, file_id),
            )
        else:
            cur.execute(
                """
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public'
                      AND table_name='hand_files'
                      AND column_name='error'
                  ) THEN
                    UPDATE public.hand_files
                       SET status=%s, error=%s
                     WHERE id=%s;
                  ELSE
                    UPDATE public.hand_files
                       SET status=%s
                     WHERE id=%s;
                  END IF;
                END $$;
                """,
                (status, (err or "")[:250], file_id, status, file_id),
            )
        conn.commit()


# ----- Processing -------------------------------------------------------------
def process_one(file_id, user_id, storage_path):
    bucket, key = parse_s3_path(storage_path)
    log(f"processing file_id={file_id} user={user_id} s3={bucket}/{key}")
    txt = download_text(bucket, key)
    blocks = split_into_blocks(txt)
    log(f"split_into_blocks: {len(blocks)} hands detected")
    n = insert_hands(user_id, blocks)
    set_status(file_id, "done")
    log(f"OK file_id={file_id} inserted_hands={n}")

def main():
    claimed = claim_hand_files(BATCH)
    log(f"claimed={len(claimed)}")
    for file_id, user_id, storage_path in claimed:
        try:
            process_one(file_id, user_id, storage_path)
        except Exception as e:
            try:
                set_status(file_id, "error", str(e))
            except Exception:
                pass
            log(f"ERROR file_id={file_id}: {e}")

if __name__ == "__main__":
    t0 = time.time()
    try:
        main()
    finally:
        log(f"finished in {time.time()-t0:.2f}s")

