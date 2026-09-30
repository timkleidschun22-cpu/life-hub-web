# Life Hub Web

Public static deployment repository for Life Hub.

This repository contains only the public client build and deployment metadata. Never commit personal exports, secrets, private records, or service-role credentials here. Personal Core data remains in the app's local storage and, after user authentication, may sync to the user's protected Supabase data layer.

## Release flow

The private Life Hub repository builds and validates the static web artifact. A short-lived `release-source.json` handoff triggers `.github/workflows/promote-artifact.yml`, which:
- accepts only an HTTPS OpenAI file-handoff URL;
- rejects expired or unexpected artifacts;
- verifies expected Life Hub build markers;
- creates the release metadata for the exact artifact;
- deploys that verified artifact directly to GitHub Pages.

The repository's persisted `site/` directory is only a fallback snapshot and can lag behind the live deployment because the GitHub Actions token cannot push promoted artifacts back to this repository. The manual Pages workflow therefore refuses to deploy `site/` unless its release metadata exactly matches the current release handoff. This prevents an older fallback from replacing a newer live release.
