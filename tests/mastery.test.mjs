// Static regression for per-objective Mastery (Blueprint #52).
//
// Mastery must be derived on the server from the stored answers and the server
// answer key — never from anything the page sends. Loads the REAL Code.gs.
//   node tests/mastery.test.mjs Code.gs
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

// Every question must map to a declared objective, or a student could answer a
// question that counts toward nothing and Mastery would quietly under-report.
check('every question maps to a declared objective',
  run(`Object.keys(QUIZ_ANSWER_KEY).filter(id => !LEARNING_OBJECTIVES.some(o => o.id === QUIZ_ANSWER_KEY[id].objective))`),
  []);
check('every objective owns at least one question',
  run(`LEARNING_OBJECTIVES.filter(o => !Object.keys(QUIZ_ANSWER_KEY).some(id => QUIZ_ANSWER_KEY[id].objective === o.id)).map(o => o.id)`),
  []);
check('every objective points at a real section',
  run(`LEARNING_OBJECTIVES.filter(o => !LESSON_SECTIONS.some(s => s.id === o.reviewSectionId)).map(o => o.id)`),
  []);

const masteryOf = (answersExpr) => run(`computeMastery_({ quiz: { answers: ${answersExpr} } })`);
const statusById = (mastery) => mastery.objectives.map((o) => [o.id, o.status]);

// A student who has not taken the quiz has no mastery signal at all — and must
// not be shown as weak, which would be both wrong and discouraging (#72).
const untouched = masteryOf('{}');
check('no answers means not-started everywhere',
  statusById(untouched), [['LO-01', 'not-started'], ['LO-02', 'not-started'], ['LO-03', 'not-started']]);
check('no answers means no focus list', untouched.focus, []);
check('no answers means 0%', untouched.overallPercent, 0);

// A full correct paper: every objective strong.
const allCorrect = run(`(() => {
  const answers = {};
  Object.keys(QUIZ_ANSWER_KEY).forEach(id => { answers[id] = QUIZ_ANSWER_KEY[id].answer; });
  return computeMastery_({ quiz: { answers } });
})()`);
check('all correct means strong everywhere',
  statusById(allCorrect), [['LO-01', 'strong'], ['LO-02', 'strong'], ['LO-03', 'strong']]);
check('all correct means nothing to review', allCorrect.focus, []);
check('all correct is 100%', allCorrect.overallPercent, 100);

// A paper that is right on LO-01 and wrong on LO-03 must point at LO-03 only.
const mixed = run(`(() => {
  const answers = {};
  Object.keys(QUIZ_ANSWER_KEY).forEach(id => {
    const key = QUIZ_ANSWER_KEY[id];
    const wrong = key.choices.filter(c => c !== key.answer)[0];
    answers[id] = key.objective === 'LO-03' ? wrong : key.answer;
  });
  return computeMastery_({ quiz: { answers } });
})()`);
check('weak objective is flagged for review',
  statusById(mixed), [['LO-01', 'strong'], ['LO-02', 'strong'], ['LO-03', 'review']]);
check('focus names only the weak objective', mixed.focus, ['LO-03']);

// Half right within one objective is "developing", not a failure.
const half = run(`(() => {
  const ids = Object.keys(QUIZ_ANSWER_KEY).filter(id => QUIZ_ANSWER_KEY[id].objective === 'LO-01');
  const answers = {};
  answers[ids[0]] = QUIZ_ANSWER_KEY[ids[0]].answer;
  answers[ids[1]] = QUIZ_ANSWER_KEY[ids[1]].choices.filter(c => c !== QUIZ_ANSWER_KEY[ids[1]].answer)[0];
  return computeMastery_({ quiz: { answers } });
})()`);
check('half right is developing', half.objectives.filter(o => o.id === 'LO-01')[0].status, 'developing');
check('unanswered objectives stay not-started',
  half.objectives.filter(o => o.id !== 'LO-01').map(o => o.status), ['not-started', 'not-started']);

// Partial answers must score against what was answered, not against the whole
// objective, so a student mid-quiz is not reported as failing.
check('partial answer counts only what was answered',
  half.objectives.filter(o => o.id === 'LO-01')[0].answered, 2);

// The page must not be able to declare its own mastery. Only `answers` counts.
const spoofed = run(`computeMastery_({ quiz: {
  answers: {},
  results: { q1: { correct: true }, q2: { correct: true } },
  bestScore: 6,
  latestScore: 6
} })`);
check('client-supplied results cannot create mastery', statusById(spoofed),
  [['LO-01', 'not-started'], ['LO-02', 'not-started'], ['LO-03', 'not-started']]);

const spoofedAnswers = run(`computeMastery_({ quiz: { answers: { q1: 'temperature' },
  results: { q1: { correct: true, selected: 'temperature' } } } })`);
check('a wrong answer stays wrong even if results say otherwise',
  spoofedAnswers.objectives.filter(o => o.id === 'LO-01')[0].correct, 0);

// Garbage in must not throw: this runs inside every progress read.
check('missing state does not throw', run('computeMastery_(null).overallPercent'), 0);
check('missing quiz does not throw', run('computeMastery_({}).overallPercent'), 0);
check('non-object answers do not throw',
  run('computeMastery_({ quiz: { answers: "nope" } }).overallPercent'), 0);

// Every objective carries readable text, never colour alone (#222).
check('every objective has a status label',
  run(`computeMastery_({}).objectives.filter(o => !o.statusLabel).length`), 0);
check('every objective names where to review',
  run(`computeMastery_({}).objectives.filter(o => !o.reviewSectionTitle || !o.reviewSectionOrder).length`), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
