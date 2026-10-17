# Personal Inbox Zero self-hosting overlay

This branch contains the original Inbox Zero source at upstream commit
`59cf6d2bc85ab63408d2fc60064f18e1757615a4` plus the self-hosting runtime in this directory.
The upstream license and notices remain in place.

## How this fork is built

`image/Dockerfile` extends the exact released upstream image pinned by tag and
SHA-256 digest. It copies this runtime into that image and checks compatible
compiled exports. It does **not** rebuild `apps/web` from this repository.
Changing application source outside `selfhosted/` therefore requires the normal
upstream source build; those edits are not automatically included by this Dockerfile.

The overlay is kept separate so its changes and upstream version can be reviewed
independently. A newer upstream release does not automatically replace the
pinned base. Follow [UPGRADING.md](UPGRADING.md) when changing versions.

## Included changes

- Format-aware Gmail quota accounting: full message reads cost 60 units,
  metadata reads 20; full thread reads 120, metadata reads 40.
- One shared adaptive 4,500-unit/minute budget across linked Gmail accounts,
  small read batches, quota cooldowns, cancellation and fair scheduling.
- Independent live catch-up while historical mail imports. New inbox arrivals
  take priority over old label history, with replay-safe pending cursors.
- Metadata-first list imports and live updates. Message bodies and attachment
  details load on demand through the original hydration API.
- Bounded sender cleanup pages, metadata conversation membership preparation,
  and metadata-operation readback. Archive writes and per-target verification
  retain the upstream durable command workflow.
- An optional one-minute Gmail poller forwarding notifications through the
  existing webhook when Pub/Sub has not been configured. It can trigger enabled
  mailbox rules; enable it deliberately after reviewing those rules.
- Build/startup compatibility checks for the pinned Gmail transport, mailbox
  source and operation executor; behavior tests for the overlay and poller.

## Build and configure

```sh
docker build -t inbox-zero-selfhosted:local selfhosted/image
```

Configure the resulting image with the upstream self-hosting environment and
persistent PostgreSQL/Redis services. Use a real production HTTPS URL for OAuth.
Do not commit credentials. The optional poller needs database access,
`INTERNAL_API_URL`, `HEALTH_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`EMAIL_ENCRYPT_SECRET`, `EMAIL_ENCRYPT_SALT`, and `GOOGLE_PUBSUB_VERIFICATION_TOKEN`,
using the same values as the app. See the poller script for its exact inputs.

Keep one web process using this in-memory budget. Multiple web replicas require
a distributed per-account limiter. The poller reads Gmail profiles itself and
forwards processing to the app; it is not a replacement for the application worker.

## Validation

The overlay tests use only Node's built-in test runner and mocked provider/HTTP
boundaries. They require no app dependencies, database, Gmail login, or API key.
Run from the repository root:

```sh
node --test selfhosted/image/*.test.cjs selfhosted/scripts/poll-gmail.test.mjs
node --check selfhosted/scripts/maintenance.mjs
node --check selfhosted/image/patch-gmail-transport.cjs
```

The same tests run in the dedicated **Self-hosted Gmail checks** workflow.
Actual image compatibility must additionally be checked by building and starting
the pinned image. See the upgrade runbook for a safe staged rollout.

## Limits

The quota guard is currently shared across accounts, and each browser keeps its
own local mailbox cache. A completed cache does not stop separate cleanup tools
from reading Gmail again. Bulk unsubscribe still processes senders sequentially
and may wait on external unsubscribe websites. Faster Gmail preparation does not
make those sites instantaneous. There are no production credentials, database
exports, browser sessions or host-specific deployment files in this package.
