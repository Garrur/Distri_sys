# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency graphs
COPY package*.json ./
RUN npm ci

# Copy source and configurations
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Only copy over the production essentials
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled source files
COPY --from=builder /app/dist ./dist

# By default, start the API, but this is dynamically overridden in render.yaml for workers
CMD ["npm", "run", "start:api"]
