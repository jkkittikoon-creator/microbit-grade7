# DEV CONTINUATION — MICRO:BIT ม.1 ระบบตรวจจับความเอียง

## Project Identity
- PROJECT: MICRO:BIT ม.1 — ระบบตรวจจับความเอียง / Tilt Lab
- PROJECT ROOT: `D:\2569 เทอม 1\ChatGPT\ไมโครบิต ม.1` (ย้ายมาจาก `C:\Users\kitti\Documents\ChatGPT\ไมโครบิต ม.1` ซึ่งเลิกใช้แล้ว)
- WORKSPACE ID: `04e0c785-b269-450b-afa9-9986d549097c`
- PRODUCTION SCRIPT ID: `1uwEMv_WDkNUwYlRehWgkHa9DnqoPhHEFAKVLmnSnbDSsUBR4jjoOsvIe`
- PRODUCTION DEPLOYMENT ID: `AKfycbw1QpbSIP-DnOc3WI_XuHBQiIiyAHi1l89iasHEwY66SP-nF7324KwOdXWKsqK9dPsnLQ`

## Current State
_(แก้ 20 ก.ย. 2569)_

- CURRENT STATUS: **V11_SHIPPED — Production ชี้ @42 ตรงกับ `main` ทุกไฟล์**
- CURRENT PHASE: ปล่อย v42 ขึ้น Production แล้ว · การสำรองรายคืนถูกปิดตามคำสั่งครู 25 ก.ย. 2569 (D-004) · ยังรอครูตรวจการใช้งานแบบล็อกอิน
- TEST: **@11** ทดสอบผ่านแล้ว · ซอร์สเดียวกันอยู่บน Production v42 แล้ว

## การสำรองข้อมูลรายคืน — ครูสั่งปิด (25 ก.ย. 2569)

**ครูสั่งปิด trigger สำรองข้อมูลรายคืน** บันทึกเป็น D-004 ใน `docs/DEVIATIONS.md`
ถ้าเจอว่าไม่มีไฟล์สำรองใหม่ **นี่คือสิ่งที่ตั้งใจ ไม่ใช่บั๊ก** ห้ามเปิดกลับเองโดยไม่ถาม

**ก่อนปิด ยืนยันแล้วว่า v42 ไม่ได้ทำให้ระบบสำรองพัง** — มีไฟล์สำรองครบทุกคืน
21, 22, 23, 24 และ 25 ก.ย. เวลา 01:01 ตามปกติ แปลว่าเงื่อนไข `backedUpRecently_()`
ช่วงห่างขั้นต่ำ 6 ชั่วโมงที่เพิ่มใน v42 ไม่ได้ขวาง trigger รายคืน
คำถามที่ค้างไว้ตอน deploy v42 จึงปิดได้ด้วยหลักฐานจริง

ไฟล์สำรองเดิม 5 ไฟล์ยังอยู่ · เปิดกลับได้จากปุ่มในหน้าครู ไม่ต้องแก้โค้ดหรือ deploy ใหม่

## Production v42 — Editor-only guard + Mastery + Pre-test (20 ก.ย. 2569)

| รายการ | ค่า |
|---|---|
| Deployment pointer | **@42** · deployment ID เดิม URL นักเรียนไม่เปลี่ยน |
| Description | `Tilt Lab m1 Production v42 - editor-only guard + mastery per objective + pre-test/adaptive path - TEST v11 regression passed` |
| ซอร์ส | `main` @ `4bca302` |

