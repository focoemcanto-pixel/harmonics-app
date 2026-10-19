# Project safety rules

## Production-data privacy

Never copy production data or production-derived data into test code, fixtures,
snapshots, commits, pull requests (including descriptions), issues, comments,
screenshots, logs, or public build artifacts. This includes real client names,
initials, identifiers, dates, amounts, and combinations that could identify a
real event. Masking only a name is insufficient if other identifying fields remain.

Production data may be consulted only for authorized read-only validation. Any
example persisted in this repository or published with project work must be
entirely synthetic, with invented identities, identifiers, dates, and arbitrary
amounts unrelated to production records. Do not derive fixtures by abbreviating,
rescaling, shifting, or partially anonymizing real records.

Before publishing a commit or PR, audit the complete diff, fixtures, snapshots,
logs, screenshots, title, body, and comments for production-derived content.
Test output and public build logs must use only synthetic scenario descriptions.
This also covers downloadable build artifacts, cached source archives, test
reports, snapshots, and attachments published by CI or review tools.
If private data has already entered an unmerged branch, a follow-up commit is not
a privacy fix: rewrite the affected branch history, verify the PR-specific
reachable commits on GitHub, and report any hosting-level residual copies that
cannot be removed through normal repository operations.
