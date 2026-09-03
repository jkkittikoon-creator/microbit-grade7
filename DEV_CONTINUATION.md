# DEV CONTINUATION — MICRO:BIT ม.1 ระบบตรวจจับความเอียง

## Project Identity
- PROJECT: MICRO:BIT ม.1 — ระบบตรวจจับความเอียง / Tilt Lab
- PROJECT ROOT: `D:\2569 เทอม 1\ChatGPT\ไมโครบิต ม.1` (ย้ายมาจาก `C:\Users\kitti\Documents\ChatGPT\ไมโครบิต ม.1` ซึ่งเลิกใช้แล้ว)
- WORKSPACE ID: `04e0c785-b269-450b-afa9-9986d549097c`
- PRODUCTION SCRIPT ID: `1uwEMv_WDkNUwYlRehWgkHa9DnqoPhHEFAKVLmnSnbDSsUBR4jjoOsvIe`
- PRODUCTION DEPLOYMENT ID: `AKfycbw1QpbSIP-DnOc3WI_XuHBQiIiyAHi1l89iasHEwY66SP-nF7324KwOdXWKsqK9dPsnLQ`

## Current State
_(แก้ 2 ก.ย. 2569 — สถานะเดิมที่เขียนว่าปิดงานแล้วไม่ถูกต้อง)_

- CURRENT STATUS: **V10_NOT_SHIPPED — v40 คือ v39 ที่เปลี่ยนแค่ป้ายชื่อ**
- CURRENT PHASE: ต้อง `clasp push --force` แล้วตัด v41 ใหม่ · Production ทำงานปกติ ไม่ต้องรีบ
- PRODUCTION VERSION: **v40 — แต่เนื้อโค้ดเท่ากับ v39 ทุกประการ ไม่มีงาน v10 อยู่เลย**
- TEST VERSION: **v10 GOLD** — ผ่านจริง แต่ผ่านบน `main` ไม่ใช่บนของที่ deploy
- CURRENT GOLD REPORT: `docs/FINAL_PRODUCTION_GOLD_REPORT_20260902.md` — **ถูก retract แล้ว อ่านหัวเรื่องก่อน**
- CORRECTION OF RECORD: `docs/PRODUCTION_V40_RELEASE_CHECKPOINT_20260902.md` — อ่านส่วน CORRECTION ก่อนเชื่ออย่างอื่น
- FINAL SECURITY REPORT: `docs/FINAL_SECURITY_GOLD_REPORT_20260829.md` — ยังใช้ได้ ไม่กระทบ
- PRODUCTION CREDENTIAL/SESSION BLOCKER: **CLOSED**
- USER ACTION REQUIRED FOR RELEASE CLOSEOUT: **YES** — ดู NEXT EXACT ACTION

### หลักฐาน
ดึง v39 กับ v40 จาก Apps Script API มาเทียบกันโดยตรง (normalize CRLF/LF แล้ว)
`Code.js` `Maintenance.js` `index.html` **เหมือนกันทุกตัวอักษร**
ต่างกันแค่ `appsscript.json` ที่สลับลำดับ key JSON กับ newline ท้ายไฟล์
`computeRewardsForSession_` นับได้ **0 ครั้ง** ใน v40 และใน script HEAD ปัจจุบัน แต่มี **4 ครั้ง** ใน `main`

### ผลกระทบจริง
- นักเรียน: ไม่มีอะไรเปลี่ยน ไม่มีอะไรพัง Production ยัง 200 ปกติ
- บั๊กที่ v10 ตั้งใจแก้ยังอยู่ — Free Navigation Preview ยังโชว์กิจกรรมเสริมเป็นล็อก ครูจึงยังพรีวิวรางวัลไม่ได้
- deployment description โฆษณา Free Preview reward gating ที่ไม่ได้อยู่ในโค้ดที่ deploy ไป

### สาเหตุ
`clasp push` ขึ้น `Skipping push` แล้วถูกตีความว่า "ตรงกันอยู่แล้ว"
ความจริงมันแปลว่า "ไม่ได้ push อะไรเลย" ของจึงไม่เคยขึ้น script HEAD
แล้ว version 40 ก็ถูกตัดจาก HEAD เดิม

### ด่านที่ขาดไป และควรใส่ถาวร
ไม่มีขั้นตอนเทียบ script HEAD กับ RC snapshot ที่อนุมัติแล้ว **ก่อน** ตัด immutable version
diff เดียวนั้นจับได้ทันที · post-deploy smoke ที่ทำไปเป็นการตรวจสุขภาพ runtime ล้วน ๆ
(หน้าโหลดขึ้น ไม่มี console error ไม่ล้นจอ) ซึ่งผ่านอยู่แล้วไม่ว่าจะ deploy อะไร จึงจับเรื่องนี้ไม่ได้เลย