**ทำตามลำดับด่านครบ ไม่ข้ามขั้นไหน:**
1. ดึง Production HEAD มาเทียบก่อน push — บรรทัดที่มีเฉพาะฝั่งคลาวด์ 16 บรรทัด ตรวจแล้วเป็นรูปเดิมของโค้ดที่เราตั้งใจแก้ ไม่ใช่งานที่ครูแก้บนคลาวด์
2. จด marker ไว้ก่อน push แล้ว `push --force`
3. ดึงกลับมาเทียบ — ทั้ง 4 ไฟล์ landed · marker ตรงทุกตัว
4. `create-version` → 42 · ดึง v42 กลับมาเทียบกับ `main` ตรงทุกไฟล์
5. `update-deployment -V 42` ทับ deployment ID เดิม · อ่านกลับยืนยัน **@42**
6. หน้า `/exec` โหลดสำเร็จ title ถูก iframe ขึ้นปกติ ไม่มี console error

**Marker บน v42:** `requireEditorContext_` 5 · `computeMastery_` 8 · `normalizePretestState_` 2 · `computeRewardsForSession_` 4

**ยังต้องให้ครูตรวจ** (agent กรอกรหัสผ่านและอ่านใน iframe ข้ามโดเมนไม่ได้):
- ล็อกอินเป็นนักเรียนจริง ดูว่าการ์ด Pre-test ขึ้นก่อน Section 1 และนักเรียนที่เรียนค้างไว้ยังอยู่ Section เดิม
- เช้าวันถัดไป ตรวจว่ามีไฟล์สำรองใหม่ในโฟลเดอร์ ยืนยันว่า trigger กลางคืนยังทำงานหลังใส่ช่วงห่างขั้นต่ำ 6 ชั่วโมง
- เรียก `showSetupStatus` แบบไม่ล็อกอินบน Production ต้องถูกปฏิเสธ

**Rollback:** ชี้ deployment ID เดิมกลับไป **v41** ซึ่งเป็นซอร์ส v10 ที่ใช้งานได้จริง

## Production v41 — ปิดงาน v10 แล้ว (20 ก.ย. 2569)

| รายการ | ค่า |
|---|---|
| Deployment pointer | **@41** (deployment ID เดิม URL นักเรียนไม่เปลี่ยน) |
| Description | `Tilt Lab m1 Production v41 - TEST v10 GOLD source` |
| ซอร์ส | เท่ากับ RC v10 ทั้ง 4 ไฟล์ |

**หลักฐานหลัง deploy** — ดึงเวอร์ชันที่ใช้งานจริงกลับมาตรวจ ไม่ใช่ตรวจแค่ว่าหน้าเปิดได้:
- `Code.js` `Maintenance.js` `index.html` `appsscript.json` **ตรงกับ RC v10 ทุกไฟล์**
- `computeRewardsForSession_` นับได้ **4 ครั้ง** (ใน v40 นับได้ 0 — นี่คือความต่างที่พิสูจน์ว่ารอบนี้ส่งของจริง)
- `requireEditorContext_` นับได้ **0 ครั้ง** ยืนยันว่างานความปลอดภัยรอบใหม่ยัง**ไม่ได้**อยู่บน Production ตามที่ตั้งใจ
- หน้า `/exec` โหลดสำเร็จ title ถูกต้อง iframe ของแอปขึ้นปกติ ไม่มี console error

**ยังไม่ได้ทดสอบ:** การใช้งานแบบล็อกอินจริงบน Production (นักเรียน/ครู/Preview)
agent กรอกรหัสผ่านไม่ได้ และอ่านเนื้อหาใน iframe ข้ามโดเมนไม่ได้
แนะนำให้ครูล็อกอินเช็กสักรอบว่า Free Navigation Preview เปิดกิจกรรมเสริมให้พรีวิวได้แล้วจริง
ซึ่งคือบั๊กที่ v10 ตั้งใจแก้มาตั้งแต่ต้น

**Rollback:** ใช้ deployment ID เดิมชี้กลับไป v40 ได้ (แต่ v40 เนื้อเท่ากับ v39)

### สาเหตุที่คำสั่งล้มเหลวหลายรอบก่อนหน้า
ไม่ใช่เรื่อง clasp และไม่ใช่เรื่องสิทธิ์ Google เลย
PowerShell ตั้ง ExecutionPolicy ห้ามรันสคริปต์ `.ps1` ทั้งระบบ
คำสั่งจึงตายที่ `npx.ps1` ตั้งแต่ยังไม่ทันเรียก clasp และไม่มีอะไรถูกส่งไป Google

