# Security Policy

## Supported versions

`gnosis` is pre-alpha. Only the latest commit on `main` is supported.

| Version | Supported |
|---------|-----------|
| latest `main` | ✅ |
| anything older | ❌ |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive bugs.

Use GitHub's [private vulnerability reporting](https://github.com/fvnky07/gnosis/security/advisories/new) form, or contact the maintainer through the email associated with the [@fvnky07](https://github.com/fvnky07) GitHub account.

When reporting, include:

- A description of the issue and its impact.
- Reproduction steps or a proof-of-concept.
- Affected commit SHA / version.
- Whether the issue is already public.

## Response expectations

- Acknowledgement within 7 days.
- A fix or mitigation plan within 30 days for confirmed issues.
- Coordinated disclosure: please give the maintainer a reasonable window before publishing details.

## Scope

In scope:

- The desktop binary, the Tauri capability surface, the parser, indexer, and SQLite migrations.
- Any path that writes to user files outside the chosen vault.
- Any code execution path triggered by content of a `.org` file.

Out of scope:

- Vulnerabilities in upstream dependencies that are already publicly disclosed and tracked by Dependabot.
- Issues requiring a malicious local user with shell access.
- Reports generated solely by automated scanners with no proof-of-impact.
