#!/usr/bin/env python3
"""
replayer_parser.py  —  Hand Replayer Data Extractor

Parses raw poker hand history text into the JSON format required by
the HandReplayer React component.

Output format matches the TypeScript interface:
{
    "players": [
        { "name": str, "seatIndex": int, "isHero": bool, 
          "cards": [str, str] | null, "isActive": bool, "stack": float }
    ],
    "board": [str],  # e.g. ["T♠", "9♥", "8♦", "2♣", "5♠"]
    "pot": float,
    "street": "preflop" | "flop" | "turn" | "river" | "showdown",
    "sb": float,
    "bb": float,
    "dealerSeat": int,
    "actions": [
        { "player": str, "action": str, "amount": float | null, "street": str }
    ]
}
"""

import os
import re
import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Optional, List, Dict, Any, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor, register_uuid, Json

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
# Regex Patterns
# -----------------------------------------------------------------------------

# Seat line with initial stack
# Matches: "Seat 1: PlayerName ($50.00) " or "Seat 3: Hero (1500 in chips)"
SEAT_STACK_RE = re.compile(
    r"Seat\s+(\d+):\s+(.+?)\s+\(\s*\$?([0-9,]+(?:\.[0-9]+)?)\s*(?:in\s+chips)?\s*\)",
    re.IGNORECASE | re.MULTILINE
)

# Button/Dealer position
BUTTON_RE = re.compile(
    r"Seat\s*#?\s*(\d+)\s+is\s+the\s+button",
    re.IGNORECASE
)

# Stakes from header line
STAKES_RE = re.compile(
    r"\$?([0-9]+(?:\.[0-9]+)?)\s*/\s*\$?([0-9]+(?:\.[0-9]+)?)"
)

# Hero's hole cards - captures player name and both cards
# Matches: "Dealt to KannyThOP [7c Ks]" or "Dealt to Hero [Ah Kh]"
HERO_CARDS_RE = re.compile(
    r"Dealt\s+to\s+(\S+)\s*\[\s*([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s*\]",
    re.IGNORECASE
)

# Showdown - revealed cards for any player
SHOWDOWN_CARDS_RE = re.compile(
    r"(\S+):\s*shows\s*\[\s*([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s*\]",
    re.IGNORECASE
)

# Community cards by street
FLOP_RE = re.compile(
    r"\*\*\*\s*FLOP\s*\*\*\*\s*\[\s*([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s*\]",
    re.IGNORECASE
)
TURN_RE = re.compile(
    r"\*\*\*\s*TURN\s*\*\*\*.*?\[\s*([2-9TJQKA][cdhs])\s*\]",
    re.IGNORECASE
)
RIVER_RE = re.compile(
    r"\*\*\*\s*RIVER\s*\*\*\*.*?\[\s*([2-9TJQKA][cdhs])\s*\]",
    re.IGNORECASE
)

# Street markers
STREET_MARKERS = {
    "preflop": re.compile(r"\*\*\*\s*HOLE\s+CARDS\s*\*\*\*", re.IGNORECASE),
    "flop": re.compile(r"\*\*\*\s*FLOP\s*\*\*\*", re.IGNORECASE),
    "turn": re.compile(r"\*\*\*\s*TURN\s*\*\*\*", re.IGNORECASE),
    "river": re.compile(r"\*\*\*\s*RIVER\s*\*\*\*", re.IGNORECASE),
    "showdown": re.compile(r"\*\*\*\s*SHOW\s*DOWN\s*\*\*\*", re.IGNORECASE),
}

# Action patterns
# Matches: "PlayerName: folds", "Hero: raises $10 to $15", "Villain: calls $5"
# NOTE: "raises to" must come BEFORE "raises" in alternation to match correctly
ACTION_RE = re.compile(
    r"^([^\s:]+)(?::)?\s*(folds|checks|calls|bets|raises\s+to|raises|all-in|posts\s+small\s+blind|posts\s+big\s+blind)\s*\$?([0-9,]+(?:\.[0-9]+)?)?(?:\s+to\s+\$?([0-9,]+(?:\.[0-9]+)?))?",
    re.IGNORECASE | re.MULTILINE
)

# Pot total
POT_RE = re.compile(
    r"Total\s+pot\s+\$?([0-9,]+(?:\.[0-9]+)?)",
    re.IGNORECASE
)

