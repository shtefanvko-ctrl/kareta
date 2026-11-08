# Docker builds the already-tested static binary without network or package install.
FROM scratch
COPY --chown=65532:65532 scion-worker /scion-worker
USER 65532:65532
ENTRYPOINT ["/scion-worker"]
