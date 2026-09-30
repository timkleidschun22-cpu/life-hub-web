# Life Hub Web

Public static deployment repository for Life Hub.

Personal Life Hub data stays local in the browser. Do not commit personal exports, secrets, API keys, or private data here.

## Release flow

The private Life Hub repository builds and validates the static web artifact. A short-lived `release-source.json` handoff can then trigger `.github/workflows/promote-artifact.yml`, which:
- accepts only an HTTPS OpenAI file-handoff URL;
- rejects expired or unexpected artifacts;
- verifies the expected Life Hub public build markers;
- replaces `site/` with the verified static artifact;
- writes non-indexing files and release metadata;
- commits only the public build output.

The existing Pages workflow deploys changes under `site/`.
