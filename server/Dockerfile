# Build from the repository root:  docker compose build backend
#   (or: docker build -f server/Dockerfile .)
# The npm lockfile lives at the root (npm workspaces), so the context must be the root.
FROM node:20-alpine

RUN apk add --no-cache openssl tzdata
ENV NODE_ENV=production \
    TZ=Africa/Cairo \
    APP_TIMEZONE=Africa/Cairo

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server && npm cache clean --force

COPY server/prisma server/prisma
RUN cd server && npx prisma generate

COPY server/src server/src
COPY server/scripts server/scripts
COPY server/assets server/assets
COPY server/docker-entrypoint.sh server/docker-entrypoint.sh

WORKDIR /app/server
EXPOSE 5000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
