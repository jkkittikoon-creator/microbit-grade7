# Production v40 Release Checkpoint — Tilt Lab ม.1

**Date:** 2 Sep 2026  
**Scope:** Promote TEST v10 GOLD candidate through Git merge/push and Production deployment gate
**Final status:** ~~RESOLVED — PRODUCTION v40 DEPLOYED / GOLD CLOSED~~
**CORRECTED 2 Sep 2026 — DEPLOYED, BUT v40 DOES NOT CONTAIN THE TEST v10 WORK**

---

## ⚠ CORRECTION — read this before trusting anything below

The pointer move to v40 really happened and Production is healthy. **But v40 does
not contain the Lesson X/Y TEST v10 changes.** Verified by pulling both immutable
versions straight from the Apps Script API and diffing them, line endings normalized:

| File | v39 vs v40 |
|---|---|
| `Code.js` | **identical** |
| `Maintenance.js` | **identical** |
| `index.html` | **identical** |
| `appsscript.json` | differs only in JSON key order and a trailing newline |

`computeRewardsForSession_` — the whole point of the v10 candidate — appears
**0 times** in v40 and 0 times in the current script HEAD. It appears 4 times in
`main`. So v40 is v39 with a new label and no behavioural change whatsoever.

Sanity check on the method: `pull --versionNumber` is honoured, because v39 and
v40 come back with different `appsscript.json`. It is not silently returning HEAD.

**Root cause.** The line below — "`clasp push` reported `Skipping push`,
confirming Production script HEAD already matched the local TEST v10 source" — is
the error everything else rests on. `Skipping push` does not mean the sources
matched; it means nothing was pushed. The v10 source never reached the Apps Script
project, so version 40 was cut from an unchanged HEAD.

**Why the post-deploy verification did not catch it.** Every check performed was a
runtime-health check: page loads, console errors, HTTP status, responsive layout.
v40 is byte-identical to v39, and v39 was already healthy, so all of them passed
and would have passed regardless. None of them compares shipped code against the
tested source.

**Actual impact.**
- Students: nothing changed, nothing broke. Production is fine on v40.
- The bug v10 was meant to fix is still live: Free Navigation Preview still shows
  optional steps as locked, so a teacher cannot preview their rewards.
- The deployment description advertises "Free Preview reward gating", which is not
  in the deployed code. That is the part worth fixing quickly — the deployment
  description is this project's only release log.

**Missing gate, worth adding permanently.** There was no step comparing the script
HEAD against the approved RC snapshot *before* cutting the immutable version. That
one diff would have caught this immediately.

**To actually ship v10:** `clasp push --force` (plain `push` skips, because the
manifest differs), then diff HEAD against `.lesson-xy-rc-v10-20260830/` across all
four files, then cut version 41, then point the existing deployment at 41. Do not
reuse v40 — it is not the intended source.

---

## Completed before live promotion

- TEST v10 final GOLD gate: PASS.
- Responsive 375 px: PASS; no unintended horizontal overflow.
- Console/network regression: PASS; no app console errors, runtime exceptions, HTTP errors, or loading failures.
- TEST student data integrity: PASS; T001/T002 learning values remained unchanged.
- `feat/free-preview-reward-gating` regression: PASS — 11/11.
- Candidate branch pushed to `origin/feat/free-preview-reward-gating`.
- Candidate merged into `main` with merge commit `f90af38`.
- Merged `main` regression: PASS — 11/11.
- `main` pushed to `origin/main`.
- Four release files checked against TEST v10 proof. `Maintenance.gs`, `index.html`, and `appsscript.json` match by raw SHA-256. `Code.gs` is byte-different only because of CRLF/LF; normalized content is identical to TEST v10 proof.
- Production Apps Script target verified: existing Production deployment ID is `AKfycbw1QpbSIP-DnOc3WI_XuHBQiIiyAHi1l89iasHEwY66SP-nF7324KwOdXWKsqK9dPsnLQ`.
- ~~`clasp push` reported `Skipping push`, confirming Production script HEAD already matched the local TEST v10 source.~~
  **WRONG.** `Skipping push` meant nothing was pushed. Script HEAD did not match, and still does not.
- ~~Immutable Production version 40 created successfully with the TEST v10 GOLD source.~~
  **WRONG.** Version 40 was created, but from the unchanged v39 HEAD, not from the TEST v10 source.

## Historical execution blocker — resolved

Earlier attempts to update the live pointer through local CLI execution channels were blocked before execution by the platform safety layer. Production therefore remained safely on v39 during those attempts and no partial deployment occurred.

On continuation, the same authorized release was completed through the normal Google Apps Script **Manage deployments** UI. No hidden API, obfuscated command, or new deployment was used.

## Live promotion result

- Manage deployments showed the existing live Production deployment on **Version 39** before mutation.
- Edit mode selected **Version 40 — 2 Sep 2026 11:38**.
- `Execute as` remained the owner account.
- `Who has access` remained **Everyone**.
- Apps Script returned **“อัปเดตการทำให้ใช้งานได้เรียบร้อยแล้ว”**.
- Deployment ID remained unchanged.
- `clasp deployments` read-back confirms the existing Production deployment now points to **@40**.

## Post-deploy verification

- Public Production `/exec`: PASS.
- Actual Tilt Lab `userHtmlFrame`: `readyState=complete`, expected title and login UI rendered.
- Fresh console/network event capture during reload:
  - console errors: 0
  - runtime exceptions: 0
  - log errors: 0
  - HTTP >=400: 0
  - loading failures: 0
  - Google wrapper sandbox warnings: 4, non-app warnings
- Responsive Production at 375 × 812: PASS.
- Wrapper horizontal overflow: false.
- Actual app horizontal overflow: false.
- Visible interactive controls outside viewport: 0.
- Browser restored to desktop 1920 × 1040; desktop horizontal overflow: false.
- Post-deploy Production smoke was no-write; no student progress, quiz, reset, credential, or Preview mutation was performed.

## Final truth

- Commit: **YES**
- Merge: **YES**
- Feature branch push: **YES**
- Main push: **YES**
- Production source HEAD at TEST v10 GOLD source: ~~YES~~ → **NO** (verified by diff)
- Immutable Production v40 created: **YES** — but from the v39 HEAD, not the v10 source
- Production mutation: **YES**
- Live Production deployment pointer updated to v40: **YES**
- Post-deploy smoke/regression: **PASS** — runtime health only; did not compare shipped code to the tested source
- Final Production GOLD: ~~PASS / CLOSED~~ → **NOT CLOSED.** The release shipped no code change.

## Remaining action

~~NONE for this release.~~

1. `clasp push --force` — plain `push` skips because the manifest differs.
2. Diff script HEAD against `.lesson-xy-rc-v10-20260830/` across all four files. Do not cut a version until this passes.
3. `create-version` → 41.
4. `update-deployment -V 41` against the existing Production deployment ID. Never `create-deployment`.
5. Re-run the post-deploy smoke, and this time also confirm `computeRewardsForSession_` is present in the deployed version.

Git-history remediation for historical credential evidence remains a separate destructive maintenance scope and does not block this.

## Rollback boundary

If rollback is ever required, update the same existing Production deployment ID back to immutable **v39**. No rollback is indicated by the current post-deploy evidence.

See final report: `docs/FINAL_PRODUCTION_GOLD_REPORT_20260902.md`.
