FROM node:20-alpine AS base

# Install dependencies for ffmpeg and sharp
RUN apk add --no-cache \
    ffmpeg \
    libvips-dev \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY astro.config.mjs ./
COPY tailwind.config.js ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/

# Build the application
RUN npm run build

# Expose port
EXPOSE 4321

# Create data and media directories
RUN mkdir -p /app/data /app/media

# Copy startup script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Start the application
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]