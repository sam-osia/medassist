#!/bin/bash

# Check if virtual environment is already active
if [[ -z "${VIRTUAL_ENV}" ]]; then
    echo "Activating virtual environment..."
    # Check if .venv directory exists in the same directory
    if [[ -d ".venv" ]]; then
        source .venv/bin/activate
    else
        echo "Error: Virtual environment '.venv' not found in the current directory"
        exit 1
    fi
else
    echo "Virtual environment already active: ${VIRTUAL_ENV}"
fi

# Run the application
uvicorn app:app --host 0.0.0.0 --port 8000 --reload 