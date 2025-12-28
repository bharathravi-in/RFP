#!/bin/bash

# ================================================
# RFP Application Database Backup Script
# ================================================
# 
# This script creates PostgreSQL database backups
# and optionally uploads them to cloud storage.
#
# Usage:
#   ./backup_database.sh                    # Local backup
#   ./backup_database.sh --upload-gcp      # Backup + upload to GCS
#   ./backup_database.sh --upload-s3       # Backup + upload to S3
#
# Environment Variables Required:
#   DATABASE_URL - PostgreSQL connection string
#   
# Optional for cloud upload:
#   GCP_BACKUP_BUCKET - GCS bucket for backups
#   S3_BACKUP_BUCKET - S3 bucket for backups
#   AWS_REGION - AWS region for S3
# ================================================

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/rfp-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="rfp_backup_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse DATABASE_URL
parse_db_url() {
    if [[ -z "$DATABASE_URL" ]]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Parse: postgresql://user:pass@host:port/dbname
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    
    log_info "Database: $DB_NAME on $DB_HOST:$DB_PORT"
}

# Create backup directory
setup_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log_info "Backup directory: $BACKUP_DIR"
}

# Create database backup
create_backup() {
    log_info "Creating backup: $BACKUP_FILE"
    
    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --format=custom \
        | gzip > "$BACKUP_DIR/$BACKUP_FILE"
    
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    log_info "Backup created: $BACKUP_SIZE"
}

# Upload to GCS
upload_to_gcp() {
    if [[ -z "$GCP_BACKUP_BUCKET" ]]; then
        log_error "GCP_BACKUP_BUCKET not set"
        exit 1
    fi
    
    log_info "Uploading to GCS: gs://$GCP_BACKUP_BUCKET/backups/"
    gsutil cp "$BACKUP_DIR/$BACKUP_FILE" "gs://$GCP_BACKUP_BUCKET/backups/$BACKUP_FILE"
    log_info "Upload complete"
}

# Upload to S3
upload_to_s3() {
    if [[ -z "$S3_BACKUP_BUCKET" ]]; then
        log_error "S3_BACKUP_BUCKET not set"
        exit 1
    fi
    
    log_info "Uploading to S3: s3://$S3_BACKUP_BUCKET/backups/"
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BACKUP_BUCKET/backups/$BACKUP_FILE" \
        --region "${AWS_REGION:-us-east-1}"
    log_info "Upload complete"
}

# Clean old local backups
cleanup_old_backups() {
    log_info "Cleaning backups older than $RETENTION_DAYS days"
    find "$BACKUP_DIR" -name "rfp_backup_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
}

# Verify backup
verify_backup() {
    log_info "Verifying backup integrity..."
    if gunzip -t "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
        log_info "Backup verified successfully"
    else
        log_error "Backup verification failed!"
        exit 1
    fi
}

# Main
main() {
    log_info "Starting RFP database backup..."
    
    parse_db_url
    setup_backup_dir
    create_backup
    verify_backup
    
    # Handle upload options
    case "${1:-}" in
        --upload-gcp)
            upload_to_gcp
            ;;
        --upload-s3)
            upload_to_s3
            ;;
        *)
            log_info "Local backup only (use --upload-gcp or --upload-s3 for cloud)"
            ;;
    esac
    
    cleanup_old_backups
    
    log_info "Backup complete: $BACKUP_DIR/$BACKUP_FILE"
}

main "$@"
