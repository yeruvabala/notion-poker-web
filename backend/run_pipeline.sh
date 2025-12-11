#!/bin/bash

PYTHON=/usr/bin/python3
HOME_DIR=/home/ec2-user

cd "$HOME_DIR"

/usr/bin/flock -n /tmp/onlypoker_pipeline.lock bash -c "
  echo \"[PIPELINE] Starting Bronze worker at \$(date)\"
  $PYTHON $HOME_DIR/worker.py >> $HOME_DIR/worker.log 2>&1
  BRONZE_STATUS=\$?

  if [ \$BRONZE_STATUS -ne 0 ]; then
    echo \"[PIPELINE] Bronze worker failed with status \$BRONZE_STATUS, skipping coach\" >> $HOME_DIR/pipeline.log
    exit \$BRONZE_STATUS
  fi

  echo \"[PIPELINE] Starting Coach worker at \$(date)\"
  $PYTHON $HOME_DIR/coach_worker.py >> $HOME_DIR/coach_worker.log 2>&1

  echo \"[PIPELINE] Done pipeline at \$(date)\" >> $HOME_DIR/pipeline.log
"

