#!/usr/bin/env python3
import sys
import os
sys.path.append(os.getcwd())

from backend.coach_worker import get_pg_conn, coach_new_hands, load_env_file

load_env_file("backend/.env")
conn = get_pg_conn()
coached = coach_new_hands(conn, batch_size=10)
print(f"\n✅ Coached {coached} hands")
conn.close()
