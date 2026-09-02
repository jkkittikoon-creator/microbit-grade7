# DEV CONTINUATION — MICRO:BIT ม.1 ระบบตรวจจับความเอียง

## Project Identity
- PROJECT: MICRO:BIT ม.1 — ระบบตรวจจับความเอียง / Tilt Lab
- PROJECT ROOT: `D:\2569 เทอม 1\ChatGPT\ไมโครบิต ม.1` (ย้ายมาจาก `C:\Users\kitti\Documents\ChatGPT\ไมโครบิต ม.1` ซึ่งเลิกใช้แล้ว)
- WORKSPACE ID: `04e0c785-b269-450b-afa9-9986d549097c`
- PRODUCTION SCRIPT ID: `1uwEMv_WDkNUwYlRehWgkHa9DnqoPhHEFAKVLmnSnbDSsUBR4jjoOsvIe`
- PRODUCTION DEPLOYMENT ID: `AKfycbw1QpbSIP-DnOc3WI_XuHBQiIiyAHi1l89iasHEwY66SP-nF7324KwOdXWKsqK9dPsnLQ`

## Current State
- CURRENT STATUS: **LESSON_XY_V10_FINAL_GATE_PARTIAL**
- CURRENT PHASE: Lesson X/Y v10 release validation; authenticated TEST browser matrix remains
- PRODUCTION VERSION: **v39 Lesson X/Y**
- TEST VERSION: **v10 candidate**
- CURRENT GOLD REPORT: `docs/FINAL_GOLD_REPORT_20260831.md`
- FINAL SECURITY REPORT: `docs/FINAL_SECURITY_GOLD_REPORT_20260829.md`
- PRODUCTION CREDENTIAL/SESSION BLOCKER: **CLOSED**
- USER ACTION REQUIRED FOR SECURITY CLOSEOUT: **NONE**

## Lesson X/Y v10 Final Gate Checkpoint — 31 Aug 2026
- Local release files match immutable RC v10 and TEST post-push proof by SHA-256 across `Code`, `Maintenance`, `index.html`, and `appsscript.json`.
- TEST deployment pointer: **@10**.
- Production deployment pointer: **@39**; no Production mutation was performed in this checkpoint.
- Current local/contract/security checks pass, including Free Preview reward session gating, quiz race/retry protection, X/Y evidence preservation, and the isolated 13-case security runtime harness.
- TEST v10 public page loads in Playwright and Chrome with zero console errors.
- The 375 px viewport has no unintended horizontal overflow.
- Authenticated Student/Admin/Teacher Preview browser regression is **not complete** because neither available browser session is logged in to Tilt Lab.
- Release decision: **PARTIAL — not authorized or ready to deploy until the authenticated TEST matrix passes.**

## Final Security Closeout Summary — 29 Aug 2026
1. Historical credential evidence was removed from the working-tree `docs/DEVIATIONS.md` without printing the value.
2. Security-Only RC was built from Production v37 without lesson X/Y candidate changes.
3. Exact RC isolated runtime regression passed **13/13**.
4. Existing Production deployment was updated to immutable **v38** using only the Security-Only RC.
5. Immediate post-deploy verification passed; v38 read-back matched the RC across all four deployable files.
6. Production Admin rotation path rotated **7/7 student accounts**.
7. Student session epochs advanced / prior student sessions revoked **7/7**.
8. Fresh login of `std001` using the new credential entered directly by the user passed.
9. `std001` restored **5/9**, **50 XP**, **2 Badge**, quiz **0/3 attempts** with scores **0/6**, and existing worksheet/lab state.
10. All seven student rows retained their pre-rotation Section/score/attempt values.
11. Admin session remained valid.
12. Teacher Preview regression passed with independent `__preview__` state and no student-data mutation.
13. Admin and Student browser storage contained no password/credential/secret keys.
14. Production Script Properties were inspected by property name only: no `INITIAL_STUDENT_PASSWORD`, `INITIAL_ADMIN_PASSWORD`, or legacy `RESET_STUDENT_*` property remained.
15. No commit, push, merge, or Git-history rewrite was performed.

## Security GOLD Gate Matrix
- Security-only scope: PASS
- No lesson X/Y in v38: PASS
- Isolated runtime regression: PASS — 13/13
- Production deployment pointer @38: PASS
- v38 source read-back == RC: PASS
- Admin role guard: PASS
- Rotation all-student confirmation: PASS
- Production rotation: PASS — 7/7
- Session revocation: PASS — 7/7
- Fresh student login: PASS
- Progress preservation: PASS
- Score preservation: PASS
- Quiz preservation: PASS
- Worksheet/lab preservation: PASS
- Admin regression: PASS
- Teacher Preview regression: PASS
- Browser credential persistence: PASS
- Script Properties credential hygiene: PASS
- Final Security Closeout: **PASS**
- Production Security GOLD: **CERTIFIED**