# Winner line
WINNER_RE = re.compile(
    r"(\S+)\s+(?:collected|wins)\s+\$?([0-9,]+(?:\.[0-9]+)?)",
    re.IGNORECASE
)

# Date extraction
# Matches: "2023/10/25 12:00:00" or "2023-10-25"
DATE_RE = re.compile(
    r"(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})",
    re.IGNORECASE
)

# -----------------------------------------------------------------------------
# Card Format Conversion
# -----------------------------------------------------------------------------

SUIT_MAP = {
    'c': '♣', 'C': '♣',
    'd': '♦', 'D': '♦', 
    'h': '♥', 'H': '♥',
    's': '♠', 'S': '♠',
}

def convert_card(card: str) -> str:
    """
    Convert poker card notation to display format.
    "Ah" -> "A♥", "Ts" -> "T♠"
    """
    if not card or len(card) < 2:
        return card
    rank = card[:-1].upper()
    suit_char = card[-1]
    suit = SUIT_MAP.get(suit_char, suit_char)
    return f"{rank}{suit}"


def parse_amount(amount_str: Optional[str]) -> Optional[float]:
    """Parse amount string to float, handling commas."""
    if not amount_str:
        return None
    try:
        return float(amount_str.replace(",", ""))
    except (ValueError, TypeError):
        return None


# -----------------------------------------------------------------------------
# Extraction Functions
# -----------------------------------------------------------------------------

def extract_players_with_stacks(text: str) -> List[Dict[str, Any]]:
    """
    Extract all players from seat lines with their initial stacks.
    Excludes players marked as "sitting out" or who "sits out".
    Returns list of { name, seatIndex, stack, isHero, isActive, cards }
    """
    # First, find all players who are sitting out or waiting
    # Pattern 1: "Seat X: PlayerName ($Y) is sitting out"
    # Pattern 2: "PlayerName sits out" on separate line
    # Pattern 3: "PlayerName waits for big blind"
    # Pattern 4: "PlayerName will be allowed to play after the button"
    sitting_out_players = set()
    
    # Check for "sits out", "sitting out", "waits for", "allowed to play" patterns
    inactive_patterns = [
        re.compile(r'(\w+)\s+sits?\s+out', re.IGNORECASE),
        re.compile(r'(\w+)\s+waits\s+for\s+big\s+blind', re.IGNORECASE),
        re.compile(r'(\w+)\s+will\s+be\s+allowed\s+to\s+play', re.IGNORECASE)
    ]

    for pattern in inactive_patterns:
        for match in pattern.finditer(text):
            player_name = match.group(1).strip()
            sitting_out_players.add(player_name)
    
    players = []
    for match in SEAT_STACK_RE.finditer(text):
        seat_num = int(match.group(1))
        name = match.group(2).strip()
        
        # Skip players who are sitting out (either pattern)
        if name in sitting_out_players:
            continue
        
        # Also check the seat line itself for "sitting out"
        line_start = match.start()
        line_end = text.find('\n', line_start)
        if line_end == -1:
            line_end = len(text)
        seat_line = text[line_start:line_end]
        
        if 'sitting out' in seat_line.lower():
            continue
        
        stack_str = match.group(3).replace(",", "")
        try:
            stack = float(stack_str)
        except ValueError:
            stack = 0.0
        
        players.append({
            "name": name,
            "seatIndex": seat_num,
            "isHero": name.lower() == "hero",
            "cards": None,  # Will be filled later
            "isActive": True,  # Will be updated based on fold actions
            "stack": stack,
        })
    
    return players


def extract_dealer_seat(text: str) -> Optional[int]:
    """Extract the button/dealer seat number."""
    match = BUTTON_RE.search(text)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            pass
    return None


def extract_stakes(text: str) -> Tuple[Optional[float], Optional[float]]:
    """Extract small blind and big blind from stakes line."""
    match = STAKES_RE.search(text)
    if match:
        try:
            sb = float(match.group(1))
            bb = float(match.group(2))
            return sb, bb
        except ValueError:
            pass
    return None, None


def extract_hero_cards(text: str) -> Tuple[Optional[str], Optional[List[str]]]:
    """
    Extract hero's name and hole cards from 'Dealt to' line.
    Returns: (hero_name, [card1, card2]) or (None, None) if not found.
    """
    match = HERO_CARDS_RE.search(text)
    if match:
        hero_name = match.group(1).strip()
        card1 = convert_card(match.group(2))
        card2 = convert_card(match.group(3))
        return hero_name, [card1, card2]
    return None, None


