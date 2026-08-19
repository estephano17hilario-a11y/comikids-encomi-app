# ==============================================================================
# MULTI-STAGE DOCKERFILE PARA BACKEND FASTIFY + BULLMQ
# ==============================================================================

# 1. Stage de Compilación
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# 2. Stage de Producción Ultraligero
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Usuario no privilegiado para seguridad
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
