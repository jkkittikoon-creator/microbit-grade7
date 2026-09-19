// Static regression for Pre-test and the adaptive path (Blueprint #32, #33, #65).
//
// The Pre-test sits OUTSIDE LESSON_SECTIONS and LESSON_OPTIONAL_STEPS on purpose:
// completedSections stores order numbers, so anything that shifts them rewrites
// what existing students are recorded as having finished. The load-bearing test
// here is that taking, skipping, or replaying the Pre-test never moves required
// progress by a single value.
//
// Loads the REAL Code.gs.  node tests/pretest-path.test.mjs Code.gs
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

// ── Wiring ────────────────────────────────────────────────────────────────────
check('every pre-test question maps to a declared objective',
  run(`Object.keys(PRETEST_ANSWER_KEY).filter(id => !LEARNING_OBJECTIVES.some(o => o.id === PRETEST_ANSWER_KEY[id].objective))`),
  []);
check('every answer is one of its own choices',
  run(`Object.keys(PRETEST_ANSWER_KEY).filter(id => PRETEST_ANSWER_KEY[id].choices.indexOf(PRETEST_ANSWER_KEY[id].answer) < 0)`),
  []);
check('pre-test is not a lesson section',
  run(`LESSON_SECTIONS.filter(s => s.id === 'pretest').length`), 0);
check('pre-test is not an optional step',
  run(`LESSON_OPTIONAL_STEPS.filter(s => s.id === 'pretest').length`), 0);

// ── Grading ───────────────────────────────────────────────────────────────────
const gradeAll = (correctCount) => run(`(() => {
  const ids = Object.keys(PRETEST_ANSWER_KEY);
  const answers = {};
  ids.forEach((id, i) => {
    const key = PRETEST_ANSWER_KEY[id];
    answers[id] = i < ${correctCount} ? key.answer : key.choices.filter(c => c !== key.answer)[0];
  });
  return normalizePretestState_({ answers }, null);
})()`);

const total = run('PRETEST_QUESTION_COUNT');
check('all correct scores full marks', gradeAll(total).score, total);
check('all wrong scores zero', gradeAll(0).score, 0);
check('grading marks it taken', gradeAll(total).taken, true);

// ── Path thresholds (#33): under 50 foundation, under 80 standard, else challenge
check('0/5 takes the foundation path', gradeAll(0).path, 'foundation');
check('2/5 (40%) takes the foundation path', gradeAll(2).path, 'foundation');
check('3/5 (60%) takes the standard path', gradeAll(3).path, 'standard');
check('4/5 (80%) takes the challenge path', gradeAll(4).path, 'challenge');
check('5/5 takes the challenge path', gradeAll(5).path, 'challenge');

// ── The page must not be able to set its own score, path, or timestamp ────────
const spoofed = run(`(() => {
  const ids = Object.keys(PRETEST_ANSWER_KEY);
  const answers = {};
  ids.forEach(id => {
    const key = PRETEST_ANSWER_KEY[id];
    answers[id] = key.choices.filter(c => c !== key.answer)[0];
  });
  return normalizePretestState_({
    answers, score: 5, percent: 100, path: 'challenge', taken: true, takenAt: '2020-01-01'
  }, null);
})()`);
check('client cannot inflate its own score', spoofed.score, 0);
check('client cannot choose its own path', spoofed.path, 'foundation');
check('client cannot backdate the attempt', spoofed.takenAt === '2020-01-01', false);

// Malformed submissions are ignored rather than half-recorded.
check('unknown choice value is rejected',
  run(`normalizePretestState_({ answers: { p1: 'nope' } }, null).taken`), false);
check('partial answers are rejected',
  run(`normalizePretestState_({ answers: { p1: PRETEST_ANSWER_KEY.p1.answer } }, null).taken`), false);
check('extra keys are rejected', run(`(() => {
  const answers = {};
  Object.keys(PRETEST_ANSWER_KEY).forEach(id => { answers[id] = PRETEST_ANSWER_KEY[id].answer; });
  answers.p99 = 'sneaky';
  return normalizePretestState_({ answers }, null).taken;
})()`), false);

// ── One attempt only. A diagnostic that can be retaken measures nothing. ──────
const retaken = run(`(() => {
  const ids = Object.keys(PRETEST_ANSWER_KEY);
  const wrong = {};
  const right = {};
  ids.forEach(id => {
    const key = PRETEST_ANSWER_KEY[id];
    wrong[id] = key.choices.filter(c => c !== key.answer)[0];
    right[id] = key.answer;
  });
  const first = normalizePretestState_({ answers: wrong }, null);
  return normalizePretestState_({ answers: right }, first);
})()`);
check('a second attempt cannot overwrite the first', retaken.score, 0);
check('a second attempt cannot change the path', retaken.path, 'foundation');