```
npx : File C:\Program Files\nodejs\npx.ps1 cannot be loaded because running scripts is disabled on this system.
```

**ทางแก้ที่ใช้ และควรใช้ต่อไป: เรียก `npx.cmd` แทน `npx`** ซึ่งข้ามตัวสคริปต์ `.ps1`
โดยไม่ต้องลดค่าความปลอดภัยของเครื่อง

```
npx.cmd @google/clasp@3 update-deployment -V <n> -d "<คำอธิบาย>" <deploymentId>
```

บทเรียน: ถ้ารันคำสั่งแล้ว pointer ไม่ขยับ ให้สงสัย shell ก่อนสงสัย clasp
และเก็บข้อความ error มาดูเสมอ อย่าเดาจากผลลัพธ์ปลายทางอย่างเดียว

### ความคืบหน้า 11–12 ก.ย. 2569
- script HEAD บนคลาวด์ถูกตรวจแล้วว่าตรงกับ `main` และ RC v10 ทั้ง 4 ไฟล์ จึง **ไม่ต้อง push ซ้ำ** งาน v10 ขึ้นคลาวด์ไปแล้ว
- **ตัดเวอร์ชัน 41 แล้ว** และดึงกลับมาเทียบยืนยันว่าเท่ากับ RC v10 ทุกไฟล์ `computeRewardsForSession_` นับได้ 4 ครั้ง
- ตรวจวิธีการซ้ำด้วยการดึง v40 มาเทียบ ได้ 0 ครั้ง ยืนยันว่า `pull --versionNumber` แยกเวอร์ชันได้จริง
- `update-deployment` ค้างอยู่หลายวัน สาเหตุจริงคือ PowerShell ExecutionPolicy ไม่ใช่ clasp · แก้ด้วย `npx.cmd` แล้วสำเร็จ 20 ก.ย. 2569
- พบและแก้ช่องโหว่ฟังก์ชันที่เรียกได้โดยไม่ต้องล็อกอิน ดูหัวข้อ Editor-Only Guard ด้านล่าง
- PRODUCTION VERSION: **v41 — ตรงกับ RC v10 ทุกไฟล์** (ของเดิม v40 เท่ากับ v39 จึงถูกทิ้งไป)
- TEST VERSION: **v10 GOLD** — ผ่านจริง แต่ผ่านบน `main` ไม่ใช่บนของที่ deploy
- CURRENT GOLD REPORT: `docs/FINAL_PRODUCTION_GOLD_REPORT_20260902.md` — **ถูก retract แล้ว อ่านหัวเรื่องก่อน**
- CORRECTION OF RECORD: `docs/PRODUCTION_V40_RELEASE_CHECKPOINT_20260902.md` — อ่านส่วน CORRECTION ก่อนเชื่ออย่างอื่น
- FINAL SECURITY REPORT: `docs/FINAL_SECURITY_GOLD_REPORT_20260829.md` — ยังใช้ได้ ไม่กระทบ
- PRODUCTION CREDENTIAL/SESSION BLOCKER: **CLOSED**
- USER ACTION REQUIRED FOR RELEASE CLOSEOUT: **NO** สำหรับ v10 · รอบ v11 รอคำสั่ง deploy จากครู

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

## TEST v11 — ทดสอบผ่านและ merge แล้ว (20 ก.ย. 2569)

**ครูยืนยันว่าทดสอบผ่านหมดทุกข้อ** และ merge เข้า `main` แล้วตามลำดับ
`fix/editor-only-guard` → `feat/mastery-objectives`
หลัง merge รันเทสต์ทั้ง 4 ชุดบน `main` ผ่านครบ 90 ข้อ และ syntax ทั้งเซิร์ฟเวอร์กับหน้าเว็บผ่าน
**ยังไม่ได้ deploy ขึ้น Production** ซึ่งยังชี้ @41 ตามเดิม