def extract_date(text: str) -> Optional[str]:
    """Extract and validate date from hand history."""
    from datetime import datetime
    match = DATE_RE.search(text)
    if match:
        dstr = match.group(1)
        # Try common formats
        for fmt in ("%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(dstr.replace("-", "/"), fmt.replace("-", "/"))
                # Return standard ISO format for DB
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        
        # If we can't parse it but it matched regex, it might be weird.
        # Let's try to just return it if it looks plausible, or None if it failed standard parse
        # But Postgres is strict. If python can't parse it, Postgres probably can't either (or it's invalid like 32:00:00).
        return None
    return None


def extract_shown_cards(text: str) -> Dict[str, List[str]]:
    """
    Extract cards shown at showdown.
    Returns: { "PlayerName": ["A♠", "K♥"], ... }
    """
    shown = {}
    for match in SHOWDOWN_CARDS_RE.finditer(text):
        name = match.group(1).strip()
        card1 = convert_card(match.group(2))
        card2 = convert_card(match.group(3))
        shown[name] = [card1, card2]
    return shown


def extract_board(text: str) -> List[str]:
    """Extract community cards from flop, turn, river."""
    board = []
    
    # Flop
    flop_match = FLOP_RE.search(text)
    if flop_match:
        board.extend([
            convert_card(flop_match.group(1)),
            convert_card(flop_match.group(2)),
            convert_card(flop_match.group(3)),
        ])
    
    # Turn
    turn_match = TURN_RE.search(text)
    if turn_match:
        board.append(convert_card(turn_match.group(1)))
    
    # River
    river_match = RIVER_RE.search(text)
    if river_match:
        board.append(convert_card(river_match.group(1)))
    
    return board


def detect_street_reached(text: str) -> str:
    """Determine the final street reached in the hand."""
    if STREET_MARKERS["showdown"].search(text):
        return "showdown"
    if STREET_MARKERS["river"].search(text):
        return "river"
    if STREET_MARKERS["turn"].search(text):
        return "turn"
    if STREET_MARKERS["flop"].search(text):
        return "flop"
    return "preflop"


def extract_actions(text: str) -> List[Dict[str, Any]]:
    """
    Extract all actions chronologically with street context.
    Returns: [{ player, action, amount, street }, ...]
    """
    actions = []
    current_street = "preflop"
    
    lines = text.split("\n")
    for line in lines:
        line = line.strip()
        
        # Check for street changes
        for street_name, pattern in STREET_MARKERS.items():
            if pattern.search(line):
                current_street = street_name
                break
        
        # Check for actions
        action_match = ACTION_RE.match(line)
        if action_match:
            player = action_match.group(1).strip()
            action_type = action_match.group(2).strip().lower()
            amount = parse_amount(action_match.group(3))
            to_amount = parse_amount(action_match.group(4))
            
            # Normalize action types
            if "posts small blind" in action_type:
                action_type = "posts_sb"
            elif "posts big blind" in action_type:
                action_type = "posts_bb"
            elif "raises to" in action_type or to_amount:
                action_type = "raiseTo"
                amount = to_amount or amount
            elif "raises" in action_type:
                action_type = "raise"  # Additive raise? verify usage
            elif "all-in" in action_type:
                action_type = "all-in"
            
            actions.append({
                "player": player,
                "action": action_type,
                "amount": amount,
                "street": current_street,
            })
    
    return actions


def extract_pot(text: str) -> Optional[float]:
    """Extract total pot amount."""
    match = POT_RE.search(text)
    if match:
        return parse_amount(match.group(1))
    return None


def identify_folded_players(actions: List[Dict[str, Any]], shown_cards: Dict[str, List[str]] = None) -> set:
    """
    Get set of player names who folded.
    Includes both explicit folds AND inferred folds (players who had action but aren't at showdown).
    """
    # Explicit folds
    folded = {a["player"] for a in actions if a["action"] == "folds"}
    
    # If we have showdown data, infer folds for players who called/bet but aren't at showdown
    if shown_cards is not None:
        # Get all players who put money in (calls, bets, raises)
        players_with_action = set()
        for a in actions:
            if a["action"] in ("calls", "call", "bet", "bets", "raise", "all-in"):
                players_with_action.add(a["player"])
        
        # Players who had action but aren't at showdown must have folded
        for player in players_with_action:
            if player not in shown_cards and player not in folded:
                folded.add(player)
    
    return folded


# -----------------------------------------------------------------------------
# Main Parser Function
# -----------------------------------------------------------------------------

def calculate_poker_positions(
    players: List[Dict[str, Any]], 
    dealer_seat: Optional[int],
    actions: List[Dict[str, Any]]
) -> Dict[str, str]:
    """
    Calculate poker position names (BTN, SB, BB, CO, HJ, UTG, etc.) for each player.
    
    Args:
        players: List of player dicts with seatIndex
        dealer_seat: Button seat number
        actions: List of actions to find SB/BB posts
        
    Returns:
        Dict mapping player name -> position name (e.g. "CO", "BTN")
    """
    if not players:
        return {}
    
    positions = {}
    num_players = len(players)
    
    # Find who posted SB and BB from actions
    sb_player = None
    bb_player = None
    for action in actions:
        if action.get("action") in ("posts_sb", "posts_small_blind"):
            sb_player = action.get("player")
        elif action.get("action") in ("posts_bb", "posts_big_blind"):
            bb_player = action.get("player")
    
    # Sort players by seat index
    sorted_players = sorted(players, key=lambda p: p["seatIndex"])
    seat_to_name = {p["seatIndex"]: p["name"] for p in sorted_players}
    name_to_seat = {p["name"]: p["seatIndex"] for p in sorted_players}
    
    # Find button player
    btn_player = None
    if dealer_seat is not None and dealer_seat in seat_to_name:
        btn_player = seat_to_name[dealer_seat]
    
    # Create ordered list of players starting from button
    # If we can't find button, use SB/BB to infer it
    if not btn_player and sb_player:
        # Button is before SB in ring order
        sb_seat = name_to_seat[sb_player]
        sb_idx = next(i for i, p in enumerate(sorted_players) if p["seatIndex"] == sb_seat)
        # Button is previous player in ring (wrapping)
        btn_idx = (sb_idx - 1) % num_players
        btn_player = sorted_players[btn_idx]["name"]
    
    if not btn_player:
        # Last resort: first player in sorted order is button
        btn_player = sorted_players[0]["name"]
    
    # Build ring order starting from button
    btn_seat = name_to_seat[btn_player]
    btn_idx = next(i for i, p in enumerate(sorted_players) if p["seatIndex"] == btn_seat)
    
    ring_order = []
    for i in range(num_players):
        idx = (btn_idx + i) % num_players
        ring_order.append(sorted_players[idx]["name"])
    
    # Assign position names based on ring order and player count
    # ring_order[0] is always button
    # ring_order[1] is SB (or BB in heads-up)
    # ring_order[2] is BB (if not heads-up)
    # Rest are positional from right to left of button
    
    if num_players == 2:
        # Heads-up: BTN is also SB, other player is BB
        positions[ring_order[0]] = "BTN/SB"
        positions[ring_order[1]] = "BB"
    elif num_players == 3:
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
    elif num_players == 4:
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
        positions[ring_order[3]] = "CO"
    elif num_players == 5:
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
        positions[ring_order[3]] = "UTG"
        positions[ring_order[4]] = "CO"
    elif num_players == 6:
        # 6-max
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
        positions[ring_order[3]] = "UTG"
        positions[ring_order[4]] = "HJ"
        positions[ring_order[5]] = "CO"
    elif num_players == 7:
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
        positions[ring_order[3]] = "UTG"
        positions[ring_order[4]] = "UTG+1"
        positions[ring_order[5]] = "HJ"
        positions[ring_order[6]] = "CO"
    elif num_players == 8:
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
        positions[ring_order[3]] = "UTG"
        positions[ring_order[4]] = "UTG+1"
        positions[ring_order[5]] = "LJ"
        positions[ring_order[6]] = "HJ"
        positions[ring_order[7]] = "CO"
    elif num_players >= 9:
        # 9-max or more
        positions[ring_order[0]] = "BTN"
        positions[ring_order[1]] = "SB"
        positions[ring_order[2]] = "BB"
        positions[ring_order[3]] = "UTG"
        positions[ring_order[4]] = "UTG+1"
        positions[ring_order[5]] = "UTG+2"
        positions[ring_order[6]] = "LJ"
        positions[ring_order[7]] = "HJ"
        positions[ring_order[8]] = "CO"
        # Any extra players get UTG+3, UTG+4, etc.
        for i in range(9, num_players):
            positions[ring_order[i]] = f"UTG+{i-2}"
    
    return positions


def infer_implicit_folds(
    actions: List[Dict[str, Any]], 
    players: List[Dict[str, Any]], 
    dealer_seat: int, 
    sb_amount: float,
    bb_amount: float
) -> List[Dict[str, Any]]:
    """
    Scans the actions and inserts explicit "folds" for players who were skipped 
    (implicit folds), based on standard poker turn order.
    """
    if not actions or not players:
        return actions

    # Map name -> seat and seat -> player struct
    name_to_seat = {p["name"]: p["seatIndex"] for p in players}
    seat_to_player = {p["seatIndex"]: p for p in players}
    
    # Sort seats to establish ring order
    sorted_seats = sorted([p["seatIndex"] for p in players])
    
    # Track player state
    # We need to know if a player is already folded or all-in to skip them correctly
    status = {p["name"]: "active" for p in players} # active, folded, all-in
    
    # Helper to get next active player seat
    def get_next_seat(current_seat_idx):
        idx = sorted_seats.index(current_seat_idx)
        for _ in range(len(sorted_seats)):
            idx = (idx + 1) % len(sorted_seats)
            s_idx = sorted_seats[idx]
            p_name = seat_to_player[s_idx]["name"]
            if status[p_name] == "active":
                return s_idx
        return None

    # Determine First Actor logic is complex (depends on Preflop vs Postflop)
    # But usually: 
    # Preflop: Action starts after BB.
    # Postflop: Action starts after Button.
    
    # For simplicity, we process street by street
    
    # Group actions by street
    measure_streets = []
    current_chunk = []
    current_street = "preflop"
    
    for action in actions:
        if action["street"] != current_street:
            measure_streets.append((current_street, current_chunk))
            current_chunk = []
            current_street = action["street"]
        current_chunk.append(action)
    measure_streets.append((current_street, current_chunk))
    
    final_actions = []
    
    # Identify positions for Preflop
    # We need to identify who is BB to start Next To Act relative to them.
    # Dealer is explicitly given.
    # Small Blind is usually Dealer + 1. Big Blind is Dealer + 2.
    
    # Let's find index of dealer in sorted seats
    if dealer_seat not in sorted_seats:
        # Fallback: if dealer seat invalid, assume max seat or something?
        # Or try to infer from 'posts small blind' actions?
        # Let's map dealer_seat to nearest previous occupied seat or just 0
        dealer_seat = sorted_seats[0] # Fallback
        
        # Try finding button from raw data? 
        # Actually it's passed in.
        
    dealer_idx_in_sorted = -1
    # Find dealer in sorted_seats (or closest previous if dealer seat is empty)
    # Logic: if dealer_seat=5 but only seats 4 and 6 exist, who is button? 
    # Usually button is assigned to specific player.
    # Let's assume dealer_seat corresponds to an occupied seat if possible.
    if dealer_seat in sorted_seats:
        dealer_idx_in_sorted = sorted_seats.index(dealer_seat)
    else:
        # If dealer seat empty, finding button is tricky without more info.
        # Let's look for "posts small blind" action which is usually 1st action?
        # Actually, in replayer_parser actions list, posts_sb is there.
        pass

    # Better approach for Turn Order:
    # Just follow the actions. If we see a gap in seats, fill it.
    
    # Let's just iterate through the chunks
    for street, chunk in measure_streets:
        # Determine who should act first this street
        expected_seat = None
        
        if street == "preflop":
            # Start *after* BB.
            # Find BB player.
            bb_player = None
            for act in chunk:
                if act["action"] == "posts_bb":
                    bb_player = act["player"]
                    break
            
            if bb_player and bb_player in name_to_seat:
                bb_seat = name_to_seat[bb_player]
                expected_seat = get_next_seat(bb_seat)
            else:
                # If no BB post found (rare), maybe start after Dealer+2
                 if dealer_idx_in_sorted != -1:
                    sb_idx = (dealer_idx_in_sorted + 1) % len(sorted_seats)
                    bb_idx = (dealer_idx_in_sorted + 2) % len(sorted_seats)
                    expected_seat = get_next_seat(sorted_seats[bb_idx])

        else:
            # Postflop: Start after Dealer
            if dealer_idx_in_sorted != -1:
                expected_seat = get_next_seat(sorted_seats[dealer_idx_in_sorted])
        
        # Now iterate through actions in this chunk
        for action in chunk:
            actor = action["player"]
            act_type = action["action"]
            
            # Skip non-gameplay actions if any (like "show cards" although those are usually end)
            if act_type in ("posts_sb", "posts_bb"):
                # These happen at start of preflop, we validly consume them.
                # But "action order" usually starts AFTER BB. 
                # Blind posts are special. Let's just pass them through and NOT enforce order on them.
                final_actions.append(action)
                
                # Update status if all-in
                if action.get("amount") and action.get("player") in seat_to_player:
                    # Check stack remainder? Complex.
                    # Simplified: only "all-in" action sets status=all-in
                    pass 
                
                continue
            
            # For normal actions (bet, check, call, raise, fold)
            if actor not in name_to_seat or expected_seat is None:
                final_actions.append(action)
                if act_type == "folds":
                    status[actor] = "folded"
                elif act_type == "all-in":
                    status[actor] = "all-in"
                
                # Update expected_seat to next guy
                if actor in name_to_seat:
                     expected_seat = get_next_seat(name_to_seat[actor])
                continue
            
            actual_seat = name_to_seat[actor]
            
            # If the actor is NOT the expected seat, we have skipped players!
            # Loop from expected_seat until we hit actual_seat
            # Insert folds for everyone in between
            
            # Safety break to prevent infinite loops if logic is wrong
            loop_count = 0
            while expected_seat != actual_seat and expected_seat is not None and loop_count < len(sorted_seats):
                skipped_player_name = seat_to_player[expected_seat]["name"]
                
                # CRITICAL: Check if this skipped player acts LATER in this chunk?
                # If they act later, DO NOT fold them (maybe our turn order assumption is wrong, or out-of-turn play)
                acts_later = False
                cur_idx = chunk.index(action)
                for future_action in chunk[cur_idx:]:
                    if future_action["player"] == skipped_player_name:
                        acts_later = True
                        break
                
                if not acts_later:
                    # Insert FOLD for this skipped player
                    final_actions.append({
                        "player": skipped_player_name,
                        "action": "folds",
                        "amount": None,
                        "street": street
                    })
                    status[skipped_player_name] = "folded"
                
                # Move to next
                expected_seat = get_next_seat(expected_seat)
                loop_count += 1
            
            # Now append the actual action
            final_actions.append(action)
            
            if act_type == "folds":
                status[actor] = "folded"
            elif act_type == "all-in":
                status[actor] = "all-in"
                
            # Next expected is next guy
            expected_seat = get_next_seat(actual_seat)
            
        # End of street
        # Note: We don't infer folds at end of street automatically (players checks behind etc)
        # implicitly, if street changes, players who didn't act usually checked? 
        # But if they had to call and didn't, they folded? 
        # This is getting safer to just handle "skipped" turns.

    return final_actions


def parse_for_replayer(raw_text: str) -> Dict[str, Any]:
    """
    Main entry point: parse raw hand history text into HandReplayer format.
    
    Returns dict matching the HandHistory TypeScript interface.
    """
    if not raw_text:
        return {}
    
    # Extract all components
    # Pre-process raw_text to remove Summary section if present
    # This prevents Summary lines (like "Seat 3: Hero collected...") from being parsed as players/actions
    if "*** SUMMARY ***" in raw_text:
        raw_text = raw_text.split("*** SUMMARY ***")[0]

    players = extract_players_with_stacks(raw_text)
    dealer_seat = extract_dealer_seat(raw_text)
    sb, bb = extract_stakes(raw_text)
    hero_name, hero_cards = extract_hero_cards(raw_text)  # Now returns (name, cards)
    shown_cards = extract_shown_cards(raw_text)
    board = extract_board(raw_text)
    street = detect_street_reached(raw_text)
    actions = extract_actions(raw_text)
    
    # Infer implicit folds (sequential)
    # This inserts "folds" actions for players skipped in the turn order
    if actions and players:
        actions = infer_implicit_folds(actions, players, dealer_seat, sb, bb)
    
    # Calculate poker positions (BTN, SB, BB, CO, HJ, UTG, etc.)
    # CRITICAL: This must happen BEFORE smart seating logic which reassigns seat indices
    position_map = calculate_poker_positions(players, dealer_seat, actions)
    for player in players:
        player["position"] = position_map.get(player["name"], "UNKNOWN")
    
    # Infer missing players AND re-assign seats based on roles (Smart Seating)
    # This fixes issues where arbitrary seat assignment breaks position labels (e.g. Hero BB labeled as HJ)
    
    # 1. Identify all unique player names from players list + actions
    all_player_names = {p["name"] for p in players}
    for action in actions:
        all_player_names.add(action["player"])
    
    # 2. Determine Roles
    roles = {} # name -> role (BB, SB, BTN, CO, HJ, UTG, UTG+1)
    
    # Check actions for blinds
    for action in actions:
        p = action["player"]
        if action["action"] == "posts_big_blind" or action["action"] == "posts_bb":
            roles[p] = "BB"
        elif action["action"] == "posts_small_blind" or action["action"] == "posts_sb":
            roles[p] = "SB"
            
    # Check names for hints if role not found
    for name in all_player_names:
        if name not in roles:
            if "_BTN" in name or "Button" in name:
                roles[name] = "BTN"
            elif "_CO" in name:
                roles[name] = "CO"
            elif "_HJ" in name or "_MP" in name:
                roles[name] = "HJ"
            elif "_UTG" in name:
                 roles[name] = "UTG"
            elif "_SB" in name:
                 roles[name] = "SB"
            elif "_BB" in name:
                 roles[name] = "BB"
    
    # 3. Assign Standard 6-Max / 9-Max Seats (Relative to BTN=0)
    # This aligns the players in a ring starting from BTN.
    # We map roles to ideal relative indices.
    role_to_ideal_seat = {
        "BTN": 0, 
        "SB": 1, 
        "BB": 2, 
        "UTG": 3, 
        "UTG+1": 4, "UTG1": 4,
        "UTG+2": 5, "UTG2": 5,
        "MP": 5, "MP1": 6, 
        "LJ": 6, "HJ": 7, "CO": 8
    }
    # Note: These values are just initial seeds. We will compact them later if needed?
    # Actually, we just need UNIQUE sorted order. 0..8 space is fine.
    
    # Identify occupied logical seats
    assigned_seats = {} # name -> seat
    used_seats = set()
    
    # Assign known roles first
    # Sort roles by ideal seat to prioritize standard ring
    sorted_roles = sorted([(name, role) for name, role in roles.items()], key=lambda x: role_to_ideal_seat.get(x[1], 100))
    
    for name, role in sorted_roles:
        if role in role_to_ideal_seat:
            s_idx = role_to_ideal_seat[role]
            # Collision handling: Find next free seat
            original_idx = s_idx
            while s_idx in used_seats:
                s_idx += 1
                # If we go too far, wrap? Or just keep going up. 
                # Frontend sorts them, so value magnitude doesn't matter much, just order.
            
            assigned_seats[name] = s_idx
            used_seats.add(s_idx)
            
    # Assign unknown roles to empty seats (First Fit) within range 0-8 if possible
    def get_free_seat():
        for i in range(9): # Check 0..8
            if i not in used_seats:
                return i
        # If all 0..8 taken, just find next integer
        i = 9
        while i in used_seats:
             i += 1
        return i
        
    final_players = []
    
    for name in all_player_names:
        # Check if we have existing data for this player
        existing = next((p for p in players if p["name"] == name), None)
        
        seat = assigned_seats.get(name)
        if seat is None:
            # If explicit seat from header exists? unique?
            # We treat header seats as hints but if they collide with our logical assignments, we move them.
            # Actually, for this "Smart Seating" path, we are mostly inferring.
            # Just use free seat.
            seat = get_free_seat()
            used_seats.add(seat)
            assigned_seats[name] = seat
            
        # isHero check: match by hero_name from 'Dealt to' line, or fallback to name patterns
        is_hero = (
            (hero_name and name == hero_name) or
            (existing["isHero"] if existing else False) or
            (name == "Hero" or "_Hero" in name)
        )
        # Stack is None if unknown (will be handled as Infinity/??? in frontend)
        stack = existing["stack"] if existing else None
        cards = existing["cards"] if existing else None
        # Preserve position from initial calculation (before smart seating)
        position = existing.get("position") if existing else "UNKNOWN"
        
        final_players.append({
            "name": name,
            "seatIndex": seat,
            "isHero": is_hero,
            "cards": cards,
            "isActive": True, # Will be updated later
            "stack": stack,
            "position": position  # Preserve from initial calculation
        })
        
    players = final_players
    
    # Force Dealer Seat to 0 (BTN position in our logical map)
    # If we found a BTN player, his seat is 0.
    dealer_seat = 0 if any(r == "BTN" for r in roles.values()) else None


    pot = extract_pot(raw_text)
    folded = identify_folded_players(actions, shown_cards)  # Pass showdown data to infer folds
    
    # Assign cards to players
    for player in players:
        name = player["name"]
        if player["isHero"] and hero_cards:
            player["cards"] = hero_cards
        elif name in shown_cards:
            player["cards"] = shown_cards[name]
        
        # Mark folded players as inactive
        if name in folded:
            player["isActive"] = False
        # Also mark players without cards as inactive (except Hero who always has cards)
        elif player["cards"] is None and not player["isHero"]:
            player["isActive"] = False
    
    # Normalize seat indices to 0-based if needed
    # (Many HH formats use 1-9, frontend expects 0-8 for display calculations)
    min_seat = min((p["seatIndex"] for p in players), default=0)
    if min_seat > 0:
        for player in players:
            player["seatIndex"] = player["seatIndex"] - min_seat
        if dealer_seat is not None:
            dealer_seat = dealer_seat - min_seat
    
    # Convert stacks to BB if we have the big blind
    if bb and bb > 0:
        for player in players:
            if player["stack"] is not None:
                player["stack"] = round(player["stack"] / bb, 1)
        if pot:
            pot = round(pot / bb, 1)
    
    return {
        "players": players,
        "board": board,
        "pot": pot or 0,
        "street": street,
        "sb": sb,
        "bb": bb,
        "dealerSeat": dealer_seat,
        "actions": actions,
    }


# -----------------------------------------------------------------------------
# Database Functions
# -----------------------------------------------------------------------------

def load_env_file(path: Optional[str] = None) -> None:
    """Load .env file into os.environ."""
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        logger.info(".env file not found at %s", path)
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
        logger.warning("Failed to load .env: %s", e)


def get_db_url() -> str:
    """Get database URL from environment."""
    db_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
    )
    if not db_url:
        raise RuntimeError("DATABASE_URL is missing")
    return db_url


