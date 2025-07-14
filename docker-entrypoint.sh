#!/bin/sh

# Docker entrypoint script for KinGallery
# Handles first-boot initialization and clean install detection

set -e

echo "🚀 Starting KinGallery..."

# Check if database exists
if [ ! -f "/app/data/kin-gallery.db" ]; then
    echo "📋 Database not found - running clean install..."
    npm run clean-install
    echo "✅ Clean install completed"
else
    echo "📋 Database exists - running migrations only..."
    # We could add a migration-only script here if needed
fi

# Ensure media directory exists
mkdir -p /app/media

echo "🌟 Starting application..."
exec "$@"