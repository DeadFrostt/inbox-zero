# Native source upgrade procedure

The application is built from this fork's source. Updating upstream no longer
requires matching or rewriting compiled JavaScript. Production still uses an
immutable image digest; syncing the fork alone does not change the running app.

1. Merge the chosen upstream revision into a review branch. Resolve source
   conflicts deliberately, and update `selfhosted/upstream-revision.txt` to the
   upstream commit actually included in that branch.
2. Review Prisma schema/migration changes and native Gmail integration call sites.
   Keep SDK and multipart requests on the shared transport, preserve complete
   conversation IDs and per-target operation verification, and retain full bodies
   for opening messages, AI and sends.
3. Install locked dependencies; run the native core/poller and app regressions.
4. Build the full production image with TypeScript checks enabled. Record the
   source commit, source tree, upstream revision, image digest and architecture.
   Never replace a failed source build with a newer prebuilt image plus old
   compiled-code patches.
5. Start the image against an isolated database/Redis environment. Keep live
   worker jobs, mail rules, poller and maintenance disabled in staging. Check
   database-backed health and verify that no production credentials or synthetic
   build values accidentally become runtime configuration.
6. Check login, paginated sender scans, complete conversation membership,
   read-only operation inspection, live catch-up and body/attachment hydration.
   Any write test needs deliberately selected test messages.
7. Back up production and verify the restore procedure. Retain the current image
   and manifests for rollback. Check schema compatibility before switching images.
8. Import the tested image on the deployment node, update web/worker image and
   script references together, remove legacy preload ConfigMap mounts, and roll
   out through the deployment's normal configuration workflow.
9. Verify database-backed readiness, sync/cleanup reads, minute quota summaries,
   notifications and scheduled jobs before declaring the upgrade complete.

Image rollback does not reverse database migrations or completed Gmail actions.
If a migration is incompatible, assess restoring the backup versus a forward fix
before reverting application code. Preserve the exact old image while deciding.

The legacy image and earlier fork commits remain available in history; the native
image has no runtime compiled-code patcher to mount or re-enable.
