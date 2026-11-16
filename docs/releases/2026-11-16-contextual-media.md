# Verified Boardroom production release

- Origin: https://note.vertexfilms.ca
- Date: November 16, 2026 (UTC)
- Main commit: `0291f8e738cf3f0521611ebe86b869cca62e5f8d`
- Previous main: `50c9f1a49ef5e09e66be4b37d4ddec1c968646da`
- Image: `ghcr.io/rehmanmuaz/boardroom@sha256:d3d4aaa3a9129f8e76f858961a6f89dbb2c2313b974fbe65addff83f748015f7`
- Feature: https://github.com/RehmanMuaz/Boardroom/pull/26
- Release: https://github.com/RehmanMuaz/Boardroom/pull/27
- Successful workflow: https://github.com/RehmanMuaz/Boardroom/actions/runs/43966205642

## Included

Durable comments/replies/mentions/unread state; direct card/annotation/connection/group comments; aligned modifier/header controls and bounded dialogs; semantic primary actions and product icon; proportional new image/video frames; contextual element tools and visual cropping with undoable frame fitting. Existing Flow workspace editing remains intact. Hub and Studio icon changes are separate source PRs, not part of this server deployment.

## Persistence and rollout

Migrations 010 and 012 are additive: feedback tables and nullable element anchors. Existing migration 011 remains registered. There is no workspace JSON version migration or rewriting of existing saved frames on load. Original uploaded media bytes are retained. The existing pipeline preserves private configuration and named application volumes.

The deployment log confirms checkout of `0291f8e`, database/media backup completion at 22:09:11 UTC and deployment readiness at 22:09:30 UTC. As in the existing backup policy, sessions and account recovery links are excluded from the backup. No rollback was needed; the previous image and pre-deployment backup remain the recovery references. No backup contents or credentials are committed here.

## Verification

Feature, release and main CI checks passed, including PostgreSQL/domain/PDF checks, Chromium workflows and Docker/helper builds. Local validation included 93 core checks (one existing Windows skip), all 57 Chromium regressions and production build, plus targeted Exif/client-view checks.

After deployment, public `/health/live` and `/health/ready` returned 200. The served bundle includes selection quick actions, image crop and direct comments; the favicon and local-blob image CSP are present. An isolated browser guest canvas passed contextual duplicate/undo, disabled guest comments and phone overflow checks without page errors. Smoke testing created no production account, team workspace, invitation, upload or email.

Remaining: real-device mobile gestures/navigation, workspace discovery, optional crop presets, commenter role and later video editing. Historical development notes elsewhere describe earlier not-yet-deployed stages; this record is authoritative for this release.
