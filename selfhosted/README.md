# Native self-hosted Inbox Zero

This fork builds the actual application source in this repository. Gmail quota,
sync and cleanup behavior is integrated through supported source call sites;
there is no minified-code matching, compiled-chunk editing, global-fetch
replacement, or Node preload patcher in the native image.

## Source and runtime

- `apps/web/utils/gmail/native-core.cjs` implements quota accounting, fair pacing,
  replay-safe history catch-up, and metadata source/executor adapters.
- `apps/web/utils/gmail/native-runtime.ts` owns the one shared process state and
  request contexts. Both the Google SDK and multipart reads use its transport.
- Gmail provider, middleware, mailbox source and operation executor call these
  adapters directly. Metadata-only list/cleanup reads preserve full content for
  body hydration, AI processing and sending.
- `selfhosted/upstream-revision.txt` records the reviewed upstream source base.
  OCI labels record the exact fork commit and tree used to build the image.

The existing upstream license and notices apply. Read [UPGRADING.md](UPGRADING.md)
before updating production.

## Build

Run from the repository root, using a source tree without local credentials:

```sh
docker buildx build --platform linux/arm64 \
  --file selfhosted/image/Dockerfile \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  --build-arg SOURCE_TREE="$(git rev-parse 'HEAD^{tree}')" \
  --build-arg UPSTREAM_REVISION="$(cat selfhosted/upstream-revision.txt)" \
  --tag inbox-zero-selfhosted:local --load .
```

Choose the architecture of the deployment node. The builder uses only synthetic
build environment values. Production PostgreSQL, Redis, OAuth and AI credentials
are supplied at runtime, never as build arguments. The image runs unprivileged
and retains the normal web/worker startup entrypoints.

Type checking is enabled in the image build. BuildKit retains the dependency and
Next cache between retries. A passing unit suite is not a substitute for building
and starting the resulting image.

## Tests

The core regression tests are colocated in `selfhosted/image` and import the native
source implementation. The app also tests real provider, SDK, middleware, mailbox
and operation boundaries. The native image workflow runs both suites before
building the ARM64 image artifact.

```sh
node --test selfhosted/image/*.test.cjs selfhosted/scripts/poll-gmail.test.mjs
pnpm --filter inbox-zero-ai exec vitest run \
  utils/mail-api/source.test.ts utils/mail-api/source.native.test.ts \
  utils/gmail/mailbox-sync.test.ts utils/gmail/client.test.ts \
  utils/gmail/client.native.test.ts utils/gmail/batch.test.ts \
  utils/mail-api/operations.test.ts utils/email/google.test.ts \
  utils/email/google.native.test.ts utils/middleware.test.ts --maxWorkers=2
```

Install the locked dependencies before app tests, using
`scripts/pnpm-install-without-desktop.sh --frozen-lockfile --config.node-linker=hoisted`.
Provider/network behavior is mocked; these tests do not act on a real mailbox.

## Operations

Keep one web process for the shared in-memory Gmail budget. Multiple replicas
need a distributed limiter. The optional minute poller and maintenance scripts
remain in `selfhosted/scripts`; the poller needs the app's database, OAuth,
encryption, webhook-verification and internal health credentials. Enabling it can
run existing mailbox rules, so review those rules deliberately.

Each browser keeps its own local cache. Bulk unsubscribe still waits on external
websites and processes senders sequentially. The source integration reduces
Gmail preparation/readback costs while retaining the original durable operations.
