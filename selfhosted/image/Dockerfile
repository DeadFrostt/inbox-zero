FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS builder
WORKDIR /app
RUN apk add --no-cache openssl && npm install -g pnpm@11.19.0
ENV CI=true HUSKY=0 NEXT_TELEMETRY_DISABLED=1
# Build only from an exported, reviewed repository tree. The root .dockerignore
# excludes local environment files, auth data, dependency trees and caches.
COPY . .
RUN --mount=type=cache,id=inbox-zero-native-pnpm,target=/root/.local/share/pnpm/store \
    ./scripts/pnpm-install-without-desktop.sh --frozen-lockfile --config.node-linker=hoisted
ENV NODE_ENV=production DOCKER_BUILD=true NODE_OPTIONS=--max-old-space-size=4096
ENV RAYON_NUM_THREADS=2 UV_THREADPOOL_SIZE=2
ENV DATABASE_URL=postgresql://synthetic:synthetic@invalid:5432/synthetic
ENV AUTH_SECRET=synthetic-build-only-not-a-runtime-secret
ENV GOOGLE_CLIENT_ID=synthetic GOOGLE_CLIENT_SECRET=synthetic
ENV GOOGLE_PUBSUB_TOPIC_NAME=projects/synthetic/topics/synthetic
ENV GOOGLE_PUBSUB_VERIFICATION_TOKEN=synthetic-build-only
ENV EMAIL_ENCRYPT_SECRET=synthetic EMAIL_ENCRYPT_SALT=synthetic
ENV DEFAULT_LLMS=openai-compatible:synthetic
ENV INTERNAL_API_KEY=synthetic API_KEY_SALT=synthetic
ENV REDIS_HTTP_URL=http://invalid:80 REDIS_HTTP_TOKEN=synthetic REDIS_URL=redis://invalid:6379
ARG NEXT_PUBLIC_BASE_URL=http://NEXT_PUBLIC_BASE_URL_PLACEHOLDER
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_BYPASS_PREMIUM_CHECKS=NEXT_PUBLIC_BYPASS_PREMIUM_CHECKS_PLACEHOLDER
ENV NEXT_PUBLIC_EMAIL_SEND_ENABLED=NEXT_PUBLIC_EMAIL_SEND_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_SELF_HOSTED_LOGIN_FOOTER_TEXT=NEXT_PUBLIC_SELF_HOSTED_LOGIN_FOOTER_TEXT_PLACEHOLDER
ENV NEXT_PUBLIC_CLEANER_ENABLED=NEXT_PUBLIC_CLEANER_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_AUTO_DRAFT_DISABLED=NEXT_PUBLIC_AUTO_DRAFT_DISABLED_PLACEHOLDER
ENV NEXT_PUBLIC_MEETING_BRIEFS_ENABLED=NEXT_PUBLIC_MEETING_BRIEFS_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_INTEGRATIONS_ENABLED=NEXT_PUBLIC_INTEGRATIONS_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_BOOKING_LINKS_ENABLED=NEXT_PUBLIC_BOOKING_LINKS_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_SMART_FILING_ENABLED=NEXT_PUBLIC_SMART_FILING_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_DIGEST_ENABLED=NEXT_PUBLIC_DIGEST_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_WEBHOOK_ACTION_ENABLED=NEXT_PUBLIC_WEBHOOK_ACTION_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_EXTERNAL_API_ENABLED=NEXT_PUBLIC_EXTERNAL_API_ENABLED_PLACEHOLDER
ENV NEXT_PUBLIC_AI_MODEL_SETTINGS_DISABLED=NEXT_PUBLIC_AI_MODEL_SETTINGS_DISABLED_PLACEHOLDER
RUN --mount=type=cache,id=inbox-zero-native-next,target=/app/apps/web/.next/cache \
    node apps/web/scripts/build-mcp-app.mjs \
 && cd apps/web && ../../node_modules/.bin/next build \
 && ../../node_modules/.bin/serwist build serwist.config.mjs
RUN pnpm --filter inbox-zero-ai deploy --legacy --prod /runtime/web \
 && pnpm --filter @inboxzero/worker deploy --legacy --prod /runtime/worker

FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS runner
WORKDIR /app
RUN apk add --no-cache openssl \
 && addgroup -S -g 1001 inboxzero \
 && adduser -S -u 1001 -G inboxzero -h /home/inboxzero inboxzero
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=1001:1001 /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /runtime/web/node_modules ./apps/web/node_modules
COPY --from=builder /runtime/worker ./apps/worker
COPY docker/scripts ./docker/scripts
COPY selfhosted/scripts ./selfhosted/scripts
RUN chmod +x docker/scripts/*.sh \
 && npm install -g prisma@7.10.0 \
 && test -f apps/web/server.js \
 && test -f selfhosted/scripts/poll-gmail.mjs \
 && test -f selfhosted/scripts/maintenance.mjs
ARG SOURCE_REVISION
ARG SOURCE_TREE
ARG UPSTREAM_REVISION
LABEL org.opencontainers.image.source=https://github.com/DeadFrostt/inbox-zero \
      org.opencontainers.image.revision=${SOURCE_REVISION} \
      dev.deadfrost.inbox-zero.source-tree=${SOURCE_TREE} \
      dev.deadfrost.inbox-zero.upstream-revision=${UPSTREAM_REVISION} \
      dev.deadfrost.inbox-zero.gmail-integration=native-source-v1
ENV NODE_PATH=/usr/local/lib/node_modules NEXT_TELEMETRY_DISABLED=1 TMPDIR=/tmp
USER 1001:1001
EXPOSE 3000
CMD ["/app/docker/scripts/start.sh"]
