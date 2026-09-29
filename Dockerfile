# Multi-stage Dockerfile for MikroTik Auto Backup Manager
# Stage 1: Build Frontend and Server Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY .npmrc ./
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Build the frontend Vite application
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
COPY .npmrc ./
RUN npm install --omit=dev --legacy-peer-deps && \
    npm install -g tsx

# Copy built assets and backend server script from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

# Create data directory for persistent backups & SQLite/JSON database
RUN mkdir -p /app/data/backups && \
    chown -R node:node /app

# Expose port
EXPOSE 3000

# Run as non-root user
USER node

# Persistent volume for backups
VOLUME ["/app/data"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/stats || exit 1

# Start server using tsx
CMD ["npx", "tsx", "server.ts"]
