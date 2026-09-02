// Static regression for the TEST v10 candidate:
// Free Navigation Preview may see optional-step rewards unlocked;
// a real student (or anyone spoofing client fields) must not.
// Loads the REAL Code.gs rather than reimplementing the logic.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = process.argv[2];
const ctx = vm.createContext({ console, JSON, Math, Number, String, Boolean, Object, Array, Date });
vm.runInContext(readFileSync(SRC, 'utf8'), ctx, { filename: 'Code.gs' });

const run = (expr) => vm.runInContext(expr, ctx);
let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

ctx.stateEarly = { completedSections: [1, 2], worksheet: {} };

const unlockedIds = (sessionExpr) =>
  run(`computeRewardsForSession_(stateEarly, ${sessionExpr}).optionalSteps.filter(s => s.unlocked).map(s => s.id)`);

const allIds = run(`LESSON_OPTIONAL_STEPS.map(s => s.id)`);

// A student only 2 sections in has earned no optional step (they unlock after 5 and 7).
check('student session unlocks nothing early', unlockedIds('{ username: "std001" }'), []);
check('no session at all unlocks nothing',     unlockedIds('null'), []);

// Spoofing attempts: the flag must come from the server session shape, nothing else.
check('client-ish preview flag alone does not unlock', unlockedIds('{ preview: true }'), []);
check('previewMode alone does not unlock',             unlockedIds('{ previewMode: "free" }'), []);
check('normal preview does not unlock',                unlockedIds('{ preview: true, previewMode: "normal" }'), []);
check('truthy-but-not-true preview does not unlock',   unlockedIds('{ preview: 1, previewMode: "free" }'), []);
check('state cannot unlock itself',
  run(`computeRewards_(Object.assign({ unlockAllOptionalSteps: true }, stateEarly)).optionalSteps.filter(s => s.unlocked).map(s => s.id)`), []);

// The one case that should unlock.
check('free navigation preview unlocks every optional step',
  unlockedIds('{ preview: true, previewMode: "free" }'), allIds);

// Unlocking must not fabricate completion or score.
check('unlocked-but-unplayed step is not marked completed',
  run(`computeRewardsForSession_(stateEarly, { preview: true, previewMode: "free" }).optionalSteps.every(s => s.completed === false && s.bestScore === 0)`), true);

// A genuine student who reached the gate still unlocks normally.
ctx.stateLate = { completedSections: [1, 2, 3, 4, 5], worksheet: {} };
check('student past section 5 unlocks the mini-game normally',
  run(`computeRewardsForSession_(stateLate, { username: "std001" }).optionalSteps.filter(s => s.unlocked).map(s => s.id)`), ['mini-game']);

// Preview must not inflate XP that a student would bank.
check('preview unlock does not award XP for unplayed steps',
  run(`computeRewardsForSession_(stateEarly, { preview: true, previewMode: "free" }).xp === computeRewards_(stateEarly).xp`), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