รายการทดสอบด้านล่างเก็บไว้เป็นแบบสำหรับรอบถัดไป

**TEST deployment `AKfycbxte4a1…T9eZnp3w` ชี้ @11 แล้ว** · Production ไม่เกี่ยว ยังเป็น @40

| รายการ | ค่า |
|---|---|
| TEST script ID | `1YrGEQzk2LMSvxfCKOI9l6TbbrXe9ZGrVvAKSEvmzDVG8zrySgfSuy4jE` |
| TEST deployment ID | `AKfycbxte4a1tsywbJmLEV64C3pLbdOY0aiabVSedSYWAsr467Whx883aZvvBeeXI_T9eZnp3w` |
| ซอร์ส | สาขา `feat/mastery-objectives` @ `4f030f5` (รวม `fix/editor-only-guard` แล้ว) |
| มีอะไรบ้าง | Editor-only guard · Mastery รายจุดประสงค์ · Pre-test + เส้นทางตัวช่วย + Growth |

**ตรวจแล้วก่อนและหลังส่ง:**
- ก่อน push ดึง TEST HEAD มาเทียบแล้ว ตรงกับ RC v10 ทุกไฟล์ ไม่มีงานที่อยู่บนคลาวด์อย่างเดียว
- หลัง push ดึงกลับมาเทียบ ทั้ง 3 ไฟล์ตรงกับสาขา และ marker นับได้ตามที่บันทึกไว้ก่อน push:
  `requireEditorContext_` 5 · `computeMastery_` 8 · `normalizePretestState_` 2
- ดึง version 11 ที่ตัดแล้วมาเทียบซ้ำ ตรงกับสาขาทุกไฟล์

**ที่ยังตรวจไม่ได้:** หน้าแอปอยู่ใน iframe ของ Google คนละโดเมน
เครื่องมือของ agent รัน JavaScript หรืออ่านเนื้อหาข้าม iframe ไม่ได้
และการทดสอบแบบล็อกอินต้องใช้รหัสผ่าน ซึ่ง agent ห้ามกรอก ส่วนนี้ครูต้องทำเอง

### รายการทดสอบสำหรับครู บน TEST URL

**ความปลอดภัย** — เปิดหน้าต่างไม่ระบุตัวตน (ไม่ล็อกอิน Google) เปิด TEST URL
กด F12 → Console → ที่ dropdown บริบทด้านบนเลือก `userCodeAppPanel` แล้ววาง:

```js
google.script.run
  .withSuccessHandler(() => console.log('ALLOWED — ด่านไม่ทำงาน ห้ามปล่อยขึ้น Production'))
  .withFailureHandler((e) => console.log('DENIED:', e.message))
  .showSetupStatus();
```

ต้องได้ `DENIED: ฟังก์ชันนี้เรียกได้จาก Apps Script editor เท่านั้น`
(ตัวที่สำเร็จจงใจไม่พิมพ์ข้อมูลออกมา กันรายชื่อนักเรียนหลุดลง Console)

1. [ ] ไม่ล็อกอิน เรียก `showSetupStatus` → **DENIED**
2. [ ] เปิดโปรเจกต์ TEST ใน Apps Script editor รัน `showSetupStatus` → **ทำงานได้** มีผลใน Execution log
3. [ ] ล็อกอินครู กดปุ่มเปิดการสำรองอัตโนมัติ → ยังทำงานได้
4. [ ] เช้าวันถัดไป มีสำเนาใหม่ในโฟลเดอร์สำรอง → trigger กลางคืนยังทำงาน

