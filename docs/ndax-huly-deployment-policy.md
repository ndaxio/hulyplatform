# NDAX Huly Deployment Policy

This repo is deployed from the NDAX fork at `https://github.com/ndaxio/hulyplatform.git`.

The deployment rule is simple: the Huly stack and the NDAX adapter must be built from the same immutable fork commit or fork tag. This is the load-bearing compatibility pin for server installs.

## Branch Model

- `hcengineering/platform:develop` is the upstream Huly source.
- `ndaxio/hulyplatform:develop` tracks upstream Huly updates and should stay as close to upstream as possible.
- NDAX custom work belongs on feature or deploy branches created from `ndaxio/develop`.
- Deployment tags are created on the final custom branch commit, not on plain `develop`.

Avoid accumulating unrelated NDAX custom changes directly on `ndaxio/develop`. Keeping `ndaxio/develop` close to upstream makes future Huly updates easier to consume.

## Update Flow

1. Fetch upstream and fork remotes.

   ```bash
   git fetch origin
   git fetch ndaxio
   ```

2. Sync the custom deployment branch onto the fork base.

   ```bash
   git checkout codex/ndax-huly-agent-review-panel
   git rebase ndaxio/develop
   ```

3. Verify the branch is ahead of `ndaxio/develop` only by the intended custom commits.

   ```bash
   git rev-list --left-right --count HEAD...ndaxio/develop
   git log --oneline --decorate --graph --max-count=12 HEAD ndaxio/develop
   ```

4. Create a fork deployment tag on the exact commit to install.

   ```bash
   git tag ndax-huly-YYYY-MM-DD
   git push ndaxio codex/ndax-huly-agent-review-panel
   git push ndaxio ndax-huly-YYYY-MM-DD
   ```

5. Use that exact tag as the Huly version tag when configuring the server and when building the adapter.

## Server Setup Handoff

Give the server operator:

- fork repo: `https://github.com/ndaxio/hulyplatform.git`
- branch: the rebased custom deployment branch
- deployment tag: the immutable fork tag created from that branch
- commit: the exact commit pointed to by the tag
- Huly version tag prompt value: the same deployment tag

Do not provide the nearest upstream release tag, such as `s0.7.327`, as the compatibility pin unless the stack and adapter were both built exactly from that upstream release tag.