check('skipping is remembered', run(`normalizePretestState_({ skipped: true }, null).skipped`), true);
check('a skip cannot be undone by answering later', run(`(() => {
  const skipped = normalizePretestState_({ skipped: true }, null);
  const answers = {};
  Object.keys(PRETEST_ANSWER_KEY).forEach(id => { answers[id] = PRETEST_ANSWER_KEY[id].answer; });
  return normalizePretestState_({ answers }, skipped).taken;
})()`), false);

// ── THE MIGRATION GUARD: required progress must never move ───────────────────
const progressAfter = (pretestExpr) => run(`(() => {
  const session = { username: 'std001', role: 'student' };
  const trusted = createDefaultProgress_(session);
  trusted.completedSections = [1, 2, 3];
  trusted.currentSection = 4;
  const incoming = JSON.parse(JSON.stringify(trusted));
  incoming.pretest = ${pretestExpr};
  const clean = validateProgressState_(incoming, session, trusted);
  return { completed: clean.completedSections, current: clean.currentSection };
})()`);

const answersExpr = `(() => { const a = {}; Object.keys(PRETEST_ANSWER_KEY).forEach(id => { a[id] = PRETEST_ANSWER_KEY[id].answer; }); return { answers: a }; })()`;
check('taking the pre-test does not move completedSections',
  progressAfter(answersExpr).completed, [1, 2, 3]);
check('taking the pre-test does not move currentSection',
  progressAfter(answersExpr).current, 4);
check('skipping the pre-test does not move completedSections',
  progressAfter('{ skipped: true }').completed, [1, 2, 3]);
check('a junk pre-test payload does not move completedSections',
  progressAfter('{ answers: { p1: "nope" }, score: 99 }').completed, [1, 2, 3]);

// A student who never saw the Pre-test must be unaffected by its existence.
check('existing progress without a pre-test still validates',
  run(`(() => {
    const session = { username: 'std002', role: 'student' };
    const trusted = createDefaultProgress_(session);
    trusted.completedSections = [1, 2, 3, 4];
    trusted.currentSection = 5;
    delete trusted.pretest;
    const incoming = JSON.parse(JSON.stringify(trusted));
    const clean = validateProgressState_(incoming, session, trusted);
    return [clean.completedSections, clean.currentSection, clean.pretest.taken];
  })()`),
  [[1, 2, 3, 4], 5, false]);

// ── Path reporting must be explainable to the teacher (#225) ──────────────────
check('no pre-test means the standard path',
  run(`computeLearningPath_(createDefaultProgress_({ username: 'a', role: 'student' })).id`), 'standard');
check('the path always states its reason',
  run(`computeLearningPath_(createDefaultProgress_({ username: 'a', role: 'student' })).reason.length > 0`), true);
check('a taken pre-test reports its score as the reason',
  run(`computeLearningPath_({ pretest: ${JSON.stringify(gradeAll(3))} }).reason`), 'Pre-test 3/5 (60%)');
check('results never expose the answer key', run(`(() => {
  const path = computeLearningPath_({ pretest: ${JSON.stringify(gradeAll(3))} });
  return JSON.stringify(path).indexOf(PRETEST_ANSWER_KEY.p1.answer);
})()`), -1);

// ── Growth: pre-test vs post-test (#65) ──────────────────────────────────────
const growth = (pretestExpr, quizExpr) => run(`computeGrowth_({ pretest: ${pretestExpr}, quiz: ${quizExpr} })`);
check('no growth without a pre-test',
  growth('{ taken: false }', '{ attempts: 1, bestScore: 6 }'), null);
check('no growth before the quiz is attempted',
  growth(JSON.stringify(gradeAll(3)), '{ attempts: 0, bestScore: 0 }'), null);
check('improvement is reported as a percentage delta',
  growth(JSON.stringify(gradeAll(3)), '{ attempts: 1, bestScore: 6 }').deltaPercent, 40);
check('improvement is flagged',
  growth(JSON.stringify(gradeAll(3)), '{ attempts: 1, bestScore: 6 }').improved, true);
check('a drop is not reported as improvement',
  growth(JSON.stringify(gradeAll(5)), '{ attempts: 1, bestScore: 3 }').improved, false);

// ── No XP from the Pre-test: it must not become something to farm (#89) ──────
check('the pre-test awards no XP', run(`(() => {
  const session = { username: 'a', role: 'student' };
  const before = computeRewards_(createDefaultProgress_(session)).xp;
  const state = createDefaultProgress_(session);
  state.pretest = ${JSON.stringify(gradeAll(5))};
  return computeRewards_(state).xp - before;
})()`), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