**Pre-test** — ใช้บัญชีทดสอบ
5. [ ] นักเรียนใหม่เห็นการ์ด "ลองเช็กพื้นฐาน" ก่อน Section 1
6. [ ] ตอบครบ 5 ข้อแล้วส่ง → เห็นผล แยกรายเรื่อง และเส้นทาง · **ไม่มีการเฉลยคำตอบ**
7. [ ] รีโหลดหน้า → การ์ดคำถามไม่กลับมา ผลยังอยู่ ทำซ้ำไม่ได้
8. [ ] อีกบัญชีกด "ข้าม" → เข้าเรียนได้ปกติ ไม่มีการ์ดผล
9. [ ] บัญชีที่เรียนค้างไว้ก่อนมี Pre-test → **อยู่ Section เดิม ความก้าวหน้าไม่หาย**

**Mastery**
10. [ ] ในแบบทดสอบ เลือกคำตอบแต่ **ยังไม่กดส่ง** → การ์ด Mastery **ต้องไม่โผล่** (บั๊กเครื่องเฉลยที่แก้ไปแล้ว)
11. [ ] กดส่ง → การ์ดโผล่ มีลิงก์ทบทวน Section เฉพาะเรื่องที่ยังไม่แน่น
12. [ ] บัญชีที่ทำ Pre-test แล้วทำแบบทดสอบ → เห็นบรรทัดพัฒนาการ

**ครู**
13. [ ] รายละเอียดนักเรียน → เห็นเส้นทางพร้อมเหตุผล เช่น `Pre-test 3/5 (60%)` · พัฒนาการ · Mastery
14. [ ] Teacher Preview ทั้ง normal และ free → ทำ Pre-test ได้ และไม่ไปเขียนทับข้อมูลนักเรียน

**อุปกรณ์**
15. [ ] มือถือ 375px ไม่มีอะไรล้นจอ · คอมพิวเตอร์ปกติ

ผ่านครบแล้วบอก agent ให้ merge สองสาขาเข้า `main` แล้วเตรียม release Production ตามขั้นตอนเดิม

## Editor-Only Guard — งานรอบ 12 ก.ย. 2569

สาขา `fix/editor-only-guard` · ยังไม่ merge เข้า `main` · **ขึ้น TEST แล้วใน v11** ดูหัวข้อ TEST v11

**ช่องโหว่:** เว็บแอป deploy แบบ `ANYONE_ANONYMOUS` ซึ่งทำให้ `google.script.run`
เรียกฟังก์ชันระดับบนสุดที่ชื่อไม่ลงท้ายด้วย `_` ได้ทุกตัว แม้ `index.html` จะไม่เคยเรียกก็ตาม
`showSetupStatus()` จึงส่งรายชื่อจริงของนักเรียนทั้ง 7 คน พร้อม username และ URL
ของสเปรดชีตกับโฟลเดอร์ Drive ให้ผู้เข้าชมที่ไม่ได้ล็อกอินได้ ขัดกับ Blueprint #184–185
ส่วน `setupDailyBackup()` และ `runScheduledBackup()` ถูกสั่งรัว ๆ จนพื้นที่ Drive เต็มได้

**สิ่งที่แก้:**
- เพิ่ม `requireEditorContext_()` ใน `Code.gs` เทียบ active user กับ effective user
  ผู้เข้าชมแบบไม่ล็อกอินได้อีเมลว่างจึงไม่ผ่าน · ไม่เขียน Audit ตอนปฏิเสธ เพราะจะทำให้ใครก็ถมชีต Audit ได้
- ใส่ด่านนี้ให้ `setupSystem`, `setupAdminAccount`, `setupDailyBackup`,
  `showSetupStatus`, `disablePasswordChangePrompt`
- แยกเนื้อในเป็น `installDailyBackup_()` เพื่อให้ปุ่มของครูใน `enableDailyBackup(token)`
  ซึ่งผ่าน role guard มาแล้ว ยังทำงานได้ตามปกติ
