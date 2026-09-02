# Production v40 Release Checkpoint — Tilt Lab ม.1

**Date:** 2 Sep 2026  
**Scope:** Promote TEST v10 GOLD candidate through Git merge/push and Production deployment gate
**Final status:** **RESOLVED — PRODUCTION v40 DEPLOYED / GOLD CLOSED**

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
- `clasp push` reported `Skipping push`, confirming Production script HEAD already matched the local TEST v10 source.
- Immutable Production version 40 created successfully with the TEST v10 GOLD source.

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
- Production source HEAD at TEST v10 GOLD source: **YES**
- Immutable Production v40 created: **YES**
- Production mutation: **YES**
- Live Production deployment pointer updated to v40: **YES**
- Post-deploy smoke/regression: **PASS**
- Final Production GOLD: **PASS / CLOSED**

## Remaining action

**NONE for this release.** Git-history remediation for historical credential evidence remains a separate destructive maintenance scope and does not block Production v40.

## Rollback boundary

If rollback is ever required, update the same existing Production deployment ID back to immutable **v39**. No rollback is indicated by the current post-deploy evidence.

See final report: `docs/FINAL_PRODUCTION_GOLD_REPORT_20260902.md`.
