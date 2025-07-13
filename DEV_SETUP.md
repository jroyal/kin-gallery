# KinGallery Development Setup

## Prerequisites

1. **Node.js 20+** (required for the project)
2. **ffmpeg** (for video processing)
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   ```
   http://localhost:4321
   ```

The database will be automatically created and migrated on first startup.

## Development Features

### Authentication
- **Default user:** `dev@example.com` (automatically created as admin)
- **Simulate different users:** Add `?simulate_user=test@example.com` to any URL
- **Production:** Uses Cloudflare Access JWT via `CF-Access-Jwt-Assertion` header

### Directory Structure
```
data/                 # SQLite database (auto-created)
media/               # Uploaded media files (auto-created)
├── {child_id}/
│   └── {YYYY}/
│       └── {MM}/
│           ├── {hash}.{ext}        # Original files
│           ├── thumbs/             # 200px thumbnails
│           │   └── {hash}.{ext}
│           └── medium/             # 800px medium size
│               └── {hash}.{ext}
```

## API Testing

### Health Check
```bash
curl http://localhost:4321/api/health
```

### Authentication Status
```bash
curl http://localhost:4321/api/auth/me
```

### Create a Child (Admin only)
```bash
curl -X POST http://localhost:4321/api/children \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Child", "birthdate": "2020-01-01"}'
```

### Upload Media
```bash
curl -X POST http://localhost:4321/api/upload \
  -F "file=@/path/to/image.jpg" \
  -F "child_id=1"
```

### Get Media
```bash
curl http://localhost:4321/api/media
```

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Testing (when implemented)
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Database Management

The SQLite database is automatically created at `./data/kin-gallery.db`. To inspect:

```bash
# Install sqlite3 if needed
# macOS: brew install sqlite
# Ubuntu: sudo apt install sqlite3

# Connect to database
sqlite3 ./data/kin-gallery.db

# View tables
.tables

# View schema
.schema

# Exit
.exit
```

## Troubleshooting

### ffmpeg not found
Make sure ffmpeg is installed and in your PATH:
```bash
ffmpeg -version
```

### Port already in use
Change the port in `astro.config.mjs`:
```js
server: {
  port: 4322,  // Change this
  host: true
}
```

### Database locked
Stop the dev server and delete the database:
```bash
rm -rf ./data/
```
It will be recreated on next startup.

### Permission errors on media upload
Ensure the media directory is writable:
```bash
mkdir -p ./media
chmod 755 ./media
```

## Next Steps

The backend is complete! The project currently shows a development status page. Next phases:

1. **Frontend Components** - Albums grid, upload UI, media viewer
2. **Testing** - Unit tests, E2E tests with Playwright
3. **Deployment** - Docker production setup with Cloudflare Tunnel