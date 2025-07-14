# KinGallery

> ⚠️ **Work in Progress** - This project is currently in early development.

A self-hosted Progressive Web App for sharing family photos and videos. Built with privacy and family sharing in mind.

## Overview

KinGallery is a private, invite-only media sharing platform designed for families. It focuses on creating a safe environment where families can share precious memories without worrying about privacy or data ownership.

### Key Features (Planned)

- 📱 **Progressive Web App** - Install on iOS/Android devices
- 🔒 **Privacy First** - Self-hosted with Cloudflare Access authentication
- 📸 **Smart Organization** - Auto-group photos by date and child
- ❤️ **Simple Interactions** - Comments and heart reactions
- 📺 **AirPlay Support** - Cast slideshows to TV
- 🌍 **Offline Ready** - Works without internet connection
- 🎨 **Earth-tone Design** - Calming green color palette

### Tech Stack

- **Frontend**: Astro + TailwindCSS
- **Backend**: Astro API routes with Node.js
- **Database**: SQLite
- **Storage**: Local filesystem
- **Authentication**: Cloudflare Access
- **Language**: TypeScript (strict mode)

## Project Structure

```text
/
├── docs/                    # Project documentation and PRD
├── public/                  # Static assets
├── src/
│   ├── components/          # Astro components
│   ├── layouts/            # Page layouts
│   ├── pages/              # Pages and API routes
│   └── assets/             # Images, fonts, etc.
└── package.json
```

## Development

### Available Commands

All commands are run from the root directory:

| Command           | Action                                     |
| ----------------- | ------------------------------------------ |
| `npm install`     | Install dependencies                       |
| `npm run dev`     | Start development server at localhost:4321 |
| `npm run build`   | Build production site to ./dist/           |
| `npm run preview` | Preview production build locally           |
| `npm t`           | Run unit tests                             |
| `npm run astro`   | Run Astro CLI commands                     |

## Documentation

See the [comprehensive PRD](docs/kin_gallery_prd_v_0_4.md) for detailed requirements, architecture, and implementation plans.

> **Note**: This is a personal project shared for reference. Use at your own risk with no support or SLA.
