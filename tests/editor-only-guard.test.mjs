// Static regression for the editor-only guard.
//
// The web app is deployed ANYONE_ANONYMOUS, so google.script.run can reach every
// top-level function whose name does not end in "_" — including the installer and
// the maintenance helpers, which index.html never calls. Those must refuse anyone
// who is not the script owner running from the Apps Script editor.
//
// Loads the REAL Code.gs and Maintenance.gs rather than reimplementing the logic.
//   node tests/editor-only-guard.test.mjs Code.gs Maintenance.gs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const [CODE_SRC, MAINTENANCE_SRC] = process.argv.slice(2);
const ctx = vm.createContext({
  console: { error() {}, log() {} },
  JSON, Math, Number, String, Boolean, Object, Array, Date, isFinite
});
vm.runInContext(readFileSync(CODE_SRC, 'utf8'), ctx, { filename: 'Code.gs' });
vm.runInContext(readFileSync(MAINTENANCE_SRC, 'utf8'), ctx, { filename: 'Maintenance.gs' });

const run = (expr) => vm.runInContext(expr, ctx);
let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

// Session stub. A real anonymous visitor gets an empty active-user email;
// the owner running from the editor gets the same address for both.
const setSession = (activeEmail, effectiveEmail) => {
  ctx.Session = {
    getActiveUser: () => ({ getEmail: () => activeEmail }),
    getEffectiveUser: () => ({ getEmail: () => effectiveEmail })
  };
};

// Any call that reaches real data past the guard must blow up here, loudly and
// distinguishably, so "guard did not stop it" can never read as a pass.
const TRIPWIRE = 'GUARD_LEAKED_TO_DATA';
ctx.PropertiesService = { getScriptProperties: () => { throw new Error(TRIPWIRE); } };
ctx.SpreadsheetApp = { create: () => { throw new Error(TRIPWIRE); } };
ctx.DriveApp = { createFolder: () => { throw new Error(TRIPWIRE); } };
ctx.LockService = { getScriptLock: () => { throw new Error(TRIPWIRE); } };
ctx.ScriptApp = { getProjectTriggers: () => { throw new Error(TRIPWIRE); } };

const DENIED = 'ฟังก์ชันนี้เรียกได้จาก Apps Script editor เท่านั้น';
const callResult = (expr) => {
  try { run(expr); return 'returned'; }
  catch (error) { return error && error.message === DENIED ? 'denied' : `other: ${error && error.message}`; }
};

const GUARDED = [
  'setupSystem()',
  'setupAdminAccount()',
  'setupDailyBackup()',
  'showSetupStatus()',
  'disablePasswordChangePrompt()'
];

// An anonymous web-app visitor has no active-user email at all.
setSession('', 'teacher@example.com');
GUARDED.forEach((call) => check(`anonymous caller denied: ${call}`, callResult(call), 'denied'));

// A signed-in Google user who is not the owner must not pass either.
setSession('someone.else@example.com', 'teacher@example.com');
GUARDED.forEach((call) => check(`other signed-in user denied: ${call}`, callResult(call), 'denied'));

// Session itself throwing (it can, for anonymous access) must deny, not allow.
ctx.Session = {
  getActiveUser: () => { throw new Error('no permission'); },
  getEffectiveUser: () => { throw new Error('no permission'); }
};
check('unreadable session denied', callResult('setupSystem()'), 'denied');

// The owner in the editor passes the guard and reaches the real work.
setSession('teacher@example.com', 'teacher@example.com');
check('owner passes the guard', run('requireEditorContext_("test")'), 'teacher@example.com');
check('owner reaches real work (tripwire fires)',
  callResult('setupSystem()'), `other: ${TRIPWIRE}`);

// The teacher's in-app button goes through the admin role guard and must keep
// working, so the shared body may not carry the editor guard.
check('admin path body is separate from the editor entry point',
  run('typeof installDailyBackup_'), 'function');

// The trigger entry point cannot use the guard (its session is not a visitor),
// so it is rate-limited instead. A recent backup means it does no work.
ctx.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: () => new Date().toISOString(),
    setProperty: () => { throw new Error(TRIPWIRE); }
  })
};
check('scheduled backup skips when one was just made', callResult('runScheduledBackup()'), 'returned');

// A stale timestamp must NOT skip: the nightly backup has to still run.
ctx.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: () => new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    setProperty: () => {}
  })
};
check('scheduled backup still runs when the last one is old',
  run('backedUpRecently_()'), false);

// No timestamp at all (first ever run, or the property was cleared) must not skip.
ctx.PropertiesService = {
  getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} })
};
check('scheduled backup runs when no timestamp exists', run('backedUpRecently_()'), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
