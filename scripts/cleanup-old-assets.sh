#!/bin/bash
# Cleanup script for Supabase Storage assets older than 12 hours
# Runs via cron every hour

SUPABASE_URL="https://fzngibjbhrirkdbpxmii.supabase.co"
BUCKET_NAME="assets"
MAX_AGE_HOURS=12
LOG_FILE="/var/log/adlaunch-cleanup.log"

# Get service role key from brain-api .env
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /opt/adlaunch/brain-api/.env | cut -d'=' -f2)

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "[$(date)] ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env" >> "$LOG_FILE"
    exit 1
fi

echo "[$(date)] Starting cleanup of assets older than ${MAX_AGE_HOURS} hours..." >> "$LOG_FILE"

# Calculate cutoff timestamp (12 hours ago in ISO format)
CUTOFF=$(date -u -d "${MAX_AGE_HOURS} hours ago" +%Y-%m-%dT%H:%M:%SZ)

# Function to recursively list and delete old files in a folder
cleanup_folder() {
    local PREFIX="$1"
    
    # List files in folder
    local RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/storage/v1/object/list/${BUCKET_NAME}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"prefix\": \"${PREFIX}\", \"limit\": 1000}")
    
    # Process each item
    echo "$RESPONSE" | jq -c '.[]' 2>/dev/null | while read -r ITEM; do
        local NAME=$(echo "$ITEM" | jq -r '.name')
        local CREATED=$(echo "$ITEM" | jq -r '.created_at // empty')
        local IS_FOLDER=$(echo "$ITEM" | jq -r '.id // empty')
        
        if [ -z "$IS_FOLDER" ] && [ -n "$NAME" ]; then
            # It's a folder, recurse into it
            if [ -n "$PREFIX" ]; then
                cleanup_folder "${PREFIX}${NAME}/"
            else
                cleanup_folder "${NAME}/"
            fi
        elif [ -n "$CREATED" ] && [ -n "$NAME" ]; then
            # It's a file, check if old enough to delete
            if [[ "$CREATED" < "$CUTOFF" ]]; then
                local FULL_PATH="${PREFIX}${NAME}"
                echo "[$(date)] Deleting old file: $FULL_PATH" >> "$LOG_FILE"
                curl -s -X DELETE "${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${FULL_PATH}" \
                    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" >> "$LOG_FILE" 2>&1
            fi
        fi
    done
}

# Start cleanup from root
cleanup_folder ""

echo "[$(date)] Cleanup complete." >> "$LOG_FILE"
