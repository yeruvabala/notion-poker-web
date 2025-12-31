#!/usr/bin/env python3
"""
coach_worker.py  —  Coach + Silver enrichment

Step 1 (Coach):
- Find hands with gto_strategy IS NULL, call /api/coach/analyze-hand,
  and update gto_strategy / exploit_deviation / learning_tag.

Step 2 (Silver):
- If stakes missing, parse from raw_text; compute small_blind/big_blind.
- Normalize position; infer Hero position from seats+button (2–9 players).
- Extract cards/board from raw HH if Bronze didn't fill them.
- Detect site, game_type, table_size, street_reached.
- Detect preflop_open / 3bet / 4bet / all_in / preflop_call.
- Detect currency + result_amount/result_bb (Hero win line or loss via invested total).
- Normalize learning_tag vocabulary (stable keys for dashboards).
"""

import os
import logging
import re
import json
from decimal import Decimal, InvalidOperation
from typing import Optional, Tuple, List, Dict, Any
from urllib import request, error

import psycopg2
from psycopg2.extras import RealDictCursor, register_uuid

# -----------------------------------------------------------------------------
# Logging setup
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

register_uuid()

# -----------------------------------------------------------------------------
# .env loader (same style as worker.py)
# -----------------------------------------------------------------------------
def load_env_file(path: Optional[str] = None) -> None:
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        logger.info(".env file not found at %s - skipping .env load", path)
        return
    logger.info("Loading environment variables from %s", path)
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k and k not in os.environ:
                    os.environ[k.strip()] = v.strip()
    except Exception as e:
        logger.warning("Failed to load .env file %s: %s", path, e)

# -----------------------------------------------------------------------------
# DB connection helpers
# -----------------------------------------------------------------------------
def get_db_url() -> str:
    db_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
    )
    if not db_url:
        raise RuntimeError("DATABASE_URL is missing")
    return db_url

def get_pg_conn():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    conn.autocommit = True
    return conn

# -----------------------------------------------------------------------------
# Position Annotation Helper
# -----------------------------------------------------------------------------
def annotate_raw_text_with_positions(raw_text: str, replayer_data: Dict[str, Any]) -> str:
    """
    Annotate player names in the raw text with their positions.
    
    Example:
      Before: "namesarehard raises $0.62 to $0.62"
      After:  "namesarehard (HJ) raises $0.62 to $0.62"
    
    This prevents LLM hallucinations about player positions.
    """
    if not replayer_data or 'players' not in replayer_data:
        return raw_text
    
    # Build name -> position mapping
    # Prefer dynamic inference to fix stale replayer data
    position_map = {}
    try:
        position_map = infer_positions_from_text(raw_text)
    except:
        pass
        
    # Fallback to replayer data if inference empty
    if not position_map and replayer_data and 'players' in replayer_data:
        for player in replayer_data.get('players', []):
            name = player.get('name')
            position = player.get('position')
            if name and position:
                position_map[name] = position
    
    if not position_map:
        return raw_text
    
    # Only annotate the action section (after "*** HOLE CARDS ***")
    if "*** HOLE CARDS ***" not in raw_text:
        return raw_text
    
    parts = raw_text.split("*** HOLE CARDS ***", 1)
    header = parts[0]
    action_section = parts[1] if len(parts) > 1 else ""
    
    # Annotate each player name in the action section
    # Sort by length (longest first) to avoid partial matches
    sorted_names = sorted(position_map.keys(), key=len, reverse=True)
    
    annotated_action = action_section
    for name in sorted_names:
        position = position_map[name]
        # Use word boundaries to avoid partial matches
        # Replace "PlayerName" with "PlayerName (POSITION)"
        import re
        pattern = r'\b' + re.escape(name) + r'\b'
        replacement = f"{name} ({position})"
        annotated_action = re.sub(pattern, replacement, annotated_action)
    
    return header + "*** HOLE CARDS ***" + annotated_action

