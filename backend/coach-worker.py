import os
import time
import json
import requests
import psycopg2

from dotenv import load_dotenv

# Load env from /home/ec2-user/.env  (same as your other worker)
load_dotenv("/home/ec2-user/.env")

DB_URL          = os.environ["DATABASE_URL"]
COACH_API_URL   = os.environ["COACH_API_URL"]
COACH_API_TOKEN = os.environ["COACH_API_TOKEN"]

BATCH  = int(os.getenv("COACH_BATCH", "5"))
SLEEP  = float(os.getenv("COACH_SLEEP_SECONDS", "1.5"))


def pg():
    # Same connection as phase-2 worker
    return psycopg2.connect(DB_URL)


def fetch_batch(cur):
    """
    Claim a small batch of hands that still need coaching.
    """
    cur.execute(
        """
        SELECT id, raw_text, date, stakes, position, cards, board
        FROM public.hands
        WHERE gto_strategy IS NULL
        ORDER BY created_at
        LIMIT %s
        """,
        (BATCH,),
    )
    return cur.fetchall()


def call_coach(raw_text, date, stakes, position, cards, board):
    """
    Call your Next.js /api/coach/analyze-hand endpoint.
    """
    payload = {
        "raw_text": raw_text,
        "date": str(date) if date else None,
        "stakes": stakes,
        "position": position,
        "cards": cards,
        "board": board,
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-APP-TOKEN": COACH_API_TOKEN,
    }

    resp = requests.post(
        COACH_API_URL,
        data=json.dumps(payload),
        headers=headers,
        timeout=90,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"coach HTTP {resp.status_code}: {resp.text[:200]}")

    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"coach returned non-JSON: {resp.text[:200]}")

    gto  = data.get("gto_strategy") or ""
    dev  = data.get("exploit_deviation") or ""
    tags = data.get("learning_tag") or []

    # ensure tags is always a list of strings
    if not isinstance(tags, list):
        tags = [str(tags)]
    else:
        tags = [str(t).strip() for t in tags if str(t).strip()]

    return gto, dev, tags


def main():
    conn = pg()
    try:
        cur = conn.cursor()

        rows = fetch_batch(cur)
        if not rows:
            print("Nothing to do.")
            return

        for (hand_id, raw_text, date, stakes, position, cards, board) in rows:
            try:
                gto, dev, tags = call_coach(
                    raw_text=raw_text,
                    date=date,
                    stakes=stakes,
                    position=position,
                    cards=cards,
                    board=board,
                )

                # UPDATE hands with the new fields
                cur.execute(
                    """
                    UPDATE public.hands
                    SET gto_strategy = %s,
                        exploit_deviation = %s,
                        learning_tag = %s
                    WHERE id = %s
                    """,
                    (gto, dev, tags, hand_id),
                )

                print(f"OK hand {hand_id}: tags={tags}")
                # ✅ make sure this actually hits the DB
                conn.commit()

            except Exception as e:
                # rollback this hand but keep going
                conn.rollback()
                print(f"ERR hand {hand_id}: {e}")

            time.sleep(SLEEP)

        print(f"Done. Processed {len(rows)} hand(s).")

    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()