- `runScheduledBackup` **ห้ามเปลี่ยนชื่อ** เพราะ Trigger อ้างชื่อนี้ และใช้ด่านนี้ไม่ได้
  เพราะ session ของตัวจับเวลาไม่ใช่ผู้เปิดหน้าเว็บ จึงกันด้วย `backedUpRecently_()`
  ช่วงห่างขั้นต่ำ 6 ชั่วโมง ซึ่งไม่กระทบการสำรองคืนละครั้ง
- เพิ่ม `tests/editor-only-guard.test.mjs` — ผ่าน 17/17

**ยังไม่ได้ทำ:** ทดสอบบน TEST deployment จริง โดยเฉพาะสองเรื่องที่ vm harness ยืนยันแทนไม่ได้
1. ครูรันจาก Apps Script editor แล้วผ่านด่านจริง
2. Trigger กลางคืนยังสำรองได้จริงหลังเพิ่มช่วงห่างขั้นต่ำ

## NEXT EXACT ACTION
_(แก้ 20 ก.ย. 2569 — ปล่อย v42 ขึ้น Production แล้ว)_

ไม่มีงาน deploy ค้าง `main` `origin/main` และ Production v42 เป็นซอร์สเดียวกันทั้งหมด

เหลือเฉพาะการตรวจที่ agent ทำแทนไม่ได้:

1. **ครูล็อกอิน Production ตรวจการใช้งานจริง** — การ์ด Pre-test ขึ้นก่อน Section 1
   นักเรียนที่เรียนค้างไว้ยังอยู่ Section เดิม และการ์ด Mastery ไม่โผล่ตอนยังไม่กดส่งข้อสอบ
2. **เช้าวันถัดไป ตรวจไฟล์สำรอง** ว่ามีสำเนาใหม่ ยืนยันว่า trigger กลางคืนยังทำงาน
3. **เรียก `showSetupStatus` แบบไม่ล็อกอิน** บน Production ต้องถูกปฏิเสธ

ถ้าข้อใดไม่ผ่าน ชี้ deployment ID เดิมกลับไป **v41** ได้ทันที

งานพัฒนาที่ยังค้าง ไม่เกี่ยวกับ release นี้:
- การ์ด Foundation และโจทย์ Challenge ที่เส้นทาง foundation/challenge ควรเปิดให้
  เป็นงานเขียนเนื้อหา ต้องให้ครูตรวจก่อนตาม Blueprint #181
- ช่องว่าง Blueprint ที่เหลือ: Question Bank, Randomization, Content Lifecycle, Monitoring

งานที่อยู่นอกขอบเขตนี้:
- Git-history remediation ของหลักฐาน credential เดิม ต้องขออนุมัติแยกเพราะเป็นงานทำลายล้าง
- Apps Script `@HEAD` เป็น deployment สำหรับผู้แก้ไขเท่านั้น ตรวจแล้วไม่ใช่ช่องสาธารณะ ไม่ต้องทำอะไร

## Continuation Safety
- Never record or reproduce credentials, password hashes, salts, or session tokens.
- Never use the historical credential again.
- Do not show unredacted Git history/diff containing the historical value.
- Preserve hardened Admin rotation + session-epoch behavior and Production v41 controls in future releases.
- Do not alter Production data without explicit authority.
- Do not commit, push, merge, rewrite history, or deploy unless explicitly authorized for that exact action.
- Do not fold lesson X/Y changes into a security-only release without a new scope decision.

## Scheduled Continuation
- SCHEDULED CONTINUATION: NOT_CREATED
- REASON: รอครูทดสอบ TEST v11 ด้วยมือ ไม่มีอะไรให้รอแบบอัตโนมัติ

## Final Checkpoint Statement
**SECURITY GOLD: CLOSED/PASS · PRODUCTION v42: SHIPPED — editor-only guard + Mastery + Pre-test ตรวจซอร์สหลัง deploy แล้ว ตรงกับ `main` ทุกไฟล์ · ยังขาดการทดสอบแบบล็อกอินบน Production ซึ่งครูต้องทำเอง**
