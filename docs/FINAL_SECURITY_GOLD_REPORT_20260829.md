# FINAL SECURITY GOLD REPORT — Tilt Lab ม.1

**Project:** MICRO:BIT ม.1 — ระบบตรวจจับความเอียง / Tilt Lab  
**Date:** 29 ส.ค. 2569  
**Scope:** Security-Only Production credential rotation + session revocation + post-rotation verification  
**Final status:** **PRODUCTION SECURITY GOLD — PASS**

## 1. Executive Closeout

เหตุการณ์ credential ที่พบในเอกสาร Git-tracked ได้รับการปิดในฝั่ง Production runtime แล้ว โดยดำเนินการตามลำดับที่อนุมัติแยก Gate:

1. ลบหลักฐานค่ารหัสออกจาก working-tree `docs/DEVIATIONS.md` โดยไม่แสดงค่ารหัส
2. สร้าง Security-Only Rotation RC จาก Production v37 โดยไม่รวม lesson X/Y candidate
3. isolated runtime regression ผ่าน 13/13
4. deploy เฉพาะ Security-Only RC ไปยัง Production deployment เดิมเป็น immutable **v38**
5. immediate post-deploy verification ผ่าน
6. หมุนเวียน student credentials ผ่าน hardened Admin path ครบ **7/7 บัญชี**
7. เพิ่ม student session epoch / revoke prior student sessions ครบ **7/7 บัญชี**
8. fresh student login ด้วยค่าชุดใหม่ที่ผู้ใช้กรอกเองผ่าน
9. ตรวจ data preservation, Admin session, Teacher Preview, browser credential hygiene และ Script Properties ผ่าน

**Production credential/session blocker: CLOSED**

## 2. Production Target

- Apps Script Production Script ID: `1uwEMv_WDkNUwYlRehWgkHa9DnqoPhHEFAKVLmnSnbDSsUBR4jjoOsvIe`
- Existing Production deployment ID: `AKfycbw1QpbSIP-DnOc3WI_XuHBQiIiyAHi1l89iasHEwY66SP-nF7324KwOdXWKsqK9dPsnLQ`
- Before security release: version 37
- Security-only release: **version 38**
- Deployment verification: existing deployment points to `@38`
- v38 read-back proof matched the Security-Only RC across all four deployable files: `Code.js`, `Maintenance.js`, `index.html`, `appsscript.json`

## 3. Security Release Scope

Security-only v38 contains the hardened credential-rotation and student-session-revocation path:

- server-side `admin` role guard
- strict rotation payload/scope validation
- explicit all-student confirmation
- Apps Script `LockService` protection
- fail-closed rotation marker
- verified password update per target
- student session epoch advancement
- prior student session invalidation
- unblock only after verified password + epoch state
- sanitized audit messages that do not include credential/hash/salt/token
- Admin rotation form with two password fields and explicit confirmation
- immediate client-side clearing of password fields after submission
- no credential persistence in browser storage

No current lesson X/Y candidate was included in the security-only Production v38 release.

## 4. Runtime Regression Before Production

Exact Security-Only RC was tested in an isolated runtime harness before Production deployment.

**Result: 13/13 PASS**

Coverage included:

- Admin login/auth path
- Admin role guard
- invalid/malformed rotation requests
- valid rotation path
- fail-closed partial failure behavior
- session epoch advancement
- old student-session rejection
- fresh student-session creation
- Admin session unaffected
- progress mutation revalidation
- quiz mutation revalidation
- Teacher Preview isolation
- audit hygiene
- credential-rotation UI contract/client compile

## 5. Production Rotation Result

Admin Dashboard baseline before rotation:

- student accounts: **7**
- quiz started: **0**
- passed 5/6: **0**
- students requiring follow-up: **0**

Rotation result shown by Production v38 Admin UI:

- credentials rotated: **7 accounts**
- prior student sessions revoked: **7 accounts**
- password inputs cleared after rotation: PASS
- all-account confirmation reset after rotation: PASS
- Admin session remained valid: PASS

No credential value was copied into chat, source files, documentation, terminal output, screenshot notes, audit summary, or this report.

## 6. Data Preservation Proof

Student summary before and after rotation remained identical:

| User | Section | Latest | Best | Attempts |
|---|---:|---:|---:|---:|
| `std001` | 5/9 | 0/6 | 0/6 | 0 |
| `std002` | 4/9 | 0/6 | 0/6 | 0 |
| `std003` | 1/9 | 0/6 | 0/6 | 0 |
| `std004` | 5/9 | 0/6 | 0/6 | 0 |
| `std005` | 1/9 | 0/6 | 0/6 | 0 |
| `std006` | 4/9 | 0/6 | 0/6 | 0 |
| `std007` | 4/9 | 0/6 | 0/6 | 0 |

Fresh login proof for `std001` after rotation:

- fresh login with the new credential entered directly by the user: PASS
- restored progress: **5/9**
- next step: Section 6 · Debug Case Study
- XP: **50**
- Badge: **2**
- Quiz: latest 0/6, best 0/6, attempts 0/3
- worksheet/lab state remained at the pre-existing state; no rotation-induced reset or deletion was observed

## 7. Teacher Preview / Admin Regression

- Admin Dashboard remained available after rotation: PASS
- all seven student rows remained intact: PASS
- Teacher Preview entered successfully as synthetic `__preview__`: PASS
- Teacher Preview started with independent 0/9 state: PASS
- Preview UI states that preview data is not written to student sheets: PASS
- no student record changed during Preview verification: PASS

## 8. Browser Credential Hygiene

Post-rotation browser inspection:

- Admin password-rotation input fields: empty after submission
- confirmation checkbox: reset
- Admin `localStorage`: no password/credential/secret key found
- Admin `sessionStorage`: no password/credential/secret key found
- Student `localStorage`: no password/credential/secret key found
- Student `sessionStorage`: no password/credential/secret key found

## 9. Script Properties Hygiene

Production Apps Script Project Settings were inspected by property **name only**; property values were not read or recorded.

Result:

- `INITIAL_STUDENT_PASSWORD`: **ABSENT**
- `INITIAL_ADMIN_PASSWORD`: **ABSENT**
- `RESET_STUDENT_PASSWORD`: **ABSENT**
- `RESET_STUDENT_USERNAMES`: **ABSENT**
- `RESET_STUDENT_MUST_CHANGE`: **ABSENT**
- expected application/storage/session-epoch properties remain present

**Script Properties credential hygiene: PASS**

## 10. Git / Repository State

- branch: `main`
- Git HEAD at closeout: `dc6597c960001368b1fb972c775dc2595771a746`
- commit performed in this security closeout: **NO**
- push performed: **NO**
- merge performed: **NO**
- Git history rewrite performed: **NO**
- lesson X/Y source candidate intentionally remains separate from the Production v38 security release

The working-tree copy of `docs/DEVIATIONS.md` no longer contains the historical credential value. The current Git HEAD/history can still retain historical evidence until a separately authorized repository-history remediation is performed. That residual repository-history risk is tracked separately and does **not** keep the Production credential/session blocker open because the affected Production credentials have been rotated and previous sessions revoked.

Never print or review the historical secret through an unredacted diff.

## 11. Final Gate Matrix

| Gate | Result |
|---|---|
| Security-only RC scope | PASS |
| Isolated runtime regression | PASS — 13/13 |
| Production deploy to existing deployment | PASS — v38 |
| Immediate post-deploy verification | PASS |
| Admin role guard | PASS |
| Credential rotation | PASS — 7/7 |
| Student session revocation | PASS — 7/7 |
| Fresh student login | PASS |
| Progress preservation | PASS |
| Score preservation | PASS |
| Quiz preservation | PASS |
| Worksheet/lab preservation | PASS |
| Admin regression | PASS |
| Teacher Preview regression | PASS |
| Browser credential persistence | PASS |
| Script Properties credential hygiene | PASS |
| No lesson X/Y deployment | PASS |
| No commit/push/history rewrite | PASS |

## 12. GOLD Decision

**FINAL SECURITY CLOSEOUT: PASS**  
**PRODUCTION SECURITY GOLD: CERTIFIED**  
**PRODUCTION CREDENTIAL/SESSION BLOCKER: CLOSED**  
**SECURITY-ONLY PRODUCTION VERSION: v38**

Security incident remediation in the running Production environment is complete. Any future work on lesson X/Y, commit/push, release-history normalization, or destructive Git-history remediation must be treated as a separate scope and must not alter this Security GOLD evidence without a new explicit authorization.
