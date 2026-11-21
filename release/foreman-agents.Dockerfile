# Coolify deploys this: the image GitHub Actions built for this commit (.github/workflows/image.yml).
ARG SOURCE_COMMIT
FROM ghcr.io/hamchowderr/foreman-agents:sha-${SOURCE_COMMIT}
