# Per-PR Storybook previews

Every pull request builds Storybook and publishes it to its own URL, which a bot
posts as a comment on the PR. Pushing more commits redeploys to the same link,
so a designer can refresh rather than hunt for a new one.

This is the workflow from Blinkit's own design-library post — they ran it on
Jenkins; this runs on GitHub Actions.

## One-time setup

The workflow needs a Vercel token. It is the only thing not already wired up,
because a token is a credential and has to be created by you.

1. Create a token at **https://vercel.com/account/tokens**
   Scope it to the **shelar's projects** team. "No expiration" is convenient;
   a dated one is safer.

2. Add it to the repository as a secret — run this in your own terminal so the
   value never leaves your machine:

   ```bash
   gh secret set VERCEL_TOKEN --repo shelar1423/BLINKIT
   ```

   It will prompt for the value. Paste the token and press enter.

That's it. The next pull request gets a preview link.

## What runs

`.github/workflows/storybook.yml`, on every pull request and every push to
`main`:

| Step | What it does |
|---|---|
| `npm ci` | installs, with npm cache restored between runs |
| `npm run check:tokens` | fails the build if the Constants layer and `tokens.css` disagree |
| `npm run build:storybook` | builds to `storybook-static/` |
| deploy | preview URL on a PR, production on `main` |
| comment | posts (or updates) the link on the PR |

Concurrency is grouped per branch with `cancel-in-progress`, so a rapid series
of pushes doesn't queue up builds that are already stale.

Before the secret exists the build still runs — including the token guard — and
only the deploy is skipped, with a notice. It won't sit red on every PR.

## Why the app doesn't need this

The `blinkit-hot-wheels` Vercel project is connected to this repo directly, so
it already gets native preview deployments per PR. Storybook needs a workflow
because its build command (`build:storybook`) differs from the app's, and a
Vercel project holds only one build configuration.

## The two projects

| | Vercel project | Production URL |
|---|---|---|
| App | `blinkit-hot-wheels` | https://blinkit-hot-wheels.vercel.app |
| Storybook | `blinkit-hw-storybook` | https://blinkit-hw-storybook.vercel.app |
