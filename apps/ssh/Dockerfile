FROM node:22-alpine3.22 AS builder
RUN corepack enable

# Native build tools for ssh2's C++ crypto binding (AES-GCM, ChaCha20, DH)
RUN apk add --no-cache python3 make g++ && npm install -g node-gyp

WORKDIR /app

# Build context is repo root.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ssh/package.json apps/ssh/tsconfig.json ./apps/ssh/
RUN pnpm install --frozen-lockfile --filter docs-ssh

# pnpm 10 skips install scripts unless allowlisted via onlyBuiltDependencies.
# ssh2's install.js runs node-gyp to compile its native crypto binding.
RUN cd node_modules/.pnpm/ssh2@*/node_modules/ssh2 && node install.js

COPY apps/ssh/src/ ./apps/ssh/src/
RUN pnpm --filter docs-ssh run build

# Web app static export
FROM node:22-alpine3.22 AS web-builder
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/tsconfig.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter docs-ssh-web

COPY apps/web/ ./apps/web/
RUN pnpm --filter docs-ssh-web run build
# Note: apps/web package name is kept as-is (docs-ssh-web)

FROM node:22-alpine3.22
ARG VERSION=dev
ENV VERSION=$VERSION
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/ssh/node_modules ./apps/ssh/node_modules
COPY --from=builder /app/apps/ssh/dist ./apps/ssh/dist
COPY --from=builder /app/apps/ssh/package.json ./apps/ssh/package.json

# Docs content - fetched by CI before docker build
COPY apps/ssh/docs ./apps/ssh/docs

# Static landing page
COPY --from=web-builder /app/apps/web/out/ ./apps/ssh/public/

WORKDIR /app/apps/ssh
ENV WEB_DIR=./public
EXPOSE 22 8080 9091

CMD ["node", "dist/server.js"]