## Production Data Baseline Preserved
| User | Section | Latest | Best | Attempts |
|---|---:|---:|---:|---:|
| `std001` | 5/9 | 0/6 | 0/6 | 0 |
| `std002` | 4/9 | 0/6 | 0/6 | 0 |
| `std003` | 1/9 | 0/6 | 0/6 | 0 |
| `std004` | 5/9 | 0/6 | 0/6 | 0 |
| `std005` | 1/9 | 0/6 | 0/6 | 0 |
| `std006` | 4/9 | 0/6 | 0/6 | 0 |
| `std007` | 4/9 | 0/6 | 0/6 | 0 |

## Repository / Git State
_(updated 2 ก.ย. 2569 — งานที่เคยค้างใน working tree ถูก commit แล้ว)_

- BRANCH: `main` และ `feat/free-preview-reward-gating`
- `main` HEAD: `d8f67ed` — สถานะเดียวกับ Production v39 (`index.html` และ `Maintenance.gs` ตรงกับ live แบบ byte-identical หลัง normalize CRLF/LF) พร้อมเอกสารปิดเหตุการณ์ credential
- `feat/free-preview-reward-gating` HEAD: `9e184a9` — TEST v10 candidate (`Code.gs` + `tests/preview-reward-gate.test.mjs`) ยังไม่ deploy
- Security closeout commit: YES (`d8f67ed`) — เอกสารที่ commit ไม่มีค่ารหัสผ่านจริงแล้ว
- Push: NO — ยังไม่ได้ push ทั้งสอง branch ขึ้น GitHub
- Merge: NO — ยังไม่ merge branch เข้า `main`
- Git history rewrite: NO
- Do not display an unredacted diff of historical credential evidence.

เหตุผลที่แยกเป็นสอง commit: `Code.gs` ในเครื่องใหม่กว่า Production v39 อยู่หนึ่งฟีเจอร์
ถ้า commit รวมกับ `main` จะทำให้ `main` ไม่ตรงกับของที่นักเรียนใช้จริง ซึ่งผิดกฎ
"main = origin/main = live" จึงกัน candidate ไว้บน branch จนกว่าจะผ่าน TEST matrix

Working tree สะอาดแล้ว แต่ไฟล์ทุกไฟล์ยังอยู่ครบบนดิสก์ ไม่มีอะไรถูกลบ
proof artifacts (~99 MB) ถูกกันด้วย `.gitignore` ไม่ใช่ถูกลบ

ไฟล์ที่ commit ลง `main` (`d8f67ed`):
- `AGENTS.md` — security blocker wording updated to CLOSED
- `docs/DEVIATIONS.md` — historical secret removed and Production rotation closeout recorded
- `docs/GAP_ANALYSIS.md` — ทำเครื่องหมายว่าเป็น backlog ย้อนหลัง ไม่ใช่สถานะปัจจุบัน
- `index.html` — Lesson X/Y UI; exact match with Production v39
- `DEV_CONTINUATION.md`, `docs/CREDENTIAL_ROTATION_PLAN.md`, `docs/FINAL_GOLD_REPORT_20260831.md`, `docs/FINAL_SECURITY_GOLD_REPORT_20260829.md`
- `.gitignore` (ใหม่), `.claspignore` (ใหม่)

ไฟล์ที่ commit ลง branch (`99cfa1c`, `9e184a9`):
- `Code.gs` — TEST v10 candidate; newer than Production v39 server source
- `tests/preview-reward-gate.test.mjs` — static regression 11/11 ผ่าน

`.claspignore` เพิ่งถูกสร้างครั้งแรก ก่อนหน้านี้ repo ไม่มีเลย
แปลว่า `clasp push` ที่ผ่านมาไม่มีตัวกันไฟล์นอก 4 ไฟล์ release

Artifact directories ที่ยังอยู่บนดิสก์แต่ถูก `.gitignore` แล้ว:
`.codex-preflight-*/`, `.lesson-xy-*/`, `.prod-security-rotation-*/`, `.playwright-cli/`

## Lesson X/Y Work — Current Release Scope
Lesson X/Y was released to Production v39 after the security-only v38 closeout. The working tree now contains the newer TEST v10 server candidate. Do not deploy, merge, commit, or discard it without the corresponding explicit gate.

Previously validated TEST evidence for X/Y includes:
- X/Y lesson route/content candidate
- independent X/Y simulator
- `worksheet.tiltSimulator.accelY` save/restore
- Teacher Preview save/reset/isolation
- authenticated Student save→reload/resume
- desktop and 375 px affected-path checks

Production v39 contains the Lesson X/Y frontend and v9 server source. TEST v10 contains the later server-side Free Preview reward, X/Y evidence, and quiz race/retry corrections.

## Residual Repository Risk
The old credential evidence may still exist in current Git HEAD/history even though the working-tree document is sanitized and the affected Production credential has been rotated.

