# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Always plan everything before you get started
- Always document the results in docs/progress.md after you make a new change.

## Project Overview

KinGallery is a self-hosted, ad-free Progressive Web App for sharing family photos and videos. This is currently an Astro project in early development, bootstrapped from the Astro basics template.

## Development Commands

All commands run from the root directory:

- `npm install` - Install dependencies
- `npm run dev` - Start development server at localhost:4321
- `npm run build` - Build production site to ./dist/
- `npm run preview` - Preview production build locally
- `npm run astro` - Run Astro CLI commands
- `npm t` - run the unit tests

## Tech Stack & Architecture

### Core Technologies

- **Frontend**: Astro + TailwindCSS
- **Backend**: Astro API routes with @astrojs/node (standalone mode)
- **Database**: SQLite
- **Media Storage**: Local filesystem
- **Language**: TypeScript (strict mode enabled)

### Project Structure

- `src/pages/` - Astro pages and API routes
- `src/layouts/` - Astro layout components
- `src/components/` - Astro components
- `src/assets/` - Static assets
- `public/` - Public static files
- `docs/` - Project documentation including PRD

### Current State

Read through docs/progress.md

## Key Implementation Details

### Authentication & Authorization

- Cloudflare Access will handle authentication (email-based)
- Roles: admin and user
- No local password/SMTP flow required

### Media Processing Pipeline

- Images: resize to thumb/medium, keep original
- Videos: transcode to H.264 + poster frames
- Tool: ffmpeg (with potential sharp.js benchmarking)

### Data Model (Planned)

- `users` - id, email, role, created_at
- `children` - id, name, birthdate, cover_media_id
- `media` - id, child_id, filename, type, taken_at, dimensions, sha256
- `comments` - id, media_id, user_id, body, created_at

### PWA Features

- Service Worker for offline caching
- Web manifest with Kin green branding
- Offline upload/comment queue

## Development Approach

When implementing features, refer to the comprehensive PRD at docs/kin_gallery_prd_v_0_4.md which includes:

- Detailed user stories and requirements
- Earth-tone green branding guidelines
- Performance and security requirements
- Testing strategy with Vitest, Playwright, and Lighthouse
