#!/bin/bash

# run_pipeline.sh
# Entry point for the scheduled data pipeline cron job.
# Delegates to the Python Orchestrator for intelligent execution.

PYTHON=/usr/bin/python3
HOME_DIR=/home/ec2-user

cd "$HOME_DIR"

# Prevent multiple pipelines from running at the same time
/usr/bin/flock -n /tmp/onlypoker_pipeline.lock bash -c "
  echo \"[WRAPPER] Starting Pipeline Orchestrator at \$(date)\" >> $HOME_DIR/pipeline.log
  
  # Run the Python Orchestrator
  # This script handles worker -> coach (loop) -> study
  $PYTHON $HOME_DIR/orchestrator.py >> $HOME_DIR/pipeline.log 2>&1
  EXIT_CODE=\$?

  echo \"[WRAPPER] Pipeline finished with code \$EXIT_CODE at \$(date)\" >> $HOME_DIR/pipeline.log
  exit \$EXIT_CODE
"
