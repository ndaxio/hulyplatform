# Agent Instructions

## NDAX Huly Deployment Pinning

When working on NDAX Huly deployment, adapter, or server setup tasks in this repo, follow `docs/ndax-huly-deployment-policy.md`.

Do not treat the nearest upstream Huly release tag as the deployment pin when the stack or adapter is built from a custom NDAX branch. The stack and adapter must be built from, and identified by, the same immutable fork commit or fork tag.
