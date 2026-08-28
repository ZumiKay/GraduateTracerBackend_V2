# ==========================================
# Stage 1: Build & compile TypeScript
# ==========================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install native build tools for modules like bcrypt
RUN apk add --no-cache python3 make g++

# Copy package definition files
COPY package*.json ./

# Install ALL dependencies (including devDependencies required for tsc)
RUN npm ci

# Copy application source code and configurations
COPY tsconfig*.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build

# Prune devDependencies to keep only production dependencies
RUN npm prune --omit=dev && npm cache clean --force

# ==========================================
# Stage 2: Production runtime
# ==========================================
FROM node:24-alpine AS runner

WORKDIR /app

# Install system runtime dependencies for Chromium / Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configure Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=8000

# Copy production artifacts from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY healthcheck.js ./healthcheck.js

# Use non-root node user provided by alpine node base image
USER node

# Expose backend service port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node healthcheck.js || exit 1

# Start backend application
CMD ["node", "dist/server.js"]
