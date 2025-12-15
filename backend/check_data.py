
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')

def check_recent_hands():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Checking recent hands...")
    cur.execute("""
        SELECT id, created_at, date, stakes, position, cards, gto_strategy, exploit_deviation
        FROM hands 
        ORDER BY created_at DESC 
        LIMIT 5
    """)
    
    rows = cur.fetchall()
    for row in rows:
        print(f"ID: {row[0]}")
        # print(f"Created: {row[1]}")
        print(f"Date: {row[2]}")
        print(f"Stakes: {row[3]}")
        print(f"Position: {row[4]}")
        print(f"Cards: {row[5]}")
        print(f"GTO: {row[6]}")
        print(f"EXPL: {row[7]}")
        print("-" * 20)
        
    conn.close()

if __name__ == "__main__":
    try:
        check_recent_hands()
    except Exception as e:
        print(f"Error: {e}")
