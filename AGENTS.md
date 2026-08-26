# Tilt Lab Project Instructions

## Project identity

- **Project:** Tilt Lab — ระบบตรวจจับความเอียงด้วย micro:bit
- **Type:** CAI / Online Lesson
- **Target:** นักเรียน ม.1
- **Roles:** `student`, `admin`
- Do not create a `teacher` role. Under approved deviation D-001, teachers use `admin`.

## Authority and source of truth

Apply instructions in this order:

1. Current explicit user instructions
2. This root `AGENTS.md`
3. `CLAUDE.md`
4. `docs/FULL_MASTER_BLUEPRINT_CAI_COMPLETE.md`
5. `docs/DEVIATIONS.md`, only for recorded approved exceptions
6. Existing implementation, when it does not conflict with the sources above

The Blueprint is the system source of truth. When sources conflict, do not guess: apply the safest rule consistent with the authority order and report the conflict. Preserve an approved deviation where it explicitly governs a Blueprint requirement.

## Engineering workflow

Use `gold-engineering-router` as the default workflow for `BUG`, `FEATURE`, `REFACTOR`, `ARCHITECTURE`, `UI/UX`, `CONTENT`, `TEST`, `SECURITY`, `PERFORMANCE`, `DATA`, `RELEASE`, `RESEARCH`, and `DECISION` work. Do not duplicate its central workflow here.

For this repository, use `search -> relevant files -> minimal diff`: inspect only relevant files, reuse existing context and systems, batch related edits, avoid repeated scans and unrelated changes, and validate the affected path first.

## Platform

- Google Apps Script V8
- Vanilla HTML/CSS/JavaScript single-page frontend
- `google.script.run` RPC
- Google Sheets and Google Drive
- Script Properties, CacheService, and LockService
- Browser `localStorage` and `sessionStorage`
- No package manager or build system is currently evidenced; reassess only if new evidence appears.

## Project invariants

- Reuse and extend the existing system before creating new components. Do not rewrite the architecture without a demonstrated need.
- Preserve lesson sequence, stable IDs, external contracts, user data, progress, scores, accounts, and sheet contracts.
- Never reset or delete production data without an explicit user instruction.
- Any schema change requires a documented reason, migration plan, backward compatibility where needed, and review before implementation.
- Check dependencies before renaming any function, API, ID, event payload, sheet field, or other externally referenced contract.
- Never rename `runScheduledBackup()` without first accounting for its Apps Script trigger dependency.

## Approved deviations

- **D-001:** Teachers use the `admin` role. Do not add a `teacher` role automatically. “Teacher workflow” and Teacher Preview remain product workflows, not a separate authorization role.
- **D-002:** Preserve the current student password/PIN policy and the rule that students cannot change it themselves unless the user explicitly authorizes a reviewed change.
- **D-003:** Do not invent curriculum standards, indicators, codes, or other authoritative curriculum data. Wait for a verified source.

## Learning and UX

- Design for Zero-Knowledge Learning: a student must be able to begin without prior knowledge.
- Preserve the required learning sequence, progressive unlocking, backend validation, student progress, assessment integrity, and reward integrity.
- Never unlock a required step using client-side trust alone.
- Design for ม.1 students across mobile and desktop. Account for touch targets, readability, responsive layout, accessibility, consistent navigation, and loading, error, and empty states.

## Data, authorization, and security

- Preserve server-side validation. Admin APIs require a server-side role guard; never trust client-provided role or identity alone.
- Do not expose credentials, secrets, or session tokens; do not log sensitive values, write credentials into documentation, or commit new credentials.
- If a credential is found, report only `SECRET/CREDENTIAL PRESENT`, its path, and approximate type. Never reproduce the value.
- **SECURITY DEBT / PRODUCTION BLOCKER:** Git-tracked documentation, including `docs/DEVIATIONS.md`, contains evidence of a real student credential/password. Do not remediate, rotate, delete, or rewrite it without explicit authorization.

## Validation strategy

No reproducible automated test harness is currently verified. During development, prefer:

1. Targeted static inspection
2. Targeted functional validation
3. Manual testing of the affected path

Do not repeatedly run full builds or whole-system browser regression. At an explicitly requested Final Gate, cover the relevant Student view, Admin/Teacher workflow, Teacher Preview, mobile, desktop, progress, navigation, assessment, game, and reward paths.

Do not cite historical test counts as current evidence unless they come from a reproducible current harness.

## Deployment safety

The Apps Script Web App is the production target, but this repository has no confirmed reproducible deployment workflow. Never deploy automatically.

`PASS`, `READY`, `APPROVED`, `TESTS PASSED`, and `RELEASE CANDIDATE` are not deployment instructions. Deploy only after an explicit user command such as `Deploy Production`. When release gates pass without that command, stop at:

`READY FOR USER REVIEW / NOT DEPLOYED`

## Known documentation conflicts

- Password-storage documentation conflicts with plaintext credential evidence. Use the secure interpretation and retain the production blocker until explicitly remediated.
- A password-minimum comment conflicts with the D-002 implementation. Preserve the approved deviation and current implementation; do not guess a new policy.
- Historical static-test claims conflict with the absence of a current reproducible test harness. Treat only reproducible current checks as evidence.

Report unresolved conflicts rather than silently normalizing documentation or implementation.
