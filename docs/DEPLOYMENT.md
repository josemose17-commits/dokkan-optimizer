# Validation and deployment

## What the workflow enforces

[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) is the only workflow. One job, **Test and build (Node 24)**, runs on every pull request (into any branch, so stacked PRs are validated too), every push to `main` and manual runs:

1. `npm ci` from the lockfile.
2. `npm run format:check`.
3. `npm test` (unit tests).
4. `npm run build`, which includes the strict TypeScript check and builds `dist/` with the `/dokkan-optimizer/` base.
5. `npx playwright install --with-deps chromium`, then `npx playwright test` against that same `dist/`, served under `/dokkan-optimizer/` (desktop and mobile projects).
6. Pushes and manual runs on `main` only: that same `dist/` is uploaded as the Pages artifact.

Every check passes on the exact checkout and build that is uploaded. Nothing is built twice and no separate workflow has to finish first. The **Deploy main to GitHub Pages** job `needs` the validation job, so any failed step means no artifact and no deployment.

### Ordering on `main`

- Runs for the same ref share a concurrency group. On `main` a newer run waits; it does not cancel a running deployment. Superseded pull-request runs are cancelled.
- Before publishing, the deploy job reads the current head of `main`. If `main` has moved on since the run started, it **does not deploy** and logs a notice; the newer commit's own run decides. An older artifact therefore never overwrites a newer deployment, and is never published after a newer commit failed validation. In that case the site keeps its previous deployment until a commit passes.
- Permissions: the workflow default is `contents: read`. Only the deploy job adds `pages: write` and `id-token: write`, plus `contents: read` for the head check. The deploy job uses the `github-pages` environment.

## What needs a repository setting (owner action)

The workflow controls **publication**. It cannot stop a pull request from being **merged** while checks fail. That is a branch-protection setting only the repository owner can change:

- **Settings → Rules → Rulesets** (or **Settings → Branches → Branch protection rules**) for `main`: require the status check **Test and build (Node 24)** to pass before merging. Optionally require branches to be up to date, and disallow force pushes.
- **Settings → Pages → Build and deployment → Source → GitHub Actions**: already required by the existing setup.
- **Settings → Environments → github-pages**: optionally restrict deployments to `main`.

Without the required check, a failing pull request can still be merged; the gate above still prevents the failing revision from being published.

## Verification status

- Local: `actionlint` 1.7.7 reports no issues. The head-check script was exercised against a stubbed `gh` for both the head and not-head cases.
- Pull request CI exercises the validation job. The deploy path (main-only) runs only after an authorized merge, so it has not been observed here. Check the actual Actions run and environment before claiming a deployment is live.

## Current stack: PR #6 → base-state re-land (2026-10-19)

PR #5 is already merged into main. PR #6 targets **main** at `2527f60`. It also contains already-merged #7 (registry/explanations), #9 (maintenance) and #10 (limited progression-profile/equipment comparison); they do not need separate merges again. #8 was merged into `claude/evaluator-registry` after #7 had already been merged, so its record never reached #6. Branch `claude/tender-maxwell-o43x7j` re-lands it on #6's head.

Either merge the re-land PR into `claude/pages-deploy-gate` **before** #6, so #6 carries it, or merge **#6 first** and then retarget the re-land PR to main. Never merge it into `claude/pages-deploy-gate` after #6 has merged: that would strand it exactly as #8 was stranded. This is a dependency explanation, not a deployment instruction. Latest-head CI, review/conflict checks and the user's merge conditions must be satisfied before any later authorized integration.

- If #6 lands through a merge commit preserving `2527f60`, retarget the re-land PR from `claude/pages-deploy-gate` to main. No rebase is needed solely for that merge: the dependency ancestry is present. Reinspect the final diff and run fresh checks on the actual updated base/revision, especially if main has moved or conflicts arise.
- If #6 lands through squash/rebase, main will not preserve the same dependency ancestry. Rebase only the re-land's own commits onto main (the old boundary is `2527f60`), so the registry/editor/comparison/deployment changes are not proposed again. Check saved-data compatibility, review the final diff and rerun unit/types/build/browser/required CI on the resulting head. A pre-rebase green result does not cover that new revision.
- Never force-push main or bypass checks/protections. Later eligible implementation PRs may merge under the user's standing conditions; an explicit task-specific merge hold still applies. After an authorized merge, check the actual main build, Pages deployment and live `/dokkan-optimizer/` before claiming publication.

During the earlier #10 review, merging main `316492d` with #6 at `9cc0cce` produced exactly #6's tree, so retargeting #6 to main required no code conflict resolution. #10 is a **limited progression-profile/equipment comparison**, not completion of the allocation milestone.