Decision at this checkpoint:
- Production runtime security blocker: CLOSED
- Historical credential: treat as compromised forever; never reuse
- Commit/push: deferred; requires separate authorization
- Git history rewrite: deferred; destructive and requires explicit authorization with branch/remote/clone coordination
- This residual repository-history item is **not** an active Production credential/session blocker after successful rotation and session revocation.

## Files That Define Security Closeout
- `AGENTS.md`
- `docs/DEVIATIONS.md`
- `docs/CREDENTIAL_ROTATION_PLAN.md`
- `docs/FINAL_SECURITY_GOLD_REPORT_20260829.md`
- `.prod-security-rotation-rc-20260829/`
- `.prod-security-rotation-tests-20260829/runtime_regression_test.js`
- `.prod-security-rotation-v38-proof-20260829/`

## NEXT EXACT ACTION
_(ปรับ 2 ก.ย. 2569 — ข้อ commit เดิมทำเสร็จแล้ว จึงตัดออกและเลื่อนข้ออื่นขึ้น)_

1. **Push ขึ้น GitHub** — commit เสร็จแล้วแต่ยังไม่ได้ push เพราะถูก permission classifier บล็อก

       git push origin main
       git push -u origin feat/free-preview-reward-gating

2. **TEST v10 authenticated matrix** — ผู้ใช้ต้อง login เองด้วยบัญชี TEST ห้ามพิมพ์รหัสในแชต
   ครอบคลุม Student, Admin, Teacher Preview ทั้ง normal และ free, Hook 1/9,
   Preview reset/isolation, simulator X/Y, quiz retry/race, game/reward, desktop, 375 px
3. ถ้าผ่านครบ ให้รายงาน `READY FOR USER REVIEW / NOT DEPLOYED`
4. **Production deployment ของ v10** ต้องมีคำสั่งที่ระบุคำว่า Production แยกอีกครั้ง
   และต้อง `update-deployment` ทับ deployment ID เดิมเท่านั้น ห้าม `create-deployment`
5. **Git-history remediation** ยังเป็นงานทำลายล้าง ต้องขออนุมัติแยก
6. ~~ตรวจ deployment `@HEAD`~~ **ตรวจแล้ว 2 ก.ย. 2569 — ปิดเรื่องนี้ ไม่ต้องทำอะไร**

   `AKfycbzh5YL7rgXdbSVzKsC-4SeIfwZi9T0NnuPrKVyPS-LX` คือ HEAD deployment
   ที่ Apps Script สร้างให้เองทุกโปรเจกต์ ไม่ใช่ของที่ใครลืมลบ

   **แก้ความเข้าใจผิดที่เคยเขียนไว้ในข้อนี้:** เคยระบุว่า URL แบบ `@HEAD`
   เป็นช่องให้โค้ดที่ยังไม่ทดสอบหลุดสู่สาธารณะ — **ไม่จริง** ทดสอบแล้วด้วย
   curl แบบไม่ล็อกอิน ทั้ง `/exec` และ `/dev` ของ `@HEAD` เด้งไปหน้า
   Google sign-in ทั้งคู่ เข้าถึงได้เฉพาะบัญชีที่มีสิทธิ์แก้ไขสคริปต์เท่านั้น
   ต่างจาก Production ที่เปิดให้เข้าแบบไม่ต้องล็อกอินจริง (ตอบ 200 พร้อม
   `<title>Tilt Lab — ระบบตรวจจับความเอียงกับ micro:bit</title>`)

   ข้อสังเกต: `appsscript.json` ตั้ง `access: ANYONE_ANONYMOUS` ก็จริง
   แต่ค่านั้นไม่มีผลกับ HEAD/dev deployment ซึ่งบังคับสิทธิ์ผู้แก้ไขเสมอ

   Apps Script ไม่อนุญาตให้ลบ HEAD deployment อยู่แล้ว และไม่ได้ทดลองลบ
   เพราะไม่มีเหตุผลด้านความปลอดภัยให้ต้องลบ

## Continuation Safety
- Never record or reproduce credentials, password hashes, salts, or session tokens.
- Never use the historical credential again.
- Do not show unredacted Git history/diff containing the historical value.
- Preserve hardened Admin rotation + session-epoch behavior and Production v39 controls in future releases.
- Do not alter Production data without explicit authority.
- Do not commit, push, merge, rewrite history, or deploy unless explicitly authorized for that exact action.
- Do not fold lesson X/Y changes into a security-only release without a new scope decision.

## Scheduled Continuation
- SCHEDULED CONTINUATION: NOT_CREATED
- REASON: Security work is complete and there is no blocked or pending security step requiring an automatic continuation loop.

## Final Checkpoint Statement
**SECURITY GOLD: CLOSED/PASS · LESSON X/Y v10 FINAL GATE: PARTIAL · PRODUCTION: v39 UNCHANGED**