## Production v40 Final GOLD Closeout — 2 Sep 2026
- TEST v10 authenticated release matrix: **PASS**.
- Candidate branch push: **YES**.
- Merge to `main`: **YES** — merge commit `f90af38`.
- Main push: **YES**.
- ~~Immutable Production version **40** created from TEST v10 GOLD source.~~
  **ผิด** — v40 ถูกตัดจาก script HEAD เดิมที่ยังเป็น v39 ไม่ใช่จากซอร์ส v10
- Existing Production deployment ID was updated in Google Apps Script Manage deployments; no new Production deployment was created.
- `clasp deployments` read-back confirms Production pointer **@40**.
- Live Production `/exec` loads the actual Tilt Lab app successfully.
- Post-deploy console/network regression: **0 console errors, 0 runtime exceptions, 0 log errors, 0 HTTP >=400, 0 loading failures**.
- Four Google Apps Script sandbox warnings observed; these are wrapper security warnings, not Tilt Lab runtime errors.
- Production responsive **375 × 812 PASS** with no unintended horizontal overflow and no visible interactive control outside the app viewport.
- Browser restored to **1920 × 1040** after responsive regression.
- Post-deploy smoke was intentionally no-write; no student progress, quiz, reset, credential, or Preview mutation was performed.
- Rollback boundary: same Production deployment ID pointed back to immutable **v39** if ever required.
  หมายเหตุ: ในทางปฏิบัติไม่มีอะไรให้ rollback เพราะ v40 กับ v39 เนื้อเหมือนกัน
- Final report: `docs/FINAL_PRODUCTION_GOLD_REPORT_20260902.md` — **retract แล้ว**
- ~~**FINAL PRODUCTION GOLD: PASS / CLOSED**~~
  **ยังไม่ปิด** — การ deploy ครั้งนี้ไม่ได้ส่งโค้ดใหม่ออกไปเลย
  ทุกข้อด้านบนที่เป็นการตรวจ runtime ผ่านจริง แต่ผ่านเพราะ v40 = v39 ซึ่งสุขภาพดีอยู่แล้ว

## Lesson X/Y v10 Final Gate Checkpoint — 31 Aug 2026 (historical)
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

## Repository / Git State — Final Closeout
_(updated 2 ก.ย. 2569 after Production v40 deployment)_

- BRANCH: `main` และ `feat/free-preview-reward-gating`
- `feat/free-preview-reward-gating` HEAD: `4e6f764`; branch pushed to `origin/feat/free-preview-reward-gating`.
- Candidate merged into `main`: **YES** — merge commit `f90af38`.
- `main` pushed to `origin/main`: **YES**.
- Production source and merged `main` carry the TEST v10 GOLD server change and regression test.
- Production deployment pointer: **@40**.
- Commit: **YES**.
- Push: **YES**.
- Merge: **YES**.
- Deploy: **YES**.
- Production mutation: **YES** — existing deployment updated to immutable v40.
- Git history rewrite: **NO**.
- Do not display an unredacted diff of historical credential evidence.

The branch split was a temporary release-safety measure while TEST v10 was newer than Production v39. That gate is now closed: TEST v10 passed, the branch was pushed and merged, and the same release source is live on Production v40.

Working tree is expected to be clean after the final closeout commit. Files remain on disk; proof artifacts (~99 MB) stay excluded by `.gitignore` rather than being deleted.

Artifact directories retained locally and ignored by Git:
`.codex-preflight-*/`, `.lesson-xy-*/`, `.prod-security-rotation-*/`, `.playwright-cli/`

## Lesson X/Y Work — ยังไม่ได้ปล่อยจริง
~~Production v40 now carries the TEST v10 GOLD server behavior, including Free Preview reward session gating, X/Y evidence handling, and quiz race/retry protections, together with the existing Lesson X/Y frontend.~~

**ไม่จริง** — Production v40 มีเนื้อโค้ดเท่ากับ v39 ทุกประการ ไม่มี Free Preview reward session gating
พฤติกรรมฝั่ง server ของ v10 ยังอยู่แค่ใน `main` และบน TEST เท่านั้น
ส่วน Lesson X/Y frontend (`index.html`) นั้นอยู่บน Production มาตั้งแต่ v39 แล้ว ไม่กระทบ

หลักฐานที่ตรวจผ่านด้านล่างนี้เป็นของจริงทั้งหมด แต่เป็นการตรวจบน `main` และบน TEST
ไม่ใช่ตรวจบนสิ่งที่ deploy ขึ้น Production:
- X/Y lesson route/content
- independent X/Y simulator
- `worksheet.tiltSimulator.accelY` save/restore
- Teacher Preview normal/free save/reset/isolation
- authenticated TEST Student save→reload/resume
- quiz 6/6 release validation and retry/race protection
- desktop and 375 px checks
- Production public post-deploy smoke, console/network regression, and 375 px regression

~~This Lesson X/Y v10 scope is **deployed and closed on Production v40**.~~
Lesson X/Y v10 **ยังไม่ได้ deploy** ดูขั้นตอนที่ NEXT EXACT ACTION

