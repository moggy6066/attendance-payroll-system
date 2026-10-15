# Build from the repository root:  docker compose build backend
#   (or: docker build -f server/Dockerfile .)
# The npm lockfile lives at the root (npm workspaces), so the context must be the root.
FROM node:22-alpine

RUN apk add --no-cache openssl tzdata
ENV NODE_ENV=production \
    TZ=Africa/Cairo \
    APP_TIMEZONE=Africa/Cairo

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
# --ignore-scripts: no third-party install scripts run during the build. The only ones we
# need are Prisma's, and `prisma generate` + `prisma version` below fetch its engines explicitly.
RUN npm ci --workspace server --ignore-scripts && npm cache clean --force

COPY server/prisma server/prisma
RUN cd server && ../node_modules/.bin/prisma generate && ../node_modules/.bin/prisma version >/dev/null

COPY server/src server/src
COPY server/scripts server/scripts
COPY server/assets server/assets
COPY server/docker-entrypoint.sh server/docker-entrypoint.sh

WORKDIR /app/server
# Run as the unprivileged "node" user (uid 1000) that ships with the official image.
# The app only reads its files; nothing under /app needs to be writable.
USER node
EXPOSE 5000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