def get_pg_conn():
    """Get PostgreSQL connection."""
    db_url = get_db_url()
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    conn.autocommit = True
    return conn


def fetch_hands_needing_replayer_data(conn, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch hands that have raw_text but no replayer_data yet.
    """
    sql = """
        SELECT id, raw_text
        FROM public.hands
        WHERE raw_text IS NOT NULL
          AND (replayer_data IS NULL OR replayer_data = '{}'::jsonb)
        ORDER BY created_at DESC
        LIMIT %s;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (limit,))
        return cur.fetchall()


def update_hand_replayer_data(conn, hand_id: Any, replayer_data: Dict[str, Any]) -> None:
    """
    Update the replayer_data column for a hand.
    """
    sql = """
        UPDATE public.hands
        SET replayer_data = %s
        WHERE id = %s;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (Json(replayer_data), hand_id))


def process_hands(conn, batch_size: int = 50) -> int:
    """
    Process a batch of hands: parse raw_text and update replayer_data.
    Returns number of hands processed.
    """
    hands = fetch_hands_needing_replayer_data(conn, batch_size)
    if not hands:
        logger.info("No hands needing replayer parsing.")
        return 0
    
    processed = 0
    for hand in hands:
        hand_id = hand["id"]
        raw_text = hand["raw_text"]
        
        try:
            replayer_data = parse_for_replayer(raw_text)
            if replayer_data and replayer_data.get("players"):
                update_hand_replayer_data(conn, hand_id, replayer_data)
                processed += 1
                logger.info("Parsed replayer data for hand %s", hand_id)
            else:
                logger.warning("Could not parse replayer data for hand %s", hand_id)
        except Exception as e:
            logger.error("Error parsing hand %s: %s", hand_id, e)
    
    logger.info("Processed %d hands for replayer data.", processed)
    return processed


# -----------------------------------------------------------------------------
# CLI Entry Point
# -----------------------------------------------------------------------------

def run_once(batch_size: int = 50) -> None:
    """Main runner - process a batch of hands."""
    logger.info("Starting replayer_parser with batch_size=%d", batch_size)
    load_env_file()
    conn = get_pg_conn()
    try:
        process_hands(conn, batch_size)
    finally:
        conn.close()
        logger.info("Closed database connection.")


if __name__ == "__main__":
    import sys
    try:
        batch = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    except ValueError:
        batch = 50
    run_once(batch_size=batch)