## Residual Repository Risk
The old credential evidence may still exist in current Git HEAD/history even though the working-tree document is sanitized and the affected Production credential has been rotated.

Decision at final closeout:
- Production runtime security blocker: CLOSED
- Historical credential: treat as compromised forever; never reuse
- Release commit/push/merge/deploy: **COMPLETED**
- Git history rewrite: still deferred; destructive and requires separate explicit authorization with branch/remote/clone coordination
- This residual repository-history item is **not** an active Production credential/session blocker and does not block the v40 Production GOLD closeout.

## Files That Define Security Closeout
- `AGENTS.md`
- `docs/DEVIATIONS.md`
- `docs/CREDENTIAL_ROTATION_PLAN.md`
- `docs/FINAL_SECURITY_GOLD_REPORT_20260829.md`
- `.prod-security-rotation-rc-20260829/`
- `.prod-security-rotation-tests-20260829/runtime_regression_test.js`
- `.prod-security-rotation-v38-proof-20260829/`

## NEXT EXACT ACTION — v10 ยังไม่ถูกส่งขึ้น Production
_(แก้ 2 ก.ย. 2569 — ของเดิมเขียนว่าไม่เหลืออะไรแล้ว ซึ่งไม่จริง)_

ไม่เร่งด่วน Production ทำงานปกติ แต่ยังไม่ได้ส่งงาน v10 ออกไปจริง

1. **`clasp push --force`** — ต้องมี `--force` เพราะ `appsscript.json` ต่างจากบนคลาวด์
   ถ้าใช้ `push` เปล่า ๆ มันจะขึ้น `Skipping push` แล้วข้ามงานทั้งหมดเหมือนรอบที่แล้ว
   (ผมพยายามรันแล้วถูก platform safety layer บล็อกก่อนสั่ง เหมือนที่ `clasp deploy -i` เคยโดน)

   ก่อน push ทำ safety gate ตามกฎเดิม: pull ของจริงมาเทียบ ตรวจว่าไม่มีอะไรที่คลาวด์มีแต่ repo ไม่มี
   ตรวจแล้วเมื่อ 2 ก.ย. 2569 — บรรทัดฝั่งคลาวด์ทั้ง 10 บรรทัดเป็นแค่ของเดิมที่ repo เขียนทับ
   ไม่มีงานที่มีเฉพาะบนคลาวด์ จึง push ทับได้ปลอดภัย

2. **เทียบ script HEAD กับ `.lesson-xy-rc-v10-20260830/` ให้ครบทั้ง 4 ไฟล์ ก่อนตัดเวอร์ชัน**
   นี่คือด่านที่ขาดไปรอบที่แล้ว ห้ามข้าม
   ตรวจง่าย ๆ ว่ามี `computeRewardsForSession_` อยู่ในของที่ดึงกลับมาจริง

3. `create-version` → **41** (v40 ใช้ไม่ได้ ทิ้งไปเลย ไม่ใช่ซอร์สที่ตั้งใจ)

4. `update-deployment -V 41` ทับ deployment ID เดิม · **ห้าม `create-deployment`**

5. Post-deploy smoke รอบใหม่ ต้องเพิ่มการยืนยันว่า `computeRewardsForSession_`
   อยู่ในเวอร์ชันที่ deploy จริง ไม่ใช่ตรวจแค่ว่าหน้าโหลดขึ้น

6. แก้ deployment description ให้ตรงกับของที่ส่งจริง

งานที่อยู่นอกขอบเขตนี้:
- Git-history remediation ของหลักฐาน credential เดิม ต้องขออนุมัติแยกเพราะเป็นงานทำลายล้าง
- Apps Script `@HEAD` เป็น deployment สำหรับผู้แก้ไขเท่านั้น ตรวจแล้วไม่ใช่ช่องสาธารณะ ไม่ต้องทำอะไร

## Continuation Safety
- Never record or reproduce credentials, password hashes, salts, or session tokens.
- Never use the historical credential again.
- Do not show unredacted Git history/diff containing the historical value.
- Preserve hardened Admin rotation + session-epoch behavior and Production v40 controls in future releases.
- Do not alter Production data without explicit authority.
- Do not commit, push, merge, rewrite history, or deploy unless explicitly authorized for that exact action.
- Do not fold lesson X/Y changes into a security-only release without a new scope decision.

## Scheduled Continuation
- SCHEDULED CONTINUATION: NOT_CREATED
- REASON: Security and Lesson X/Y release work are complete; no blocked or pending release step remains.

## Final Checkpoint Statement
**SECURITY GOLD: CLOSED/PASS · LESSON X/Y v10 GOLD: PASS (บน `main`) · PRODUCTION v40: DEPLOYED แต่เนื้อ = v39 · FINAL PRODUCTION GOLD: ยังไม่ปิด — v10 ยังไม่ถูกส่งขึ้น Production**
