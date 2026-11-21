# release

GitHub Actions builds the agent server image (`Dockerfile.agents`), not the VPS.

- `.github/workflows/image.yml` builds the image on every pull request. On `main` it publishes
  `ghcr.io/hamchowderr/foreman-agents:sha-<commit>` and pushes that commit to the `release/foreman-agents` branch.
- Coolify deploys Foreman from `release/foreman-agents` with `release/foreman-agents.Dockerfile`, which is only
  `FROM` the published image for the deployed commit (`SOURCE_COMMIT`). The server downloads the image and builds nothing.
- The release branch only moves forward: the push is never forced, so re-running an older commit's workflow cannot
  roll the app back.
- The package is private. The VPS pulls it with its own ghcr.io login (a `read:packages` token).