# -----------------------------------------------------------------------------
# Coach API call
# -----------------------------------------------------------------------------
def call_coach_api(
    hand_id: Any,
    raw_text: str,
    parsed_data: Optional[Dict[str, Any]] = None,
    replayer_data: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    url = os.getenv("COACH_API_URL")
    token = os.getenv("COACH_API_TOKEN")
    if not url or not token:
        logger.error("COACH_API_URL or COACH_API_TOKEN not set; skipping coaching.")
        return None, None, None

    payload = {"hand_id": str(hand_id), "raw_text": raw_text}
    # Include pre-parsed data if available (improves accuracy)
    if parsed_data:
        payload["parsed"] = parsed_data
    # Include replayer_data (full parsed hand with actions, board, etc)
    if replayer_data:
        payload["replayer_data"] = replayer_data
    
    # DEBUG: Log the payload
    # logging.info(f"DEBUG_PAYLOAD: position={payload.get('parsed', {}).get('position')} payload_pos={payload.get('position')}")
    print(f"DEBUG_PAYLOAD: position={payload.get('parsed', {}).get('position')} payload_pos={payload.get('position')}")

    data_bytes = json.dumps(payload).encode("utf-8")
    headers = { "Content-Type": "application/json", "x-app-token": token }
    req = request.Request(url, data=data_bytes, headers=headers, method="POST")

    try:
        with request.urlopen(req, timeout=180) as resp:
            body = resp.read()
        resp_json = json.loads(body.decode("utf-8"))

        # Return full response dict instead of unpacking
        # This allows accessing hero_position and other fields
        gto = resp_json.get("gto_strategy")
        dev = resp_json.get("exploit_deviation")
        lt  = resp_json.get("learning_tag")
        hero_pos = resp_json.get("hero_position")
        exploit_sigs = resp_json.get("exploit_signals")  # NEW: Agent 7 data
        
        if lt is None:
            lt_list: Optional[List[str]] = []
        elif isinstance(lt, list):
            lt_list = [str(x) for x in lt if str(x).strip()]
        else:
            lt_list = [str(lt)]
        
        return {"gto_strategy": gto, "exploit_deviation": dev, "learning_tag": lt_list, "hero_position": hero_pos, "exploit_signals": exploit_sigs}

    except error.HTTPError as e:
        try: err_body = e.read().decode("utf-8")
        except: err_body = "<no body>"
        logger.error("Coach API HTTP error for hand %s: %s; body=%s", hand_id, e, err_body)
    except error.URLError as e:
        logger.error("Coach API URL error for hand %s: %s", hand_id, e)
    except Exception as e:
        logger.error("Coach API unexpected error for hand %s: %s", hand_id, e)
    return None

def fetch_hands_for_coaching(conn, limit: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT id, user_id, raw_text, position, cards, board, stakes, replayer_data
        FROM public.hands
        WHERE gto_strategy IS NULL
          AND raw_text IS NOT NULL
        ORDER BY COALESCE(date, created_at::date), id
        LIMIT %s;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (limit,))
        return cur.fetchall()

def extract_parsed_data(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Extract structured data from the row to pass to the coach API.
    This includes position, cards, board, stakes, and action history from replayer_data.
    """
    replayer = row.get("replayer_data") or {}
    
    # Build board from replayer_data (stored as array like ["8♥", "8♦", "A♠", "3♥"])
    board_arr = replayer.get("board", [])
    if isinstance(board_arr, list):
        flop_cards = " ".join(board_arr[:3]) if len(board_arr) >= 3 else ""
        turn_card = board_arr[3] if len(board_arr) >= 4 else ""
        river_card = board_arr[4] if len(board_arr) >= 5 else ""
    else:
        # Fallback for object format {"flop": "...", "turn": "...", "river": "..."}
        flop_cards = board_arr.get("flop", "") if isinstance(board_arr, dict) else ""
        turn_card = board_arr.get("turn", "") if isinstance(board_arr, dict) else ""
        river_card = board_arr.get("river", "") if isinstance(board_arr, dict) else ""
    
    # Construct full board string - prefer from row, then from replayer
    board_str = row.get("board") or ""
    if not board_str and board_arr:
        board_str = " ".join(board_arr) if isinstance(board_arr, list) else ""
    
    # Extract stakes from replayer_data or row
    stakes_str = row.get("stakes") or ""
    if not stakes_str:
        sb = replayer.get("sb")
        bb = replayer.get("bb")
        if sb is not None and bb is not None:
            stakes_str = f"${sb}/${bb}"
    
    # Extract action sequence to detect 3bet/4bet pots
    actions = replayer.get("actions", [])
    preflop_raises = 0
    pot_type = "single_raised"
    for action in actions:
        street = action.get("street", "")
        act = action.get("action", "").lower()
        if street == "preflop" and act in ["raises", "raise"]:
            preflop_raises += 1
    if preflop_raises >= 3:
        pot_type = "4bet"
    elif preflop_raises >= 2:
        pot_type = "3bet"
    
    # Build the parsed data object
    inferred_pos = ""
    # Try dynamic inference first (most robust for fixed edge cases)
    try:
        inferred_map = infer_positions_from_text(row.get("raw_text") or "")
        # Look for Hero by name
        hero_name_match = re.search(r"^Dealt\s+to\s+(\S+)", row.get("raw_text") or "", re.MULTILINE)
        if hero_name_match:
            hname = hero_name_match.group(1).strip()
            if hname in inferred_map:
                inferred_pos = inferred_map[hname]
        if not inferred_pos and "Hero" in inferred_map:
            inferred_pos = inferred_map["Hero"]
    except Exception as e:
        logger.warning("Failed to infer position dynamically in extract_parsed_data: %s", e)

    parsed = {
        "position": inferred_pos or row.get("position") or replayer.get("hero_position") or "",
        "cards": row.get("cards") or replayer.get("hero_cards") or "",
        "board": board_str,
        "flop": flop_cards,
        "turn": turn_card,
        "river": river_card,
        "stakes": stakes_str,
        "pot": replayer.get("pot"),
        "pot_type": pot_type,
        "preflop_raises": preflop_raises,
        "hero": replayer.get("hero"),
    }
    
    # Only return if we have at least position or cards
    if parsed["position"] or parsed["cards"]:
        return parsed
    return None

def update_hand_with_coach(
    conn,
    hand_id: Any,
    gto_strategy: Optional[str],
    exploit_deviation: Optional[str],
    learning_tag: Optional[List[str]],
    exploit_signals: Optional[Any] = None,  # NEW: Agent 7 data
    position: Optional[str] = None,
) -> None:
    if gto_strategy is None and exploit_deviation is None and not learning_tag:
        return
    sql = """
        UPDATE public.hands
        SET gto_strategy = %s,
            exploit_deviation = %s,
            learning_tag = %s,
            exploit_signals = %s,
            position = COALESCE(%s, position)
        WHERE id = %s;
    """
    with conn.cursor() as cur:
        # Use Json wrapper for JSONB column
        from psycopg2.extras import Json
        cur.execute(sql, (gto_strategy, exploit_deviation, learning_tag, Json(exploit_signals) if exploit_signals else None, position, hand_id))

def coach_new_hands(conn, batch_size: int) -> int:
    rows = fetch_hands_for_coaching(conn, batch_size)
    if not rows:
        logger.info("No hands needing coaching.")
        return 0
    coached = 0
    for row in rows:
        hand_id = row["id"]
        raw_text = row["raw_text"]
        replayer_data = row.get("replayer_data") or {}
        
        # Annotate raw text with player positions to prevent LLM hallucinations
        annotated_raw_text = annotate_raw_text_with_positions(raw_text, replayer_data)
        
        # Extract pre-parsed data for more accurate coaching
        parsed_data = extract_parsed_data(row)
        if parsed_data:
            logger.debug("Passing parsed data to coach: position=%s, cards=%s, pot_type=%s",
                        parsed_data.get("position"), parsed_data.get("cards"), parsed_data.get("pot_type"))
        
        # Send annotated raw text (with positions) instead of original
        response = call_coach_api(hand_id, annotated_raw_text, parsed_data, replayer_data)
        if response is None:
            continue
        
        gto = response.get('gto_strategy')
        dev = response.get('exploit_deviation')
        lt = response.get('learning_tag')
        exploit_signals = response.get('exploit_signals')  # NEW: Agent 7 data
        hero_pos = response.get('hero_position')
        
        if gto is None and dev is None and not lt:
            continue
        update_hand_with_coach(conn, hand_id, gto, dev, lt, exploit_signals, hero_pos)
        coached += 1
    logger.info("Coached %d hands this run.", coached)
    return coached

# -----------------------------------------------------------------------------
# Regex helpers (stakes, cards/board, site, actions, positions)
# -----------------------------------------------------------------------------
# Stakes
STAKES_STRICT = re.compile(r"-\s*\$?(\d+(?:\.\d+)?)\s*/\s*\$?(\d+(?:\.\d+)?)\s*-")
STAKES_LOOSE  = re.compile(r"\$?\s*(\d+(?:\.\d+)?)\s*/\s*\$?\s*(\d+(?:\.\d+)?)")

# Cards / board (from raw text)
HERO_CARDS = re.compile(r"Dealt to\s+\S+\s*\[([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\]", re.IGNORECASE)
FLOP_RE    = re.compile(r"\*\*\*\s*FLOP\s*\*\*\*\s*\[([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\]", re.IGNORECASE)
TURN_RE    = re.compile(r"\*\*\*\s*TURN\s*\*\*\*.*?\[([2-9TJQKA][cdhs])\]", re.IGNORECASE)
RIVER_RE   = re.compile(r"\*\*\*\s*RIVER\s*\*\*\*.*?\[([2-9TJQKA][cdhs])\]", re.IGNORECASE)

# Site (tolerant)
SITE_RE = re.compile(
    r"(?i)(americas?\s+cardroom|(?:^|[^a-z])acr(?:$|[^a-z])|pokerstars|ggpoker|clubgg|pokerbros)"
)

# Table size
TABLE_MAX_RE   = re.compile(r"(\d+)\s*-\s*max", re.IGNORECASE)
TABLE_PLAYERS  = re.compile(r"\b(\d+)\s*players?\b", re.IGNORECASE)

# Streets
SHOWDOWN_RE = re.compile(r"(?i)\bshow\s*down|showdown\b")
FLOP_TAG    = re.compile(r"(?i)\*\*\*\s*flop\s*\*\*\*")
TURN_TAG    = re.compile(r"(?i)\*\*\*\s*turn\s*\*\*\*")
RIVER_TAG   = re.compile(r"(?i)\*\*\*\s*river\s*\*\*\*")

# Actions
OPEN_RE   = re.compile(r"(?i)\b(hero|you)\s*:\s*(raises|opens)\b")
THREEB_RE = re.compile(r"(?i)\b(3[- ]?bet|re[- ]?raise)\b")
FOURB_RE  = re.compile(r"(?i)\b(4[- ]?bet)\b")
ALLIN_RE  = re.compile(r"(?i)\b(all[- ]?in|shove|jam)\b")
CALL_PREFLOP = re.compile(r"(?is)\*\*\*\s*HOLE CARDS\s*\*\*\*.*?Hero:\s*calls\b")

# Currency / win lines
CURRENCY_RE   = re.compile(r"([$€£])")
HERO_WIN_RE   = re.compile(r"(?i)\b(hero|you).{0,40}\b(collected|wins)\b.*?(?:\$|€|£)?\s*([0-9]+(?:\.[0-9]+)?)")
OTHER_WIN_RE  = re.compile(r"(?i)\b(collected|wins)\b.*?(?:\$|€|£)?\s*([0-9]+(?:\.[0-9]+)?)")

# Bet parsing (hero invested) – simple but effective for ACR-like lines
HERO_INVEST_RE = re.compile(
    r"(?im)^Hero:\s*(?:posts (?:small blind|big blind)\s*(?:\$|€|£)?([0-9]+(?:\.[0-9]+)?)"
    r"|bets\s*(?:\$|€|£)?([0-9]+(?:\.[0-9]+)?)"
    r"|calls\s*(?:\$|€|£)?([0-9]+(?:\.[0-9]+)?)"
    r"|raises to\s*(?:\$|€|£)?([0-9]+(?:\.[0-9]+)?))"
)

# Position inference from button + seats (2–9 players)
SEAT_LINE   = re.compile(r"^Seat\s+(\d+):\s+(.+?)\s+\(", re.IGNORECASE | re.MULTILINE)
BUTTON_LINE = re.compile(r"Seat\s*#\s*(\d+)\s+is\s+the\s+button", re.IGNORECASE)

PREFLOP_ORDER_MAP: Dict[int, List[str]] = {
    2:  ["SB/BTN", "BB"],
    3:  ["BTN", "SB", "BB"],
    4:  ["UTG", "BTN", "SB", "BB"],
    5:  ["UTG", "CO", "BTN", "SB", "BB"],
    6:  ["UTG", "HJ", "CO", "BTN", "SB", "BB"],
    7:  ["UTG", "UTG+1", "HJ", "CO", "BTN", "SB", "BB"],
    8:  ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
    9:  ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
}

def labels_around_button(num_players: int) -> List[str]:
    order = PREFLOP_ORDER_MAP.get(num_players) or PREFLOP_ORDER_MAP[6]
    i_btn = order.index("BTN") if "BTN" in order else 0
    tail = order[i_btn:]   # BTN, SB, BB, ...
    head = order[:i_btn]
    return tail + head     # around the table starting at BTN

def infer_positions_from_text(text: str) -> Dict[str, str]:
    if not text:
        return {}
        
    # CRITICAL: Srip Summary section to avoid duplicate seat matches
    if "*** SUMMARY ***" in text:
        text = text.split("*** SUMMARY ***")[0]
        
    m_btn = BUTTON_LINE.search(text)
    if not m_btn:
        return {}
    try:
        btn_seat = int(m_btn.group(1))
    except:
        return {}

    seats: List[Tuple[int, str]] = []

    # Check for inactive players (sitting out, waits for BB, etc.)
    inactive_players = set()
    inactive_patterns = [
        re.compile(r'(\w+)\s+sits?\s+out', re.IGNORECASE),
        re.compile(r'(\w+)\s+waits\s+for\s+big\s+blind', re.IGNORECASE),
        re.compile(r'(\w+)\s+will\s+be\s+allowed\s+to\s+play', re.IGNORECASE)
    ]
    for pattern in inactive_patterns:
        for m_status in pattern.finditer(text):
            found_name = m_status.group(1).strip()
            # logging.info(f"DEBUG: Found inactive player: {found_name}")
            print(f"DEBUG: Found inactive player: {found_name}")
            inactive_players.add(found_name)

    for m in SEAT_LINE.finditer(text):
        try:
            seat_num = int(m.group(1))
            name = m.group(2).strip()
            
            # Skip if inactive
            if name in inactive_players:
                # logging.info(f"DEBUG: Skipping inactive seat {seat_num}: {name}")
                print(f"DEBUG: Skipping inactive seat {seat_num}: {name}")
                continue

            # Also check the seat line itself for "sitting out"
            line_start = m.start()
            line_end = text.find('\n', line_start)
            if line_end == -1: line_end = len(text)
            seat_line = text[line_start:line_end]
            if 'sitting out' in seat_line.lower():
                print(f"DEBUG: Skipping sitting out line seat {seat_num}: {name}")
                continue

            if name:
                seats.append((seat_num, name))
        except:
            continue
    
    print(f"DEBUG: Final Occupied Seats: {sorted(seats)}")
    if not seats:
        return {}

    occupied = sorted(s for s, _ in seats)
    seat_to_name = {s: n for s, n in seats}
    name_to_seat = {n: s for s, n in seats}

    # Identify Button Seat or Fallback to SB Logic
    actual_btn_seat = None

    if btn_seat in occupied:
        actual_btn_seat = btn_seat
    else:
        # Fallback: Dead Button Scenario
        # Find player who posted SB
        sb_name = None
        # Relaxed regex: handle optional colon AND optional 'the'
        sb_regex = re.compile(r"^(\S+?)(?:\s*:\s*|\s+)posts\s+(?:the\s+)?small\s+blind", re.IGNORECASE | re.MULTILINE)
        m_sb = sb_regex.search(text)
        if m_sb:
            sb_name = m_sb.group(1).strip()
            
        if sb_name and sb_name in name_to_seat:
            sb_seat = name_to_seat[sb_name]
            # Button is the ACTIVE player immediately preceding SB
            try:
                sb_idx = occupied.index(sb_seat)
                btn_idx = (sb_idx - 1) % len(occupied)
                actual_btn_seat = occupied[btn_idx]
            except ValueError:
                pass

    if actual_btn_seat is None:
        # Final fallback: Assume first valid seat is BTN (rare/bad)
        return {}

    start_idx = occupied.index(actual_btn_seat)
    clockwise = occupied[start_idx:] + occupied[:start_idx]  # BTN first
    n = len(clockwise)
    labels = labels_around_button(n)

    name_to_pos: Dict[str, str] = {}
    for seat, label in zip(clockwise, labels[:n]):
        name = seat_to_name.get(seat)
        if name:
            name_to_pos[name] = "BTN" if label == "SB/BTN" else label
    return name_to_pos

# -----------------------------------------------------------------------------
# Field extractors & helpers
# -----------------------------------------------------------------------------
def extract_stakes_from_raw_text(raw_text: Optional[str]) -> Tuple[Optional[str], Optional[Decimal], Optional[Decimal]]:
    if not raw_text:
        return None, None, None
    text = raw_text.strip()
    m = STAKES_STRICT.search(text) or STAKES_LOOSE.search(text)
    if not m:
        return None, None, None
    sb_str, bb_str = m.group(1), m.group(2)
    try:
        sb = Decimal(sb_str); bb = Decimal(bb_str)
    except InvalidOperation:
        return None, None, None
    return f"{sb_str}/{bb_str}", sb, bb

def parse_stakes_from_string(stakes_raw: Optional[str]) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    if not stakes_raw:
        return None, None
    nums = re.findall(r"(\d+(?:\.\d+)?)", stakes_raw.strip())
    if len(nums) < 2:
        return None, None
    try:
        return Decimal(nums[0]), Decimal(nums[1])
    except (InvalidOperation, ValueError):
        return None, None

def normalize_position(pos_raw: Optional[str]) -> Optional[str]:
    if not pos_raw:
        return None
    p = pos_raw.strip().upper().replace(" ", "")
    p = p.replace("DEALER", "BTN").replace("BUTTON", "BTN")
    mapping = {
        "BTN":"BTN","BU":"BTN","SB":"SB","SMALLBLIND":"SB",
        "BB":"BB","BIGBLIND":"BB","CO":"CO","CUTOFF":"CO",
        "HJ":"HJ","HIJACK":"HJ","MP":"MP","UTG":"UTG",
        "UTG+1":"MP","UTG+2":"MP","UTG+3":"MP"
    }
    if p in mapping: return mapping[p]
    for raw_key, norm in mapping.items():
        if raw_key in p: return norm
    return None

def extract_cards_and_board(text: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Return (cards, flop, turn, river) from raw HH."""
    if not text:
        return None, None, None, None
    cards = None
    m = HERO_CARDS.search(text)
    if m:
        c1, c2 = m.group(1).upper(), m.group(2).upper()
        cards = f"{c1} {c2}"

    flop = turn = river = None
    mf = FLOP_RE.search(text)
    if mf:
        flop = " ".join([mf.group(1).upper(), mf.group(2).upper(), mf.group(3).upper()])
    mt = TURN_RE.search(text)
    if mt:
        turn = mt.group(1).upper()
    mr = RIVER_RE.search(text)
    if mr:
        river = mr.group(1).upper()
    return cards, flop, turn, river

def detect_site(text: Optional[str]) -> Optional[str]:
    if not text: return None
    m = SITE_RE.search(text)
    if not m: return None
    val = m.group(1).lower()
    if "acr" in val or "americas" in val:
        return "ACR"
    return val.title()

def detect_game_type(text: Optional[str]) -> str:
    s = (text or "").lower()
    if any(w in s for w in ["tournament","mtt","icm","players left","bubble","payout"]):
        return "tournament"
    return "cash"

def detect_table_size(text: Optional[str]) -> Optional[int]:
    s = text or ""
    m = TABLE_MAX_RE.search(s) or TABLE_PLAYERS.search(s)
    if not m: return None
    try: return int(m.group(1))
    except: return None

def detect_street_reached(text: Optional[str]) -> str:
    s = text or ""
    if RIVER_TAG.search(s) or SHOWDOWN_RE.search(s): return "river"
    if TURN_TAG.search(s): return "turn"
    if FLOP_TAG.search(s): return "flop"
    return "preflop"

def detect_actions(text: Optional[str]) -> Tuple[bool,bool,bool,bool]:
    s = text or ""
    return bool(OPEN_RE.search(s)), bool(THREEB_RE.search(s)), bool(FOURB_RE.search(s)), bool(ALLIN_RE.search(s))

def detect_preflop_call(text: Optional[str]) -> bool:
    return bool(CALL_PREFLOP.search(text or ""))

def detect_currency(text: Optional[str]) -> Optional[str]:
    if not text: return None
    m = CURRENCY_RE.search(text)
    return m.group(1) if m else None

def detect_result(text: Optional[str], bb: Optional[Decimal]) -> Tuple[Optional[str], Optional[Decimal], Optional[Decimal]]:
    """
    Prefer explicit Hero win. If not present but someone else collected, estimate
    Hero's invested amount (posts/bets/calls/raises to) and return negative.
    """
    if not text:
        return None, None, None

    # Hero win sentence
    m_hero = HERO_WIN_RE.search(text)
    if m_hero:
        cur = detect_currency(text)
        try:
            amt = Decimal(m_hero.group(3))
        except:
            return cur, None, None
        return cur, amt, (amt / bb) if (bb and bb > 0) else None

    # Someone else wins -> estimate Hero invested total
    m_other = OTHER_WIN_RE.search(text)
    if m_other:
        cur = detect_currency(text)
        total = Decimal(0)
        for mv in HERO_INVEST_RE.finditer(text):
            for gi in range(1, 5):
                val = mv.group(gi)
                if val:
                    try:
                        total += Decimal(val)
                    except:
                        pass
        if total > 0:
            amt = -total
            return cur, amt, (amt / bb) if (bb and bb > 0) else None

    return None, None, None

# learning_tag normalization for stable leak buckets
_TAG_MAP = {
    "call 3bet too wide": "call_3bet_too_wide",
    "call3bet_too_wide": "call_3bet_too_wide",
    "miss value river": "miss_value_river",
    "miss_value_river": "miss_value_river",
    "check back frequency": "check_back_frequency",
    "trip hands management": "trips_management",
    "trips_management": "trips_management",
}
def normalize_tags(tags: Optional[List[str]]) -> List[str]:
    out = []
    for t in (tags or []):
        raw = t.strip().lower()
        key = re.sub(r"[^a-z0-9_]+", "_", raw).strip("_")
        norm = _TAG_MAP.get(raw, _TAG_MAP.get(key, key))
        if norm:
            out.append(norm)
    # de-dup, preserve order
    seen, uniq = set(), []
    for t in out:
        if t not in seen:
            seen.add(t); uniq.append(t)
    return uniq

# -----------------------------------------------------------------------------
# Silver upsert
# -----------------------------------------------------------------------------
def fetch_unprocessed_hands(conn, limit: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT
            h.id AS hand_id,
            h.user_id AS user_id,
            COALESCE(h.date, h.created_at::date) AS hand_date,
            h.stakes AS stakes_raw,
            h.position AS position_raw,
            h.cards AS cards,
            h.board AS board,
            h.raw_text AS raw_text,
            h.hand_class AS hand_class,
            h.gto_strategy AS gto_strategy,
            h.exploit_deviation AS exploit_deviation,
            h.learning_tag AS learning_tag,
            now() AS parsed_at
        FROM public.hands h
        LEFT JOIN public.hands_silver s
          ON s.hand_id = h.id
        WHERE s.hand_id IS NULL
          AND h.gto_strategy IS NOT NULL
        ORDER BY hand_date NULLS LAST, h.id
        LIMIT %s;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (limit,))
        return cur.fetchall()

def upsert_silver_rows(conn, rows: List[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    insert_sql = """
        INSERT INTO public.hands_silver (
            hand_id,
            user_id,
            hand_date,
            stakes_raw,
            small_blind,
            big_blind,
            position_raw,
            position_norm,
            cards,
            flop_cards,
            turn_card,
            river_card,
            board,
            hand_class,
            gto_strategy,
            exploit_deviation,
            learning_tag,
            hero_position,       -- NEW
            preflop_call,        -- NEW
            site,
            game_type,
            table_size,
            street_reached,
            result_amount,
            result_bb,
            preflop_open,
            preflop_3bet,
            preflop_4bet,
            all_in,
            currency,
            parsed_at
        )
        VALUES (
            %(hand_id)s,
            %(user_id)s,
            %(hand_date)s,
            %(stakes_raw)s,
            %(small_blind)s,
            %(big_blind)s,
            %(position_raw)s,
            %(position_norm)s,
            %(cards)s,
            %(flop_cards)s,
            %(turn_card)s,
            %(river_card)s,
            %(board)s,
            %(hand_class)s,
            %(gto_strategy)s,
            %(exploit_deviation)s,
            %(learning_tag)s,
            %(hero_position)s,
            %(preflop_call)s,
            %(site)s,
            %(game_type)s,
            %(table_size)s,
            %(street_reached)s,
            %(result_amount)s,
            %(result_bb)s,
            %(preflop_open)s,
            %(preflop_3bet)s,
            %(preflop_4bet)s,
            %(all_in)s,
            %(currency)s,
            %(parsed_at)s
        )
        ON CONFLICT (hand_id) DO UPDATE SET
            stakes_raw        = EXCLUDED.stakes_raw,
            small_blind       = EXCLUDED.small_blind,
            big_blind         = EXCLUDED.big_blind,
            position_raw      = EXCLUDED.position_raw,
            position_norm     = EXCLUDED.position_norm,
            cards             = EXCLUDED.cards,
            flop_cards        = EXCLUDED.flop_cards,
            turn_card         = EXCLUDED.turn_card,
            river_card        = EXCLUDED.river_card,
            board             = EXCLUDED.board,
            hand_class        = EXCLUDED.hand_class,
            gto_strategy      = EXCLUDED.gto_strategy,
            exploit_deviation = EXCLUDED.exploit_deviation,
            learning_tag      = EXCLUDED.learning_tag,
            hero_position     = EXCLUDED.hero_position,   -- NEW
            preflop_call      = EXCLUDED.preflop_call,    -- NEW
            site              = EXCLUDED.site,
            game_type         = EXCLUDED.game_type,
            table_size        = EXCLUDED.table_size,
            street_reached    = EXCLUDED.street_reached,
            result_amount     = EXCLUDED.result_amount,
            result_bb         = EXCLUDED.result_bb,
            preflop_open      = EXCLUDED.preflop_open,
            preflop_3bet      = EXCLUDED.preflop_3bet,
            preflop_4bet      = EXCLUDED.preflop_4bet,
            all_in            = EXCLUDED.all_in,
            currency          = EXCLUDED.currency,
            parsed_at         = EXCLUDED.parsed_at;
    """
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(insert_sql, row)
    return len(rows)

def build_silver_payload(raw_row: Dict[str, Any]) -> Dict[str, Any]:
    stakes_raw = raw_row.get("stakes_raw")
    position_raw = raw_row.get("position_raw")
    board_raw = raw_row.get("board")
    raw_text = raw_row.get("raw_text")

    # Stakes
    if not stakes_raw:
        stakes_raw, sb_dec, bb_dec = extract_stakes_from_raw_text(raw_text)
    else:
        sb_dec, bb_dec = parse_stakes_from_string(stakes_raw)
        if (sb_dec is None or bb_dec is None) and stakes_raw:
            sb_dec, bb_dec = parse_stakes_from_string(stakes_raw)

    # Cards/board from raw text if missing
    cards = raw_row.get("cards")
    flop_cards = turn_card = river_card = None
    if not cards or not board_raw:
        ecards, eflop, eturn, eriver = extract_cards_and_board(raw_text)
        if not cards and ecards: cards = ecards
        if not board_raw:
            flop_cards = eflop
            turn_card = eturn
            river_card = eriver

    # Position normalization from DB
    position_norm = normalize_position(position_raw)

    # Position inference from seats + button (set hero_position & also as position_norm fallback)
    # Position inference from seats + button (set hero_position & also as position_norm fallback)
    inferred = infer_positions_from_text(raw_text or "")
    
    # Extract Hero Name to lookup in inferred dict
    hero_name = None
    m_hero = re.search(r"^Dealt\s+to\s+(\S+)", raw_text or "", re.MULTILINE)
    if m_hero:
        hero_name = m_hero.group(1).strip()
        
    hero_pos = None
    if hero_name and hero_name in inferred:
        hero_pos = inferred[hero_name]
    elif "Hero" in inferred:
        hero_pos = inferred["Hero"]

    if hero_pos:
        position_raw = hero_pos
        position_norm = hero_pos

    # Site / type / size / street
    site = detect_site(raw_text)
    game_type = detect_game_type(raw_text)
    table_size = detect_table_size(raw_text)
    street_reached = detect_street_reached(raw_text)

    # Actions (and preflop_call for VPIP)
    pre_open, pre_3b, pre_4b, all_in = detect_actions(raw_text)
    pre_call = detect_preflop_call(raw_text)

    # Result (currency, amount cash, amount in BB)
    currency, result_cash, result_bb = detect_result(raw_text, bb_dec)

    # If Bronze filled "board" only as a single string, split it
    if board_raw and (flop_cards is None and turn_card is None and river_card is None):
        tokens = board_raw.split()
        if len(tokens) >= 3:
            flop_cards = " ".join(tokens[:3])
        if len(tokens) >= 4:
            turn_card = tokens[3]
        if len(tokens) >= 5:
            river_card = tokens[4]

    # Normalize learning tags to stable keys
    learning_tag_norm = normalize_tags(raw_row.get("learning_tag"))

    payload = {
        "hand_id": raw_row.get("hand_id"),
        "user_id": raw_row.get("user_id"),
        "hand_date": raw_row.get("hand_date"),
        "stakes_raw": stakes_raw,
        "small_blind": sb_dec,
        "big_blind": bb_dec,
        "position_raw": position_raw,
        "position_norm": position_norm,
        "cards": cards,
        "flop_cards": flop_cards,
        "turn_card": turn_card,
        "river_card": river_card,
        "board": raw_row.get("board"),
        "hand_class": raw_row.get("hand_class"),
        "gto_strategy": raw_row.get("gto_strategy"),
        "exploit_deviation": raw_row.get("exploit_deviation"),
        "learning_tag": learning_tag_norm,
        "hero_position": hero_pos or position_norm,  # NEW
        "preflop_call": pre_call,                    # NEW
        "site": site,
        "game_type": game_type,
        "table_size": table_size,
        "street_reached": street_reached,
        "result_amount": result_cash,
        "result_bb": result_bb,
        "preflop_open": pre_open,
        "preflop_3bet": pre_3b,
        "preflop_4bet": pre_4b,
        "all_in": all_in,
        "currency": currency,
        "parsed_at": raw_row.get("parsed_at"),
    }
    return payload

# -----------------------------------------------------------------------------
# Main runner
# -----------------------------------------------------------------------------
def run_once(batch_size: int = 5) -> None:
    logger.info("Starting coach_worker run_once with batch_size=%d", batch_size)
    load_env_file()
    conn = get_pg_conn()
    try:
        coach_new_hands(conn, batch_size)
        raw_rows = fetch_unprocessed_hands(conn, batch_size)
        if not raw_rows:
            logger.info("No new coached hands to move into silver.")
            return
        payload_rows = [build_silver_payload(r) for r in raw_rows]
        inserted_count = upsert_silver_rows(conn, payload_rows)
        logger.info("Upserted %d rows into hands_silver.", inserted_count)
    finally:
        conn.close()
        logger.info("Closed Postgres connection.")

# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    try:
        batch_size = int(os.getenv("COACH_BATCH_SIZE", "30"))
    except ValueError:
        batch_size = 5
    run_once(batch_size=batch_size)
