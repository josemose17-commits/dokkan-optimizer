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
