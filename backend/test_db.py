import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get the Database URL
db_url = os.getenv("DATABASE_URL")

print(f"DEBUG: Connecting to: {db_url}")

if not db_url:
    print("❌ Error: DATABASE_URL is missing from .env")
else:
    try:
        # Attempt to connect directly to PostgreSQL
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Run a simple SQL query (SELECT 1 is the standard "Are you alive?" check)
        cur.execute("SELECT 1;")
        result = cur.fetchone()
        
        print("🎉 SUCCESS! Connected via psycopg2.")
        print(f"Database response: {result}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print("❌ Connection Failed:")
        print(e)
