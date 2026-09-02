# FINAL PRODUCTION GOLD REPORT — Tilt Lab ม.1

**Date:** 2 Sep 2026
**Scope:** Lesson X/Y TEST v10 promotion to Production v40
**Decision:** **FINAL PRODUCTION GOLD — PASS / CLOSED**

## Executive closeout

- TEST v10 completed the required release matrix and was accepted as GOLD before Production promotion.
- Candidate branch was pushed, merged into `main`, regression-tested, and pushed to `origin/main`.
- Production immutable version **40** was created from the TEST v10 GOLD source.
- The **existing** Production deployment was updated in Google Apps Script Manage deployments; no new Production deployment was created.
- Production deployment ID remains unchanged: `AKfycbw1QpbSIP-DnOc3WI_XuHBQiIiyAHi1l89iasHEwY66SP-nF7324KwOdXWKsqK9dPsnLQ`.
- `clasp deployments` read-back confirms that deployment now points to **@40**.
- Rollback boundary is immutable Production **v39** using the same deployment ID.

## TEST v10 release evidence carried into Production

| Gate | Result |
|---|---|
| Admin Dashboard | PASS |
| Teacher Preview — Normal | PASS |
| Teacher Preview — Free Navigation | PASS |
| Preview isolation from TEST student state | PASS |
| X/Y + map/constrain learning path | PASS |
| Quiz | PASS — 6/6 |
| TEST student data integrity | PASS |
| Responsive 375 px | PASS |
| Console regression | PASS |
| Network regression | PASS |
| Free Preview reward-gate static regression | PASS — 11/11 |

## Production deployment proof

- Apps Script Manage deployments showed the live deployment on **Version 39** before mutation.
- Version selector was changed to **Version 40 — 2 Sep 2026 11:38**.
- `Execute as` remained the owner account and `Who has access` remained **Everyone**.
- Deployment description was updated to identify the v40 TEST v10 GOLD release.
- Apps Script returned **“อัปเดตการทำให้ใช้งานได้เรียบร้อยแล้ว”** and showed the unchanged deployment ID with Version 40.
- CLI read-back after deployment returned the same Production deployment ID at **@40**.

## Post-deploy Production smoke

### Public application load

- Production `/exec` loads successfully.
- The actual `userHtmlFrame`, not only the Google Apps Script wrapper, reaches `readyState=complete`.
- Title: `Tilt Lab — ระบบตรวจจับความเอียงกับ micro:bit`.
- Public login screen renders the expected Tilt Lab learning overview, Student/Admin role choices, username/password fields, and login action.

### Console and network regression

A fresh CDP event stream was captured during a Production reload across the wrapper and Google Apps Script iframe targets.

- Console errors: **0**
- Runtime exceptions: **0**
- Log errors: **0**
- HTTP responses >= 400: **0**
- Network loading failures: **0**
- Google Apps Script sandbox security warnings: **4** — wrapper warnings only, not Tilt Lab runtime errors.

### Responsive 375 px

Production was reloaded at **375 × 812**.

Wrapper:
- `innerWidth=375`
- `clientWidth=375`
- `scrollWidth=375`
- horizontal overflow: **false**
- sandbox iframe width: **375**

Actual Tilt Lab app frame:
- `innerWidth=375`
- `clientWidth=360`
- `scrollWidth=360`
- horizontal overflow: **false**
- visible interactive controls outside viewport: **0**

Browser metrics were restored to **1920 × 1040** after the mobile regression; final desktop horizontal overflow remained **false**.

## Data-safety statement

- The Production post-deploy smoke was intentionally **no-write**: no student login, quiz submission, progress save, reset, credential rotation, or Preview mutation was performed during the live verification.
- No Production student record was intentionally modified by this closeout.
- The previously certified Production credential/session security controls and preserved student-data baseline remain the reference state.
- Historical credential evidence in Git history remains a separate repository-remediation item; it is not an active Production credential or session blocker.

## Git closeout

- Candidate branch push: **YES**
- Merge to `main`: **YES** — merge commit `f90af38`
- `main` push: **YES**
- Working tree before final documentation closeout: **CLEAN**
- Source regression after merge: **11/11 PASS**
- No Git history rewrite was performed.

## Final gate

**TEST v10 GOLD: PASS**
**PRODUCTION v40: DEPLOYED**
**POST-DEPLOY SMOKE: PASS**
**SECURITY GOLD: RETAINED**
**FINAL PRODUCTION GOLD: PASS / CLOSED**
