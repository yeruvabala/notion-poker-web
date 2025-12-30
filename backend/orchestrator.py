#!/usr/bin/env python3
"""
Orchestrator Script
-------------------
This script manages the entire data pipeline execution flow.
It replaces the simpler 'run_pipeline.sh' with intelligent looping and error handling.

System Design Pattern: "Pipeline Controller" or "Task Orchestrator"
Role: Supervises the execution of dependent ETL (Extract, Transform, Load) stages.
"""

import os
import sys
import time
import subprocess
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [ORCHESTRATOR] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), 'pipeline.log'))
    ]
)
logger = logging.getLogger(__name__)

# Paths
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_EXE = sys.executable  # Use the same python interpreter running this script

def run_stage(name, script_name, loop_until_empty=False, max_loops=50):
    """
    Run a pipeline stage (script).
    If loop_until_empty is True, reruns until the script reports 0 processed items.
    """
    script_path = os.path.join(BACKEND_DIR, script_name)
    logger.info(f"--- Starting Stage: {name} ({script_name}) ---")
    
    start_time = time.time()
    
    if not loop_until_empty:
        # Simple single run (e.g., worker.py, study_ingest.py)
        try:
            result = subprocess.run([PYTHON_EXE, script_path], check=True, text=True, capture_output=True)
            logger.info(f"Stage {name} completed successfully.")
            # Log output snippet if needed (be careful with length)
            # logger.debug(result.stdout)
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Stage {name} FAILED with code {e.returncode}.")
            logger.error(f"Error output:\n{e.stderr}")
            return False
            
    else:
        # Looping run (e.g., coach_worker.py)
        # We need the script to print something we can parse, 
        # OR we rely on a specific return code? 
        # Since we didn't modify coach_worker to return a specific code for "more work left",
        # we will rely on capturing stdout or just blindly looping until a count is met.
        
        # BETTER APPROACH given current codebase: 
        # coach_worker currently logs "Coached X hands this run."
        # We will grep that output.
        
        total_processed = 0
        loops = 0
        
        while loops < max_loops:
            loops += 1
            logger.info(f"Loop {loops}/{max_loops} for {name}...")
            
            try:
                result = subprocess.run([PYTHON_EXE, script_path], check=True, text=True, capture_output=True)
                
                # Check output for "Coached 0 hands" or similar
                # The logger in coach_worker prints to stderr or stdout depending on config, usually stderr for logging.
                output = result.stdout + result.stderr
                
                # Look for "Coached 0 hands" -> specific string from coach_worker.py line 309
                if "Coached 0 hands" in output or "Nothing to do" in output:
                    logger.info(f"Stage {name} finished (Queue empty).")
                    break
                
                # Try to extract count (optional, just for logging)
                # "Coached 5 hands this run"
                import re
                match = re.search(r"Coached (\d+) hands", output)
                count = int(match.group(1)) if match else 0
                total_processed += count
                
                if count == 0:
                     logger.info(f"Stage {name} reported 0 items processed. Stopping.")
                     break
                
                logger.info(f"Processed {count} items. Continuing...")
                time.sleep(1) # Breathe
                
            except subprocess.CalledProcessError as e:
                logger.error(f"Stage {name} crashed on loop {loops}.")
                logger.error(e.stderr)
                return False
                
        logger.info(f"Stage {name} completed. Total items processed: {total_processed}")
        return True

def main():
    logger.info("Pipeline execution started.")
    
    # 1. Ingestion (Bronze Layer)
    # Fetches new files from S3 and puts them in 'hands' table
    if not run_stage("Ingestion", "worker.py"):
        logger.error("Ingestion failed. Aborting pipeline.")
        sys.exit(1)
        
    # 2. Enrichment/Analysis (Gold Layer)
    # Loops coach_worker to process all pending hands with Multi-Agent Model
    if not run_stage("Analysis", "coach_worker.py", loop_until_empty=True):
        logger.error("Analysis failed. Aborting pipeline.")
        sys.exit(1)
        
    # 3. Indexing (Study Layer)
    # Updates embeddings for the Chat/Study feature
    # We loop this too, just in case there are many new hands
    if not run_stage("Indexing", "study_ingest.py", loop_until_empty=True, max_loops=10):
        logger.error("Indexing failed. Aborting pipeline.")
        sys.exit(1)
        
    logger.info("Pipeline execution FINISHED successfully.")

if __name__ == "__main__":
    main()
