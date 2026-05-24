FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copia public explicitamente para garantir arquivos estáticos (logo, icons, etc)
COPY --from=builder /app/public ./public
# Garante permissões corretas
RUN chown -R node:node /app/public
EXPOSE 3000
CMD ["node", "server.js"]
