/**
 * Tilt Lab — Google Apps Script backend
 * วิชาเทคโนโลยีสารสนเทศ ชั้น ม.1 ภาคเรียนที่ 1 ปีการศึกษา 2569
 *
 * ทุกรหัสผ่านตั้งผ่าน Project Settings > Script properties เท่านั้น
 * ระบบจะ hash รหัสเก็บลงชีต Users แล้วลบ property ที่เป็นข้อความธรรมดาทิ้งทันที
 *
 * ติดตั้งครั้งแรก:
 * 1) ตั้ง INITIAL_STUDENT_PASSWORD แล้วเรียก setupSystem()  — สร้างชีต Drive และบัญชีนักเรียน
 * 2) ตั้ง INITIAL_ADMIN_PASSWORD  แล้วเรียก setupAdminAccount()
 *
 * ดูแลภายหลัง:
 * - showSetupStatus()        ดูว่าติดตั้งครบหรือยัง มีบัญชีอะไรบ้าง ไม่แสดงรหัสผ่าน
 * - resetStudentPasswords()  รีเซ็ตรหัสนักเรียนที่ลืมรหัส ผ่าน RESET_STUDENT_PASSWORD
 * - setupAdminAccount()      เรียกซ้ำได้ ใช้รีเซ็ตรหัสแอดมิน
 *
 * รหัสผ่านต้องยาว 8–128 ตัว และมีทั้งตัวอักษรและตัวเลข
 */

const APP_CONFIG = Object.freeze({
  appTitle: 'Tilt Lab — ระบบตรวจจับความเอียงกับ micro:bit',
  subject: 'เทคโนโลยีสารสนเทศ',
  grade: 'มัธยมศึกษาปีที่ 1',
  academicYear: '2569',
  semester: '1/2569',
  teacherName: 'นายกิตติคุณ จันทะคุณ',
  schoolName: 'โรงเรียนบ้านเขาธรรมบท',
  adminUsername: 'admin',
  previewUsername: '__preview__',
  adminPasswordProperty: 'INITIAL_ADMIN_PASSWORD',
  stateVersion: 1,
  sessionTtlSeconds: 6 * 60 * 60,
  sessionPropertyPrefix: 'TILT_LAB_SESSION_',
  previewStatePropertyPrefix: 'TILT_LAB_PREVIEW_STATE_',
  previewStateChunkCodePoints: 2000,
  maxFailedLogins: 5,
  failedLoginWindowSeconds: 10 * 60,
  maxProgressJsonLength: 50000,
  maxDownloadFileBytes: 5 * 1024 * 1024,
  downloadFiles: Object.freeze({
    lessonPlan: '1gJxPTOLSqb4WXNe4hO9L9Q5ML7bIH38H',
    slides: '1RLaPakb15hYNBRv0Pd81PSwf9Zz_1tSp'
  }),
  quizQuestionCount: 6,
  quizPassPercent: 70,
  quizMaxAttempts: 3,
  xpPerSection: 10,
  xpQuizPass: 30,
  xpPerfectQuiz: 20,
  xpMiniGame: 20,
  xpMission: 30,
  xpCodingLab: 30,
  spreadsheetProperty: 'TILT_LAB_SPREADSHEET_ID',
  driveFolderProperty: 'TILT_LAB_DRIVE_FOLDER_ID',
  backupFolderProperty: 'TILT_LAB_BACKUP_FOLDER_ID',
  timeZone: 'Asia/Bangkok',
  backupFolderName: 'สำรองข้อมูลอัตโนมัติ',
  // เก็บย้อนหลังกี่วัน — สำเนาที่เก่ากว่านี้จะถูกย้ายลงถังขยะ ไม่ได้ลบถาวร
  backupKeepDays: 14,
  // ชั่วโมงที่ให้สำรองอัตโนมัติ ตั้งเป็นตอนดึกเพื่อไม่ชนเวลาเรียน
  backupHour: 1,
  initialPasswordProperty: 'INITIAL_STUDENT_PASSWORD'
});

/**
 * ทะเบียนขั้นตอนบทเรียน — Blueprint #107 LessonStep
 * เป็นแหล่งความจริงเดียวของลำดับและเงื่อนไขปลดล็อก
 * ทั้งหน้าเว็บและการตรวจฝั่งเซิร์ฟเวอร์อ่านจากที่นี่ที่เดียว
 * แก้ลำดับหรือเพิ่มขั้นตอนได้โดยไม่ต้องไล่แก้เงื่อนไขกระจายในโค้ด
 */
const LESSON_SECTIONS = Object.freeze([
  Object.freeze({ order: 1, id: 'hook', title: 'Hook', required: true }),
  Object.freeze({ order: 2, id: 'predict', title: 'Predict–Observe', required: true }),
  Object.freeze({ order: 3, id: 'unplugged', title: 'Unplugged map()', required: true }),
  Object.freeze({ order: 4, id: 'mg-concept', title: 'mg และ g', required: true }),
  Object.freeze({ order: 5, id: 'tilt-simulator', title: 'Tilt Simulator', required: true }),
  Object.freeze({ order: 6, id: 'debug-case', title: 'Debug Case Study', required: true }),
  Object.freeze({ order: 7, id: 'glossary', title: 'Glossary', required: true }),
  Object.freeze({ order: 8, id: 'quiz', title: 'Self-check Quiz', required: true }),
  Object.freeze({ order: 9, id: 'reflection', title: 'สะท้อนผลการเรียนรู้', required: true })
]);

/** ลำดับของขั้นแบบทดสอบ ใช้เป็นเงื่อนไขก่อนรับคำตอบ แทนการอิงจำนวนขั้นทั้งหมด */
const QUIZ_SECTION_ORDER = LESSON_SECTIONS.filter(function (section) {
  return section.id === 'quiz';
})[0].order;

const QUIZ_PASS_MARK = Math.ceil(
  APP_CONFIG.quizQuestionCount * APP_CONFIG.quizPassPercent / 100
);

/**
 * เฉลยอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น — DIFF-02A
 * หน้าเว็บจะส่งเพียงรหัสตัวเลือก แล้วให้เซิร์ฟเวอร์ตรวจและคำนวณคะแนน
 */
const QUIZ_ANSWER_KEY = Object.freeze({
  q1: Object.freeze({
    answer: 'acceleration',
    choices: Object.freeze(['temperature', 'acceleration', 'sound'])
  }),
  q2: Object.freeze({
    answer: 'one',
    choices: Object.freeze(['one', 'hundred', 'equal'])
  }),
  q3: Object.freeze({
    answer: 'two',
    choices: Object.freeze(['one', 'two', 'four'])
  }),
  q4: Object.freeze({
    answer: 'map-four',
    choices: Object.freeze(['both-four', 'map-four', 'both-two'])
  }),
  q5: Object.freeze({
    answer: 'limit',
    choices: Object.freeze(['speed', 'limit', 'lights'])
  }),
  q6: Object.freeze({
    answer: 'pace',
    choices: Object.freeze(['stop', 'reset', 'pace'])
  })
});

/**
 * หลักฐานขั้นต่ำของ Required Sections — DIFF-04A
 *
 * completedSections เป็นเพียงผลลัพธ์ที่คำนวณได้ ไม่ใช่หลักฐานในตัวเอง
 * ค่าชุดนี้ต้องตรงกับตัวเลือกและเงื่อนไขที่หน้าเว็บใช้อยู่ เพื่อให้เซิร์ฟเวอร์
 * ตรวจคำตอบเดิมได้โดยไม่เปลี่ยนสูตร mg / map() / constrain()
 */
const REQUIRED_EVIDENCE_RULES = Object.freeze({
  sensorGuesses: Object.freeze(['camera', 'sensor', 'gps', 'unsure']),
  predict800Choices: Object.freeze(['edge', 'missing', 'blink']),
  mgChoices: Object.freeze(['sensor-max', 'working-range', 'led-count']),
  debugChoices: Object.freeze(['same', 'map-four', 'wrong-safer']),
  confidenceChoices: Object.freeze(['high', 'ok', 'unsure', 'help']),
  glossaryRequired: 6,
  glossaryAbbreviationsRequired: 2,
  glossaryIds: Object.freeze([
    'accelerometer', 'acceleration', 'gravity', 'milli-g', 'map', 'constrain',
    'sensor', 'range', 'plot', 'forever', 'accel', 'loop', 'variable', 'tilt',
    'degree', 'abbr-mg', 'abbr-g', 'abbr-axis', 'abbr-ax', 'abbr-ay',
    'abbr-ms', 'abbr-js', 'abbr-led'
  ]),
  glossaryAbbreviationIds: Object.freeze([
    'abbr-mg', 'abbr-g', 'abbr-axis', 'abbr-ax', 'abbr-ay',
    'abbr-ms', 'abbr-js', 'abbr-led'
  ])
});

const LESSON_SECTION_COUNT = LESSON_SECTIONS.length;

/**
 * กิจกรรมเสริม — Blueprint #17 Required/Optional, #36 และ #42
 *
 * แยกทะเบียนออกจาก LESSON_SECTIONS โดยตั้งใจ
 * เพราะถ้าแทรกไว้กลางลำดับบังคับ เลขขั้นของทุกขั้นที่อยู่หลังจะเลื่อน
 * ความก้าวหน้าที่นักเรียนบันทึกไว้แล้วจะถูกตีความผิดทั้งหมด
 * และต้องทำ migration ตาม Blueprint #123 ซึ่งเสี่ยงโดยไม่จำเป็น
 *
 * ครูอนุมัติให้เป็น Optional จึงเก็บผลไว้ใน worksheet
 * และคุมเงื่อนไขเปิดด้วย unlockAfter แทนการอยู่ในลำดับบังคับ
 * ถ้าวันหนึ่งครูต้องการเปลี่ยนเป็น Required ให้ย้ายเข้า LESSON_SECTIONS
 * พร้อม migration ที่เลื่อนเลขขั้นและสำรองข้อมูลเดิมก่อน
 */
const LESSON_OPTIONAL_STEPS = Object.freeze([
  Object.freeze({
    id: 'mini-game',
    title: 'นักสืบค่าหลุดขอบ',
    kind: 'game',
    // ต่อจาก Tilt Simulator เพราะนักเรียนเพิ่งเห็นผลของ constrain มาหมาด ๆ
    unlockAfter: 5,
    xpReward: APP_CONFIG.xpMiniGame,
    stateKey: 'miniGame',
    badge: Object.freeze({
      id: 'detective',
      label: 'นักสืบค่าหลุดขอบ',
      detail: 'แยกค่าที่หลุดพิกัดออกจากค่าที่ปลอดภัยได้'
    })
  }),
  Object.freeze({
    id: 'mission',
    title: 'ภารกิจออกแบบช่วงใช้งานให้เพื่อน',
    kind: 'mission',
    // ต่อจาก Glossary และก่อนแบบทดสอบ ตามลำดับใน Blueprint #127
    unlockAfter: 7,
    xpReward: APP_CONFIG.xpMission,
    stateKey: 'mission',
    badge: Object.freeze({
      id: 'designer',
      label: 'นักออกแบบช่วงใช้งาน',
      detail: 'ออกแบบช่วงใช้งานให้เหมาะกับผู้ใช้จริงได้'
    })
  }),
  Object.freeze({
    id: 'coding-lab',
    title: 'ภาคปฏิบัติ เขียนโค้ดจริงบน micro:bit',
    kind: 'lab',
    // ต่อจาก Glossary เพราะนักเรียนรู้ครบทุกคำสั่งแล้ว จึงลงมือเขียนจริงได้
    unlockAfter: 7,
    xpReward: APP_CONFIG.xpCodingLab,
    stateKey: 'codingLab',
    badge: Object.freeze({
      id: 'coder',
      label: 'นักเขียนโค้ด micro:bit',
      detail: 'เขียนและทดลองโปรแกรมเอียงจริงบน MakeCode ได้'
    })
  })
]);

/**
 * หลักฐานกิจกรรมเสริม — DIFF-04B
 *
 * XP และ Badge ให้ได้จากผลที่ server คำนวณเท่านั้น ไม่เชื่อ completed,
 * bestScore, plays หรือ stage ที่ browser ส่งมาโดยตรง
 */
const OPTIONAL_EVIDENCE_RULES = Object.freeze({
  miniGame: Object.freeze({
    passMark: 6,
    items: Object.freeze([
      Object.freeze({ accel: 0, safe: true }),
      Object.freeze({ accel: 800, safe: false }),
      Object.freeze({ accel: -600, safe: true }),
      Object.freeze({ accel: 1000, safe: false }),
      Object.freeze({ accel: 300, safe: true }),
      Object.freeze({ accel: -900, safe: false }),
      Object.freeze({ accel: 600, safe: true }),
      Object.freeze({ accel: -1023, safe: false })
    ])
  }),
  mission: Object.freeze({
    stageCount: 4,
    letterMin: 40,
    letterMax: 600,
    choices: Object.freeze(['a', 'b', 'c', 'd']),
    answers: Object.freeze({ q1: 'b', q2: 'a', q3: 'c', q4: 'a' })
  }),
  codingLab: Object.freeze({
    noteMin: 15,
    noteMax: 300,
    pauseChoices: Object.freeze(['bigger', 'smaller', 'remove']),
    correctPauseAnswer: 'bigger'
  })
});

const STUDENT_ROSTER = Object.freeze([
  { username: 'std001', studentNumber: '001', displayName: 'เด็กชายณฐชยนต์  สุขแจ่ม' },
  { username: 'std002', studentNumber: '002', displayName: 'เด็กชายธนากร  พรมมาแข้' },
  { username: 'std003', studentNumber: '003', displayName: 'เด็กหญิงนภาพร  ก้อนจันทร์เทศ' },
  { username: 'std004', studentNumber: '004', displayName: 'เด็กหญิงนรินธร  ก้อนจันทร์เทศ' },
  { username: 'std005', studentNumber: '005', displayName: 'เด็กหญิงสุภัสสรา  สีสิงห์' },
  { username: 'std006', studentNumber: '006', displayName: 'เด็กหญิงเสาวลักษณ์  รุ่งฉวี' },
  { username: 'std007', studentNumber: '007', displayName: 'เด็กหญิงลิตานันท์  สิงห์งาม' }
]);

/**
 * สี่ด้านของแบบสังเกตพฤติกรรม ตามแผนการจัดการเรียนรู้ข้อ 9 และ 10
 * ให้คะแนน 1–3 โดย 3 คือดีมาก 2 คือผ่าน 1 คือควรช่วยเหลือ
 * เกณฑ์ผ่านคือได้ระดับ 2 ขึ้นไปในทุกด้าน
 *
 * เก็บแยกชีตจากคะแนนวิชาการ เพราะเป็นการประเมินเจตคติที่ครูสังเกตเอง
 * ไม่ใช่สิ่งที่ระบบคำนวณได้ และไม่ควรปนกับคะแนนแบบทดสอบ
 */
const OBSERVATION_ASPECTS = Object.freeze([
  Object.freeze({
    key: 'predict',
    label: 'ทำนาย',
    levels: Object.freeze([
      'รอคำตอบจากผู้อื่น',
      'เลือกคำตอบก่อนดูเฉลย',
      'ให้เหตุผลก่อนดูผล'
    ])
  }),
  Object.freeze({
    key: 'experiment',
    label: 'ทดลอง',
    levels: Object.freeze([
      'ทดลองไม่ครบหรือข้ามขั้น',
      'ทำตามภารกิจครบ',
      'เปลี่ยนค่าหลายจุดและเปรียบเทียบ'
    ])
  }),
  Object.freeze({
    key: 'debug',
    label: 'Debug',
    levels: Object.freeze([
      'บอกเพียงว่าผิดโดยไม่มีเหตุผล',
      'ระบุสาเหตุหรือวิธีแก้ได้',
      'เชื่อมอาการ สูตร และวิธีแก้ได้'
    ])
  }),
  Object.freeze({
    key: 'teamwork',
    label: 'ร่วมมือ',
    levels: Object.freeze([
      'ไม่ร่วมกิจกรรม',
      'แบ่งงานและสื่อสาร',
      'อธิบายให้เพื่อนและรับฟัง'
    ])
  })
]);

const SHEET_SCHEMAS = Object.freeze({
  Users: [
    'username', 'role', 'studentNumber', 'displayName', 'passwordHash',
    'salt', 'active', 'mustChangePassword', 'createdAt', 'updatedAt'
  ],
  Progress: [
    'username', 'stateVersion', 'progressJson', 'currentSection',
    'latestScore', 'bestScore', 'attempts', 'updatedAt'
  ],
  Attempts: [
    'timestamp', 'username', 'assessment', 'score', 'maximumScore',
    'attemptNumber', 'answersJson', 'submissionId'
  ],
  Audit: ['timestamp', 'username', 'action', 'result', 'details'],
  QuizArchive: [
    'timestamp', 'actor', 'username', 'reason', 'beforeLatestScore',
    'beforeBestScore', 'beforeAttempts', 'beforeQuizJson', 'restoredAt', 'restoredBy'
  ],
  Observation: [
    'username', 'predict', 'experiment', 'debug', 'teamwork',
    'note', 'updatedAt', 'updatedBy'
  ],
  Settings: ['key', 'value', 'updatedAt']
});

/* ══════════════════════════════════════════════════════════════════
 * ระบบสำรองข้อมูล — Blueprint #205 Backup และ #206 Restore Test
 *
 * ข้อมูลนักเรียนทั้งหมดอยู่ในสเปรดชีตใบเดียว ถ้าไฟล์นั้นเสียหาย
 * ถูกลบ หรือมีใครแก้ผิดช่อง จะไม่มีทางกู้กลับมาได้เลย
 * ระบบนี้จึงสำเนาทั้งใบไปเก็บใน Drive ทุกคืนโดยอัตโนมัติ
 *
 * ทุกฟังก์ชันในกลุ่มนี้เป็นการ "อ่านแล้วสำเนา" ไม่แตะข้อมูลต้นทางเลย
 * ══════════════════════════════════════════════════════════════════ */

/** โฟลเดอร์เก็บสำเนา สร้างไว้ใต้โฟลเดอร์หลักของระบบ สร้างครั้งเดียวแล้วจำไว้ */
function ensureBackupFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(APP_CONFIG.backupFolderProperty);

  if (savedId) {
    try {
      const existing = DriveApp.getFolderById(savedId);
      // โฟลเดอร์ที่ถูกย้ายลงถังขยะใช้เก็บสำเนาต่อไม่ได้ ต้องสร้างใหม่
      if (!existing.isTrashed()) return existing;
    } catch (error) {
      // หา id เดิมไม่เจอ แปลว่าถูกลบถาวรไปแล้ว จึงสร้างใหม่ด้านล่าง
    }
  }

  const rootId = properties.getProperty(APP_CONFIG.driveFolderProperty);
  if (!rootId) throw new Error('ระบบยังไม่ได้ตั้งค่า กรุณาเรียก setupSystem()');

  const folder = DriveApp.getFolderById(rootId)
    .createFolder(APP_CONFIG.backupFolderName);
  properties.setProperty(APP_CONFIG.backupFolderProperty, folder.getId());
  return folder;
}

/**
 * สำเนาสเปรดชีตทั้งใบไปเก็บในโฟลเดอร์สำรอง
 * actor บอกว่าใครสั่ง ถ้าเป็นตัวจับเวลาอัตโนมัติจะเป็น 'ระบบอัตโนมัติ'
 */
function createBackup_(actor) {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(APP_CONFIG.spreadsheetProperty);
  if (!spreadsheetId) throw new Error('ระบบยังไม่ได้ตั้งค่า กรุณาเรียก setupSystem()');

  const folder = ensureBackupFolder_();
  const stamp = Utilities.formatDate(
    new Date(), APP_CONFIG.timeZone, 'yyyy-MM-dd HH-mm'
  );
  const copy = DriveApp.getFileById(spreadsheetId)
    .makeCopy('Tilt Lab สำรอง ' + stamp, folder);

  const removed = pruneOldBackups_(folder);

  appendAudit_(
    actor,
    'backup_create',
    'success',
    'สำเนา ' + copy.getName() +
      ' | เก็บย้อนหลัง ' + APP_CONFIG.backupKeepDays + ' วัน' +
      ' | ย้ายสำเนาเก่าลงถังขยะ ' + removed + ' ไฟล์'
  );

  return {
    ok: true,
    name: copy.getName(),
    createdAt: new Date().toISOString(),
    prunedCount: removed,
    folderUrl: 'https://drive.google.com/drive/folders/' + folder.getId()
  };
}

/**
 * ย้ายสำเนาที่เก่ากว่ากำหนดลงถังขยะ — Safe Delete ตาม Blueprint #227
 * ใช้ setTrashed ไม่ใช่การลบถาวร ครูจึงกู้จากถังขยะได้อีก 30 วัน
 * และจะเหลือสำเนาล่าสุดไว้อย่างน้อยหนึ่งไฟล์เสมอ แม้จะเลยกำหนดแล้ว
 */
function pruneOldBackups_(folder) {
  const cutoff = new Date().getTime() -
    APP_CONFIG.backupKeepDays * 24 * 60 * 60 * 1000;

  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.isTrashed()) continue;
    files.push({ file: file, time: file.getDateCreated().getTime() });
  }

  // ใหม่สุดอยู่หน้า เพื่อกันไฟล์ล่าสุดไว้เสมอ
  files.sort(function (a, b) { return b.time - a.time; });

  let removed = 0;
  files.forEach(function (entry, index) {
    if (index === 0) return;
    if (entry.time >= cutoff) return;
    entry.file.setTrashed(true);
    removed += 1;
  });

  return removed;
}

/** จุดเข้าของตัวจับเวลาอัตโนมัติ ห้ามเปลี่ยนชื่อ เพราะ Trigger อ้างชื่อนี้ */
function runScheduledBackup() {
  try {
    createBackup_('ระบบอัตโนมัติ');
  } catch (error) {
    // ตัวจับเวลาล้มเหลวต้องเห็นใน Audit ไม่ใช่เงียบหายไป
    appendAudit_('ระบบอัตโนมัติ', 'backup_create', 'failed', String(error && error.message));
  }
}

/**
 * ตั้งตัวจับเวลาให้สำรองทุกคืน เรียกครั้งเดียวพอ
 * เรียกซ้ำได้ปลอดภัย เพราะลบตัวเดิมก่อนสร้างใหม่เสมอ จึงไม่ซ้อนกัน
 */
function setupDailyBackup() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'runScheduledBackup') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runScheduledBackup')
    .timeBased()
    .atHour(APP_CONFIG.backupHour)
    .everyDays(1)
    .create();

  const result = createBackup_('ตั้งค่าระบบสำรอง');
  return {
    ok: true,
    message: 'ตั้งการสำรองอัตโนมัติทุกวันเวลาประมาณ ' +
      APP_CONFIG.backupHour + ' นาฬิกาแล้ว และสำรองให้ทันทีหนึ่งครั้ง',
    backup: result
  };
}

/** อ่านสถานะระบบสำรองสำหรับแสดงในหน้าครู */
function backupStatus_() {
  // สถานะสำรองต้องไม่ทำให้แดชบอร์ดครูพังเด็ดขาด
  // ถ้าอ่านอะไรไม่ได้ ให้คืนค่าที่บอกว่า "ไม่ทราบ" แทนการโยน error
  const status = { scheduled: null, count: 0, latestAt: null, folderUrl: null };

  // การอ่านตัวจับเวลาต้องใช้สิทธิ์ script.scriptapp
  // เว็บแอปที่ deploy ก่อนเพิ่มสิทธิ์นี้จะเรียกไม่ได้ ต้องกันไว้ไม่ให้ล้มทั้งหน้า
  try {
    status.scheduled = ScriptApp.getProjectTriggers().some(function (trigger) {
      return trigger.getHandlerFunction() === 'runScheduledBackup';
    });
  } catch (error) {
    status.scheduled = null;
  }

  try {
    const folderId = PropertiesService.getScriptProperties()
      .getProperty(APP_CONFIG.backupFolderProperty);
    if (!folderId) return status;

    const folder = DriveApp.getFolderById(folderId);
    status.folderUrl = 'https://drive.google.com/drive/folders/' + folderId;

    let latest = null;
    const iterator = folder.getFiles();
    while (iterator.hasNext()) {
      const file = iterator.next();
      if (file.isTrashed()) continue;
      status.count += 1;
      const created = file.getDateCreated();
      if (!latest || created.getTime() > latest.getTime()) latest = created;
    }
    status.latestAt = latest ? latest.toISOString() : null;
  } catch (error) {
    // อ่านโฟลเดอร์ไม่ได้ก็ยังคืนสถานะเท่าที่มี
  }

  return status;
}

/** ครูสั่งสำรองเดี๋ยวนี้จากหน้าเว็บ */
function backupNow(token) {
  const session = requireRole_(token, 'admin');
  const result = createBackup_(session.username);
  return { ok: true, backup: result, status: backupStatus_() };
}

/** ครูเปิดการสำรองอัตโนมัติจากหน้าเว็บ โดยไม่ต้องเข้า Apps Script */
function enableDailyBackup(token) {
  const session = requireRole_(token, 'admin');
  const result = setupDailyBackup();
  appendAudit_(
    session.username,
    'backup_schedule',
    'success',
    'เปิดการสำรองอัตโนมัติทุกวันเวลาประมาณ ' + APP_CONFIG.backupHour + ' นาฬิกา'
  );
  return { ok: true, message: result.message, status: backupStatus_() };
}

/* ══════════════════════════════════════════════════════════════════
 * แบบบันทึกการสังเกตรายบุคคล — แผนการจัดการเรียนรู้ข้อ 10
 *
 * แผนเดิมเป็นแบบกระดาษให้ครูกรอกมือ ย้ายมาไว้ในระบบเพื่อให้อยู่ที่เดียว
 * กับหลักฐานอื่น และครูเปิดดูย้อนหลังได้
 *
 * ข้อมูลนี้เป็นความเห็นของครู ไม่ใช่คะแนนวิชาการ จึงเก็บแยกชีต
 * และไม่แสดงให้นักเรียนเห็น ตามแผนข้อ 9 ที่ห้ามประกาศสถานะ
 * ต้องการความช่วยเหลือต่อหน้าชั้นเรียน
 * ══════════════════════════════════════════════════════════════════ */

/** Migration แบบเพิ่มอย่างเดียวตาม Blueprint #123 */
function ensureObservationSheet_() {
  const spreadsheet = getSpreadsheet_();
  const existing = spreadsheet.getSheetByName('Observation');
  if (existing) return existing;

  const sheet = spreadsheet.insertSheet('Observation');
  const headers = SHEET_SCHEMAS.Observation;
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground('#43105b')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

/** คะแนนต้องอยู่ในช่วง 1–3 หรือเป็น 0 เมื่อครูยังไม่ได้ให้ */
function clampObservationLevel_(value) {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 3) return 0;
  return level;
}

function readObservation_(username) {
  const blank = { predict: 0, experiment: 0, debug: 0, teamwork: 0,
                  note: '', updatedAt: null, updatedBy: '' };
  const sheet = getSpreadsheet_().getSheetByName('Observation');
  if (!sheet) return blank;

  const row = readDataObjects_(sheet).filter(function (item) {
    return String(item.username) === username;
  })[0];
  if (!row) return blank;

  return {
    predict: clampObservationLevel_(row.predict),
    experiment: clampObservationLevel_(row.experiment),
    debug: clampObservationLevel_(row.debug),
    teamwork: clampObservationLevel_(row.teamwork),
    note: sanitizePlainText_(row.note, 400),
    updatedAt: serializeDate_(row.updatedAt),
    updatedBy: String(row.updatedBy || '')
  };
}

/** ครูบันทึกผลการสังเกตของนักเรียนหนึ่งคน */
function saveObservation(token, username, scores, note) {
  const session = requireRole_(token, 'admin');
  const target = normalizeUsername_(username);
  const user = findUser_(target);

  if (!user || user.role !== 'student') {
    throw new Error('ไม่พบบัญชีนักเรียน');
  }

  const input = scores && typeof scores === 'object' ? scores : {};
  const clean = {};
  OBSERVATION_ASPECTS.forEach(function (aspect) {
    clean[aspect.key] = clampObservationLevel_(input[aspect.key]);
  });
  const comment = sanitizePlainText_(note, 400).trim();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = ensureObservationSheet_();
    const before = readObservation_(target);
    const now = new Date();
    const values = [
      target, clean.predict, clean.experiment, clean.debug, clean.teamwork,
      comment, now, session.username
    ];

    const row = findRowByValue_(sheet, 1, target);
    if (row < 2) {
      sheet.appendRow(values);
    } else {
      sheet.getRange(row, 1, 1, values.length).setValues([values]);
    }

    appendAudit_(
      session.username,
      'observation_save',
      'success',
      target +
        ' | ก่อน ' + describeObservation_(before) +
        ' | หลัง ' + describeObservation_(clean)
    );

    return { ok: true, username: target, observation: readObservation_(target) };
  } finally {
    lock.releaseLock();
  }
}

function describeObservation_(scores) {
  return OBSERVATION_ASPECTS.map(function (aspect) {
    return aspect.label + ' ' + (Number(scores[aspect.key]) || 0);
  }).join(' ');
}

/** Serves the student and administrator web app. */
function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  template.webAppUrl = ScriptApp.getService().getUrl() || '';
  return template
    .evaluate()
    .setTitle(APP_CONFIG.appTitle)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Returns non-sensitive course metadata for the login screen. */
function getPublicConfig() {
  return {
    appTitle: APP_CONFIG.appTitle,
    subject: APP_CONFIG.subject,
    grade: APP_CONFIG.grade,
    academicYear: APP_CONFIG.academicYear,
    semester: APP_CONFIG.semester,
    teacherName: APP_CONFIG.teacherName,
    schoolName: APP_CONFIG.schoolName,
    quizQuestionCount: APP_CONFIG.quizQuestionCount,
    quizPassPercent: APP_CONFIG.quizPassPercent,
    quizMaxAttempts: APP_CONFIG.quizMaxAttempts,
    sections: LESSON_SECTIONS.map(function (section) {
      return {
        order: section.order,
        id: section.id,
        title: section.title,
        required: section.required
      };
    }),
    // ยอด XP และจำนวนเหรียญสูงสุด คำนวณจากค่าที่ตั้งไว้จริง
    // หน้าแรกจะได้ไม่ต้องเขียนตัวเลขตายตัว แล้วเพี้ยนเมื่อเพิ่มกิจกรรม
    maxXp: LESSON_SECTION_COUNT * APP_CONFIG.xpPerSection +
      APP_CONFIG.xpQuizPass + APP_CONFIG.xpPerfectQuiz +
      LESSON_OPTIONAL_STEPS.reduce(function (sum, step) {
        return sum + (Number(step.xpReward) || 0);
      }, 0),
    // 6 เหรียญจากเส้นทางหลัก บวกเหรียญประจำกิจกรรมเสริมแต่ละอย่าง
    maxBadges: 6 + LESSON_OPTIONAL_STEPS.length,
    optionalSteps: LESSON_OPTIONAL_STEPS.map(function (step) {
      return {
        id: step.id,
        title: step.title,
        kind: step.kind,
        unlockAfter: step.unlockAfter,
        xpReward: step.xpReward,
        required: false
      };
    })
  };
}

/**
 * One-time installer. Creates a private Drive folder, spreadsheet, tabs,
 * and the seven student records. It is safe to run again after completion.
 */
function setupSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const properties = PropertiesService.getScriptProperties();
    const existingSpreadsheetId = properties.getProperty(APP_CONFIG.spreadsheetProperty);
    const existingFolderId = properties.getProperty(APP_CONFIG.driveFolderProperty);

    if (existingSpreadsheetId && existingFolderId) {
      return getSetupStatus_();
    }

    const initialPassword = properties.getProperty(APP_CONFIG.initialPasswordProperty);
    if (!initialPassword) {
      throw new Error(
        'กรุณาตั้ง Script property ชื่อ INITIAL_STUDENT_PASSWORD ก่อนเรียก setupSystem()'
      );
    }
    validateStudentPassword_(initialPassword);

    const folder = DriveApp.createFolder(
      'Tilt Lab ม.1 ภาคเรียนที่ 1 ปีการศึกษา 2569'
    );
    const spreadsheet = SpreadsheetApp.create(
      'ฐานข้อมูล Tilt Lab ม.1 — ภาคเรียนที่ 1/2569'
    );
    DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);

    properties.setProperties({
      [APP_CONFIG.spreadsheetProperty]: spreadsheet.getId(),
      [APP_CONFIG.driveFolderProperty]: folder.getId()
    });

    initializeSheets_(spreadsheet);
    seedStudents_(spreadsheet, initialPassword);
    seedSettings_(spreadsheet, folder);

    // Plaintext exists only in a temporary Script property during setup.
    properties.deleteProperty(APP_CONFIG.initialPasswordProperty);
    appendAudit_('system', 'setup', 'success', 'สร้างระบบและบัญชีนักเรียน 7 บัญชี');

    return getSetupStatus_();
  } catch (error) {
    try {
      appendAudit_('system', 'setup', 'failed', safeErrorMessage_(error));
    } catch (ignored) {
      // The spreadsheet may not exist yet, so audit logging can legitimately fail here.
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates or resets the administrator account from a temporary Script property.
 * The plaintext password is removed immediately after its salted hash is stored.
 */
function setupAdminAccount() {
  const properties = PropertiesService.getScriptProperties();
  const password = String(
    properties.getProperty(APP_CONFIG.adminPasswordProperty) || ''
  );

  if (!password) {
    throw new Error('กรุณาตั้ง INITIAL_ADMIN_PASSWORD ใน Script properties');
  }

  validateNewPassword_(password);

  const salt = createSalt_();
  upsertUser_({
    username: APP_CONFIG.adminUsername,
    role: 'admin',
    studentNumber: '',
    displayName: APP_CONFIG.teacherName,
    passwordHash: hashPassword_(password, salt),
    salt: salt,
    active: true,
    mustChangePassword: false
  });

  properties.deleteProperty(APP_CONFIG.adminPasswordProperty);
  appendAudit_(
    APP_CONFIG.adminUsername,
    'admin_setup',
    'success',
    'สร้างหรือรีเซ็ตบัญชีแอดมิน'
  );

  return {
    ok: true,
    username: APP_CONFIG.adminUsername,
    displayName: APP_CONFIG.teacherName
  };
}

/** Authenticates a student or administrator and returns a short-lived token. */
function login(payload) {
  const input = payload || {};
  const username = normalizeUsername_(input.username);
  const password = String(input.password || '');

  if (!/^[a-z0-9._-]{4,40}$/.test(username) || password.length < 1 || password.length > 128) {
    return { ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  const rateKey = 'login-fail:' + username;
  const cache = CacheService.getScriptCache();
  const failedCount = Number(cache.get(rateKey) || 0);
  if (failedCount >= APP_CONFIG.maxFailedLogins) {
    appendAudit_(username, 'login', 'blocked', 'ลองรหัสผ่านผิดเกินกำหนด');
    return {
      ok: false,
      message: 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ 10 นาทีแล้วลองใหม่'
    };
  }

  const user = findUser_(username);
  const authenticated = user && user.active &&
    constantTimeEqual_(hashPassword_(password, user.salt), user.passwordHash);

  if (!authenticated) {
    cache.put(
      rateKey,
      String(failedCount + 1),
      APP_CONFIG.failedLoginWindowSeconds
    );
    appendAudit_(username || 'unknown', 'login', 'failed', 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
    return { ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  cache.remove(rateKey);
  const token = createSession_(user);
  appendAudit_(username, 'login', 'success', user.role);

  return {
    ok: true,
    token: token,
    user: publicUser_(user),
    mustChangePassword: user.mustChangePassword
  };
}

/** Removes a session token from both the durable store and the cache. */
function logout(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (normalizedToken) {
    deleteSession_(normalizedToken);
  }
  return { ok: true };
}

/** Returns the signed-in user's safe profile, or null if the session expired. */
function getCurrentUser(token) {
  const session = requireSession_(token);
  return { ok: true, user: publicUser_(session), mustChangePassword: session.mustChangePassword };
}

/** Reads only the current student's own saved progress. */
function getProgress(token) {
  const session = requireSession_(token);

  if (session.preview) {
    const previewState = ensureProgressSyncMetadata_(readPreviewState_(token, session));
    return {
      ok: true,
      state: previewState,
      updatedAt: null,
      preview: true,
      previewMode: session.previewMode,
      rewards: computeRewards_(previewState)
    };
  }

  const row = findProgressRow_(session.username);

  if (!row) {
    return {
      ok: true,
      state: createDefaultProgress_(session),
      updatedAt: null,
      rewards: computeRewards_(createDefaultProgress_(session))
    };
  }

  let state;
  try {
    state = JSON.parse(row.progressJson);
  } catch (error) {
    appendAudit_(session.username, 'progress_read', 'failed', 'progressJson ไม่ถูกต้อง');
    throw new Error('ข้อมูลความก้าวหน้าเสียหาย กรุณาแจ้งครูผู้สอน');
  }
  ensureProgressSyncMetadata_(state);

  return {
    ok: true,
    state: state,
    updatedAt: row.updatedAt,
    rewards: computeRewards_(state)
  };
}

/** Validates and upserts the current student's progress. */
function saveProgress(token, state) {
  const session = requireSession_(token);

  // โหมดทดลองไม่เขียนลงชีตใด ๆ ตาม Blueprint #113
  if (session.preview) {
    const trustedPreviewState = readPreviewState_(token, session);
    const cleanState = validateProgressState_(state, session, trustedPreviewState);
    writePreviewState_(token, cleanState);
    return {
      ok: true,
      state: cleanState,
      updatedAt: new Date().toISOString(),
      preview: true,
      rewards: computeRewards_(cleanState)
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const progressRow = findProgressRow_(session.username);
    let trustedState = createDefaultProgress_(session);
    if (progressRow) {
      try {
        trustedState = JSON.parse(progressRow.progressJson);
      } catch (error) {
        appendAudit_(
          session.username,
          'progress_save',
          'failed',
          'progressJson ไม่ถูกต้อง'
        );
        throw new Error('ข้อมูลความก้าวหน้าเสียหาย กรุณาแจ้งครูผู้สอน');
      }
    }

    const cleanState = validateProgressState_(state, session, trustedState);
    const updatedAt = writeProgressStateRow_(session.username, cleanState);
    appendAudit_(session.username, 'progress_save', 'success', 'Section ' + cleanState.currentSection);
    return {
      ok: true,
      state: cleanState,
      updatedAt: updatedAt,
      rewards: computeRewards_(cleanState)
    };
  } finally {
    lock.releaseLock();
  }
}

/** ปิด API รุ่นเดิมซึ่งเคยรับคะแนนและจำนวนครั้งจาก client โดยตรง */
function recordQuizAttempt(token) {
  requireSession_(token);
  throw new Error('API รุ่นเดิมถูกปิดแล้ว กรุณารีเฟรชหน้าเว็บ');
}

/**
 * API ส่งแบบทดสอบรุ่นปลอดภัย — DIFF-02A
 * รับเฉพาะคำตอบกับ submissionId แล้วตรวจคะแนน/จำนวนครั้งที่เซิร์ฟเวอร์
 * submissionId ทำให้คำขอเดิมส่งซ้ำเพื่อซ่อม Attempts ได้โดยไม่นับครั้งเพิ่ม
 */
function submitQuizAttemptV2(token, payload) {
  const session = requireSession_(token);
  const input = payload || {};
  const submissionId = validateQuizSubmissionId_(input.submissionId);
  const answers = validateQuizAnswers_(input.answers, true);

  if (session.preview) {
    const previewState = readPreviewState_(token, session);
    assertProgressSyncRevision_(input.syncRevision, previewState);
    const previewOutcome = applyQuizAttemptToState_(
      previewState,
      session,
      answers,
      submissionId
    );
    writePreviewState_(token, previewOutcome.state);
    return buildQuizSubmitResponse_(previewOutcome, null, true, false);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const progressRow = findProgressRow_(session.username);
    let savedState = createDefaultProgress_(session);

    if (progressRow) {
      try {
        savedState = JSON.parse(progressRow.progressJson);
      } catch (error) {
        appendAudit_(
          session.username,
          'quiz_submit_v2',
          'failed',
          'progressJson ไม่ถูกต้อง'
        );
        throw new Error('ข้อมูลความก้าวหน้าเสียหาย กรุณาแจ้งครูผู้สอน');
      }
    }

    assertProgressSyncRevision_(input.syncRevision, savedState);

    const outcome = applyQuizAttemptToState_(
      savedState,
      session,
      answers,
      submissionId
    );
    const attemptsSheet = getSpreadsheet_().getSheetByName('Attempts');
    if (
      !outcome.duplicate &&
      quizSubmissionExists_(attemptsSheet, session.username, submissionId)
    ) {
      throw new Error('รหัสการส่งนี้เคยถูกบันทึกแล้ว ระบบจึงไม่นับซ้ำ');
    }

    const updatedAt = writeProgressStateRow_(session.username, outcome.state);
    const attemptLogCreated = appendQuizAttemptRow_(
      attemptsSheet,
      session.username,
      outcome
    );

    appendAudit_(
      session.username,
      'quiz_submit_v2',
      outcome.duplicate ? 'duplicate' : 'success',
      outcome.score + '/' + APP_CONFIG.quizQuestionCount +
        ' ครั้งที่ ' + outcome.attemptNumber
    );

    return buildQuizSubmitResponse_(
      outcome,
      updatedAt,
      false,
      attemptLogCreated
    );
  } finally {
    lock.releaseLock();
  }
}

function validateQuizSubmissionId_(value) {
  const submissionId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(submissionId)) {
    throw new Error('รหัสการส่งแบบทดสอบไม่ถูกต้อง กรุณาลองส่งอีกครั้ง');
  }
  return submissionId;
}

function validateQuizAnswers_(answers, requireAll) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('รูปแบบคำตอบแบบทดสอบไม่ถูกต้อง');
  }

  const questionIds = Object.keys(QUIZ_ANSWER_KEY);
  const submittedIds = Object.keys(answers);
  submittedIds.forEach(function (questionId) {
    const question = QUIZ_ANSWER_KEY[questionId];
    if (!question) {
      throw new Error('พบข้อคำถามที่ระบบไม่รู้จัก');
    }
    if (
      typeof answers[questionId] !== 'string' ||
      question.choices.indexOf(answers[questionId]) < 0
    ) {
      throw new Error('ตัวเลือกของ ' + questionId + ' ไม่ถูกต้อง');
    }
  });

  if (requireAll && submittedIds.length !== questionIds.length) {
    throw new Error('ต้องตอบให้ครบทุกข้อก่อนส่ง');
  }

  const cleanAnswers = {};
  questionIds.forEach(function (questionId) {
    if (Object.prototype.hasOwnProperty.call(answers, questionId)) {
      cleanAnswers[questionId] = answers[questionId];
    } else if (requireAll) {
      throw new Error('ต้องตอบให้ครบทุกข้อก่อนส่ง');
    }
  });
  return cleanAnswers;
}

function normalizeStoredQuiz_(quiz) {
  const source = quiz && typeof quiz === 'object' && !Array.isArray(quiz)
    ? quiz
    : {};
  let answers = {};
  let lastSubmissionId = '';
  let lastSubmissionAnswers = {};

  try {
    answers = validateQuizAnswers_(source.answers || {}, false);
  } catch (error) {
    answers = {};
  }
  try {
    lastSubmissionId = source.lastSubmissionId
      ? validateQuizSubmissionId_(source.lastSubmissionId)
      : '';
  } catch (error) {
    lastSubmissionId = '';
  }
  if (lastSubmissionId) {
    try {
      lastSubmissionAnswers = validateQuizAnswers_(
        source.lastSubmissionAnswers || source.answers || {},
        true
      );
    } catch (error) {
      lastSubmissionAnswers = {};
    }
  }

  const latestScore = clampInteger_(
    source.latestScore,
    0,
    APP_CONFIG.quizQuestionCount
  );
  const bestScore = clampInteger_(
    source.bestScore,
    latestScore,
    APP_CONFIG.quizQuestionCount
  );
  const attempts = clampInteger_(
    source.attempts,
    0,
    APP_CONFIG.quizMaxAttempts
  );
  const results = buildQuizResults_(answers);

  return {
    answers: answers,
    results: results,
    latestScore: latestScore,
    bestScore: bestScore,
    attempts: attempts,
    locked: Boolean(source.locked),
    lastSubmissionId: lastSubmissionId,
    lastSubmissionAnswers: lastSubmissionAnswers
  };
}

function buildQuizResults_(answers) {
  const results = {};
  Object.keys(QUIZ_ANSWER_KEY).forEach(function (questionId) {
    if (!Object.prototype.hasOwnProperty.call(answers || {}, questionId)) return;
    const selected = answers[questionId];
    results[questionId] = {
      selected: selected,
      correct: selected === QUIZ_ANSWER_KEY[questionId].answer,
      correctChoice: QUIZ_ANSWER_KEY[questionId].answer
    };
  });
  return results;
}

function sameQuizAnswers_(left, right) {
  const questionIds = Object.keys(QUIZ_ANSWER_KEY);
  return questionIds.every(function (questionId) {
    return left[questionId] === right[questionId];
  });
}

/** Pure helper เพื่อให้ทดสอบกติกาคะแนนได้โดยไม่เรียก Google services */
function applyQuizAttemptToState_(state, session, answers, submissionId) {
  const nextState = state && typeof state === 'object' && !Array.isArray(state)
    ? JSON.parse(JSON.stringify(state))
    : createDefaultProgress_(session);
  const cleanAnswers = validateQuizAnswers_(answers, true);
  const cleanSubmissionId = validateQuizSubmissionId_(submissionId);
  const previousQuiz = normalizeStoredQuiz_(nextState.quiz);
  const completedBefore = contiguousCompleted_(nextState.completedSections || []);
  const requiredBeforeQuiz = QUIZ_SECTION_ORDER - 1;
  const doneBeforeQuiz = session.previewMode === 'free'
    ? requiredBeforeQuiz
    : completedBefore.length;

  if (doneBeforeQuiz < requiredBeforeQuiz) {
    throw new Error(
      'กรุณาทำกิจกรรม Section 1–' + requiredBeforeQuiz +
        ' ให้ครบก่อนส่งแบบทดสอบ (ตอนนี้ครบ ' + doneBeforeQuiz + ' ขั้น)'
    );
  }

  if (previousQuiz.lastSubmissionId === cleanSubmissionId) {
    if (!sameQuizAnswers_(previousQuiz.lastSubmissionAnswers, cleanAnswers)) {
      throw new Error('รหัสการส่งนี้ถูกใช้กับคำตอบชุดอื่นแล้ว กรุณาเริ่มส่งใหม่');
    }
    const duplicateResults = buildQuizResults_(cleanAnswers);
    nextState.quiz = Object.assign({}, previousQuiz, {
      answers: cleanAnswers,
      results: duplicateResults,
      locked: true
    });
    return {
      state: nextState,
      answers: cleanAnswers,
      results: duplicateResults,
      score: previousQuiz.latestScore,
      bestScore: previousQuiz.bestScore,
      attemptNumber: previousQuiz.attempts,
      passed: previousQuiz.latestScore >= QUIZ_PASS_MARK,
      completed: (nextState.completedSections || []).indexOf(QUIZ_SECTION_ORDER) >= 0,
      locked: previousQuiz.locked,
      submissionId: cleanSubmissionId,
      duplicate: true
    };
  }

  if (previousQuiz.attempts >= APP_CONFIG.quizMaxAttempts) {
    throw new Error('ใช้สิทธิ์ทำแบบทดสอบครบ ' + APP_CONFIG.quizMaxAttempts + ' ครั้งแล้ว');
  }

  const results = buildQuizResults_(cleanAnswers);
  const score = Object.keys(results).reduce(function (total, questionId) {
    return total + (results[questionId].correct ? 1 : 0);
  }, 0);

  const attemptNumber = previousQuiz.attempts + 1;
  const bestScore = Math.max(previousQuiz.bestScore, score);
  const passed = score >= QUIZ_PASS_MARK;
  const quizStepDone = passed || attemptNumber >= APP_CONFIG.quizMaxAttempts;
  const completedSections = session.previewMode === 'free'
    ? Array.from(new Set((nextState.completedSections || []).map(Number)))
    : completedBefore.slice();

  if (quizStepDone && completedSections.indexOf(QUIZ_SECTION_ORDER) < 0) {
    completedSections.push(QUIZ_SECTION_ORDER);
  }
  completedSections.sort(function (left, right) { return left - right; });

  nextState.version = APP_CONFIG.stateVersion;
  nextState.username = session.username;
  nextState.currentSection = QUIZ_SECTION_ORDER;
  nextState.completedSections = completedSections;
  nextState.quiz = {
    answers: cleanAnswers,
    results: results,
    latestScore: score,
    bestScore: bestScore,
    attempts: attemptNumber,
    locked: true,
    lastSubmissionId: cleanSubmissionId,
    lastSubmissionAnswers: cleanAnswers
  };

  return {
    state: nextState,
    answers: cleanAnswers,
    results: results,
    score: score,
    bestScore: bestScore,
    attemptNumber: attemptNumber,
    passed: passed,
    completed: quizStepDone,
    locked: true,
    submissionId: cleanSubmissionId,
    duplicate: false
  };
}

function writeProgressStateRow_(username, state) {
  const json = JSON.stringify(state);
  if (json.length > APP_CONFIG.maxProgressJsonLength) {
    throw new Error('ข้อมูลความก้าวหน้ามีขนาดใหญ่เกินกำหนด');
  }

  const sheet = getSpreadsheet_().getSheetByName('Progress');
  const existing = findRowByValue_(sheet, 1, username);
  const quiz = normalizeStoredQuiz_(state.quiz);
  const now = new Date();
  const rowValues = [
    username,
    APP_CONFIG.stateVersion,
    json,
    state.currentSection,
    quiz.latestScore,
    quiz.bestScore,
    quiz.attempts,
    now
  ];

  if (existing > 0) {
    sheet.getRange(existing, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return now.toISOString();
}

function ensureAttemptsSubmissionIdColumn_(sheet) {
  const header = 'submissionId';
  const expectedColumn = SHEET_SCHEMAS.Attempts.indexOf(header) + 1;
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(String);
  const existingIndex = headers.indexOf(header);
  if (existingIndex >= 0) return existingIndex + 1;

  const targetColumn = expectedColumn > lastColumn ? expectedColumn : lastColumn + 1;
  sheet.getRange(1, targetColumn)
    .setValue(header)
    .setBackground('#6d1a8d')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  return targetColumn;
}

function appendQuizAttemptRow_(sheet, username, outcome) {
  const submissionColumn = ensureAttemptsSubmissionIdColumn_(sheet);
  const lastRow = sheet.getLastRow();

  if (quizSubmissionExists_(sheet, username, outcome.submissionId, submissionColumn)) {
    return false;
  }

  const width = Math.max(sheet.getLastColumn(), submissionColumn);
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(String);
  const data = {
    timestamp: new Date(),
    username: username,
    assessment: 'final_quiz',
    score: outcome.score,
    maximumScore: APP_CONFIG.quizQuestionCount,
    attemptNumber: outcome.attemptNumber,
    answersJson: JSON.stringify(outcome.answers),
    submissionId: outcome.submissionId
  };
  const rowValues = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(data, header) ? data[header] : '';
  });
  sheet.getRange(lastRow + 1, 1, 1, rowValues.length).setValues([rowValues]);
  return true;
}

function quizSubmissionExists_(sheet, username, submissionId, submissionColumn) {
  const idColumn = submissionColumn || ensureAttemptsSubmissionIdColumn_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const usernames = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  const submissionIds = sheet
    .getRange(2, idColumn, lastRow - 1, 1)
    .getDisplayValues();
  for (let index = 0; index < lastRow - 1; index += 1) {
    if (
      String(usernames[index][0]) === String(username) &&
      String(submissionIds[index][0]) === String(submissionId)
    ) {
      return true;
    }
  }
  return false;
}

function buildQuizSubmitResponse_(outcome, updatedAt, preview, attemptLogCreated) {
  return {
    ok: true,
    preview: Boolean(preview),
    duplicate: Boolean(outcome.duplicate),
    attemptLogCreated: Boolean(attemptLogCreated),
    submissionId: outcome.submissionId,
    score: outcome.score,
    maximumScore: APP_CONFIG.quizQuestionCount,
    attemptNumber: outcome.attemptNumber,
    bestScore: outcome.bestScore,
    passed: outcome.passed,
    completed: outcome.completed,
    locked: outcome.locked,
    results: outcome.results,
    state: outcome.state,
    updatedAt: updatedAt,
    rewards: computeRewards_(outcome.state)
  };
}

/** Administrator-only roster, progress summary, and storage links. */
function getAdminDashboard(token) {
  const session = requireRole_(token, 'admin');
  const students = buildStudentDashboardRows_();
  const setup = getSetupStatus_();

  appendAudit_(
    session.username,
    'admin_dashboard',
    'success',
    'อ่านข้อมูลนักเรียน ' + students.length + ' คน'
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    spreadsheetUrl: setup.spreadsheetUrl,
    driveFolderUrl: setup.driveFolderUrl,
    // ครูต้องเห็นว่าข้อมูลถูกสำรองไว้ล่าสุดเมื่อไร ไม่ใช่เดาเอง
    backup: backupStatus_(),
    // ฝั่งหน้าเว็บเคยเขียนเลข 8 ไว้ตายตัว พอเพิ่มขั้นสะท้อนผลเป็น 9 เลขจึงเพี้ยน
    totalSections: LESSON_SECTION_COUNT,
    students: students
  };
}

/**
 * Teacher Preview Mode — Blueprint #78 และ #113
 * สร้าง Synthetic Session ที่แยกขาดจากข้อมูลนักเรียนจริง
 * ความก้าวหน้าของโหมดนี้เก็บใน CacheService และ Script Properties
 * ไม่เขียนลงชีตใด ๆ และล้างพร้อม synthetic session
 * จึงไม่มีทางไปปนกับ Progress, Attempts หรือคะแนนของนักเรียน
 *
 * mode 'normal' คือเดินตามลำดับเหมือนนักเรียนจริง
 * mode 'free' คือเปิดทุกขั้นให้ครูกระโดดไปดูจุดใดก็ได้ ตาม #79
 */
function startTeacherPreview(token, mode) {
  const session = requireRole_(token, 'admin');
  const previewMode = String(mode) === 'free' ? 'free' : 'normal';
  const previewToken = createPreviewSession_(session.username, previewMode);

  appendAudit_(
    session.username,
    'preview_start',
    'success',
    'เปิดโหมดทดลองแบบ ' + previewMode
  );

  return {
    ok: true,
    token: previewToken,
    mode: previewMode,
    user: {
      username: APP_CONFIG.previewUsername,
      role: 'student',
      studentNumber: '—',
      displayName: 'โหมดทดลองของครู'
    }
  };
}

/** ล้างความก้าวหน้าของโหมดทดลอง ตาม Blueprint #80 Reset Preview */
function resetTeacherPreview(token) {
  const session = requireSession_(token);
  if (!session.preview) {
    throw new Error('ใช้ได้เฉพาะในโหมดทดลอง');
  }
  deletePreviewState_(token);
  appendAudit_(session.actor || 'admin', 'preview_reset', 'success', 'ล้างข้อมูลโหมดทดลอง');
  return { ok: true };
}

function createPreviewSession_(actor, previewMode) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const session = {
    username: APP_CONFIG.previewUsername,
    role: 'student',
    studentNumber: '—',
    displayName: 'โหมดทดลองของครู',
    mustChangePassword: false,
    preview: true,
    previewMode: previewMode,
    actor: actor,
    issuedAt: new Date().toISOString()
  };
  purgeExpiredSessions_();
  storeSession_(token, session);
  return token;
}

function previewStateKey_(token) {
  return 'previewState:' + validateTokenFormat_(token);
}

function previewStatePropertyBase_(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (!normalizedToken) {
    throw new Error('SESSION_EXPIRED');
  }
  // ใช้ storage id เดียวกับ session เพื่อให้ purge ลบ state ที่หมดอายุได้
  // โดยไม่ต้องเก็บ token จริงไว้ในชื่อ property
  return APP_CONFIG.previewStatePropertyPrefix +
    hashPassword_(normalizedToken, 'session');
}

function previewStateMetadataKey_(base) {
  return base + '_META';
}

function previewStateChunkKey_(base, index) {
  return base + '_CHUNK_' + index;
}

function parsePreviewStateJson_(json) {
  if (!json) return null;
  try {
    const state = JSON.parse(json);
    return state && typeof state === 'object' && !Array.isArray(state)
      ? state
      : null;
  } catch (error) {
    return null;
  }
}

/** อ่านสำเนาคงทนและตรวจความครบของทุกชิ้นก่อนยอมรับ */
function readDurablePreviewStateJson_(token) {
  const properties = PropertiesService.getScriptProperties();
  const base = previewStatePropertyBase_(token);
  const metadataJson = properties.getProperty(previewStateMetadataKey_(base));
  if (!metadataJson) return '';

  try {
    const metadata = JSON.parse(metadataJson);
    const chunkCount = Number(metadata.chunks);
    const expectedLength = Number(metadata.length);
    const maximumChunks = Math.ceil(
      APP_CONFIG.maxProgressJsonLength / APP_CONFIG.previewStateChunkCodePoints
    );

    if (
      metadata.version !== 1 ||
      !Number.isInteger(chunkCount) ||
      chunkCount < 1 ||
      chunkCount > maximumChunks ||
      !Number.isInteger(expectedLength) ||
      expectedLength < 1 ||
      expectedLength > APP_CONFIG.maxProgressJsonLength
    ) {
      return '';
    }

    let json = '';
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = properties.getProperty(previewStateChunkKey_(base, index));
      if (chunk === null) return '';
      json += chunk;
    }

    if (
      json.length !== expectedLength ||
      !constantTimeEqual_(
        hashPassword_(json, 'preview-state'),
        String(metadata.digest || '')
      )
    ) {
      return '';
    }
    return json;
  } catch (error) {
    return '';
  }
}

/** เขียน state แบบแบ่งตาม code point เพื่อไม่ตัดอีโมจิและไม่เกิน 9 KB ต่อ property */
function writeDurablePreviewStateJson_(token, json) {
  if (json.length > APP_CONFIG.maxProgressJsonLength) {
    throw new Error('ข้อมูลความก้าวหน้ามีขนาดใหญ่เกินกำหนด');
  }

  const properties = PropertiesService.getScriptProperties();
  const base = previewStatePropertyBase_(token);
  const symbols = Array.from(json);
  const chunks = [];
  for (
    let offset = 0;
    offset < symbols.length;
    offset += APP_CONFIG.previewStateChunkCodePoints
  ) {
    chunks.push(
      symbols
        .slice(offset, offset + APP_CONFIG.previewStateChunkCodePoints)
        .join('')
    );
  }

  const values = {};
  chunks.forEach(function (chunk, index) {
    values[previewStateChunkKey_(base, index)] = chunk;
  });
  values[previewStateMetadataKey_(base)] = JSON.stringify({
    version: 1,
    chunks: chunks.length,
    length: json.length,
    digest: hashPassword_(json, 'preview-state')
  });

  const previousValues = properties.getProperties();
  properties.setProperties(values, false);

  // ลบชิ้นส่วนเก่าที่เหลือเมื่อ state รอบใหม่สั้นลง
  Object.keys(previousValues).forEach(function (key) {
    if (
      key.indexOf(base + '_CHUNK_') === 0 &&
      !Object.prototype.hasOwnProperty.call(values, key)
    ) {
      properties.deleteProperty(key);
    }
  });
}

function deletePreviewStatePropertiesByBase_(base, properties) {
  const values = properties.getProperties();
  const metadataKey = previewStateMetadataKey_(base);
  Object.keys(values).forEach(function (key) {
    if (key === metadataKey || key.indexOf(base + '_CHUNK_') === 0) {
      properties.deleteProperty(key);
    }
  });
}

function deletePreviewState_(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (!normalizedToken) return;
  CacheService.getScriptCache().remove(previewStateKey_(normalizedToken));
  const properties = PropertiesService.getScriptProperties();
  deletePreviewStatePropertiesByBase_(
    previewStatePropertyBase_(normalizedToken),
    properties
  );
}

function readPreviewState_(token, session) {
  const cache = CacheService.getScriptCache();
  const cacheKey = previewStateKey_(token);
  const cachedJson = cache.get(cacheKey);
  const cachedState = parsePreviewStateJson_(cachedJson);
  if (cachedState) return cachedState;
  if (cachedJson) cache.remove(cacheKey);

  const durableJson = readDurablePreviewStateJson_(token);
  const durableState = parsePreviewStateJson_(durableJson);
  if (!durableState) return createDefaultProgress_(session);

  // Cache เป็นตัวเร่งเท่านั้น ถ้าใส่ไม่ได้ยังใช้ durable state ต่อได้
  try {
    cache.put(cacheKey, durableJson, APP_CONFIG.sessionTtlSeconds);
  } catch (error) {
    // Durable state is already the source of truth.
  }
  return durableState;
}

function writePreviewState_(token, state) {
  const json = JSON.stringify(state);
  writeDurablePreviewStateJson_(token, json);

  // เขียน durable store ก่อนเสมอ ป้องกันการแจ้งว่าบันทึกแล้วทั้งที่มีแต่ cache
  const cache = CacheService.getScriptCache();
  const cacheKey = previewStateKey_(token);
  cache.remove(cacheKey);
  try {
    cache.put(cacheKey, json, APP_CONFIG.sessionTtlSeconds);
  } catch (error) {
    // Cache มีขีดจำกัดและอาจปฏิเสธค่าได้ แต่ Script Properties บันทึกแล้ว
  }
}

/**
 * Administrator-only item analysis — Blueprint #76 Learning Analytics และ #196
 * รวมคำตอบครั้งล่าสุดของนักเรียนแต่ละคน แล้วนับว่าแต่ละตัวเลือกถูกเลือกกี่ครั้ง
 * เฉลยส่งผ่าน API นี้ได้เฉพาะผู้ดูแลระบบ หน้าเว็บทั่วไปจึงไม่ต้องฝัง answer key
 */
function getQuizItemStats(token) {
  const session = requireRole_(token, 'admin');

  const latestByStudent = {};
  readDataObjects_(getSpreadsheet_().getSheetByName('Attempts')).forEach(
    function (row) {
      const username = String(row.username || '');
      if (!username) return;
      // แถวท้ายสุดของแต่ละคนคือครั้งล่าสุดเสมอ เพราะชีตต่อแถวตามเวลา
      // ห้ามเทียบด้วย attemptNumber เพราะค่าจะเริ่มนับใหม่หลังครูรีเซ็ตคะแนน
      latestByStudent[username] = {
        attemptNumber: Number(row.attemptNumber) || 0,
        answersJson: String(row.answersJson || '{}'),
        score: Number(row.score) || 0
      };
    }
  );

  const choiceCounts = {};
  const scores = [];
  let respondents = 0;

  Object.keys(latestByStudent).forEach(function (username) {
    const entry = latestByStudent[username];
    let answers = {};
    try {
      const parsed = JSON.parse(entry.answersJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        answers = parsed;
      }
    } catch (error) {
      answers = {};
    }

    respondents += 1;
    scores.push(entry.score);

    Object.keys(answers).forEach(function (questionId) {
      const choice = String(answers[questionId]);
      if (!choiceCounts[questionId]) choiceCounts[questionId] = {};
      choiceCounts[questionId][choice] =
        (choiceCounts[questionId][choice] || 0) + 1;
    });
  });

  const averageScore = scores.length
    ? scores.reduce(function (sum, value) { return sum + value; }, 0) / scores.length
    : 0;
  const correctChoices = {};
  Object.keys(QUIZ_ANSWER_KEY).forEach(function (questionId) {
    correctChoices[questionId] = QUIZ_ANSWER_KEY[questionId].answer;
  });

  appendAudit_(
    session.username,
    'item_analysis',
    'success',
    'วิเคราะห์รายข้อจากนักเรียน ' + respondents + ' คน'
  );

  return {
    ok: true,
    respondents: respondents,
    averageScore: Math.round(averageScore * 100) / 100,
    maximumScore: APP_CONFIG.quizQuestionCount,
    choiceCounts: choiceCounts,
    correctChoices: correctChoices
  };
}

/**
 * Administrator-only student detail — Blueprint #77 Student Detail
 * คืนประวัติการส่งแบบทดสอบรายครั้งพร้อมคำตอบรายข้อ และความก้าวหน้าตามขั้น
 * ข้อมูลนี้มีอยู่ในชีต Attempts อยู่แล้ว เพียงแต่ยังไม่เคยมีหน้าจอแสดง
 * ไม่คืนรหัสผ่าน hash หรือ salt ตาม Blueprint #184
 */
function getStudentDetail(token, username) {
  const session = requireRole_(token, 'admin');
  const target = normalizeUsername_(username);
  const user = findUser_(target);

  if (!user || user.role !== 'student') {
    throw new Error('ไม่พบบัญชีนักเรียน');
  }

  const attempts = readDataObjects_(
    getSpreadsheet_().getSheetByName('Attempts')
  )
    .filter(function (row) {
      return String(row.username) === target;
    })
    .map(function (row) {
      let answers = {};
      try {
        const parsed = JSON.parse(String(row.answersJson || '{}'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          answers = parsed;
        }
      } catch (error) {
        answers = {};
      }
      return {
        timestamp: serializeDate_(row.timestamp),
        assessment: String(row.assessment || ''),
        score: Number(row.score) || 0,
        maximumScore: Number(row.maximumScore) || 0,
        attemptNumber: Number(row.attemptNumber) || 0,
        answers: answers,
        results: buildQuizResults_(answers)
      };
    });

  const progressRow = findProgressRow_(target);
  let state = null;
  if (progressRow) {
    try {
      state = JSON.parse(progressRow.progressJson);
    } catch (error) {
      state = null;
    }
  }

  const completed = contiguousCompleted_(state ? state.completedSections : []);
  const reflection = state && state.reflection ? state.reflection : {};

  appendAudit_(
    session.username,
    'student_detail',
    'success',
    'เปิดรายละเอียดของ ' + target
  );

  return {
    ok: true,
    username: target,
    displayName: user.displayName,
    studentNumber: user.studentNumber,
    completedSections: completed,
    unlockedSection: unlockedSection_(completed),
    sections: LESSON_SECTIONS.map(function (section) {
      return {
        order: section.order,
        title: section.title,
        done: completed.indexOf(section.order) !== -1
      };
    }),
    attempts: attempts,
    optionalSteps: optionalStepsStatus_(state),
    // แบบสังเกตพฤติกรรมตามแผนข้อ 10 ครูกรอกเองในหน้ารายละเอียด
    observation: readObservation_(target),
    observationAspects: OBSERVATION_ASPECTS.map(function (aspect) {
      return { key: aspect.key, label: aspect.label, levels: aspect.levels };
    }),
    // จดหมายถึงเพื่อนเป็นหลักฐานการเรียนรู้ที่ระบบตรวจอัตโนมัติไม่ได้
    // ครูต้องอ่านเอง ตาม Blueprint #199 และ #201
    missionLetter: sanitizePlainText_(
      state && state.worksheet && state.worksheet.mission
        ? state.worksheet.mission.letter
        : '',
      600
    ),
    reflection: {
      summary: sanitizePlainText_(reflection.summary, 500),
      confidence: sanitizePlainText_(reflection.confidence, 40)
    },
    rewards: computeRewards_(state),
    updatedAt: progressRow ? progressRow.updatedAt : null
  };
}

/**
 * สำเนาความก้าวหน้าที่ครบพอจะกู้คืนได้จริง ตาม Blueprint #227
 * ต้องเก็บคำตอบใน worksheet และ hookAnswers ด้วย ไม่ใช่เก็บแค่คะแนนกับเลขขั้น
 * เพราะระบบตัดสินว่านักเรียนทำขั้นไหนเสร็จจากคำตอบเหล่านี้
 * ถ้าเก็บไม่ครบ กู้คืนแล้วจะได้เลขขั้นกลับมาแต่คำตอบหายไป
 */
function buildProgressSnapshot_(state) {
  const source = state && typeof state === 'object' && !Array.isArray(state)
    ? state
    : {};

  return {
    quiz: source.quiz || null,
    completedSections: Array.isArray(source.completedSections)
      ? source.completedSections
      : [],
    currentSection: Number(source.currentSection) || 1,
    worksheet: source.worksheet || null,
    hookAnswers: source.hookAnswers || null,
    reflection: source.reflection || null
  };
}

/**
 * Administrator-only quiz reset — Soft Delete ตาม Blueprint #227
 * เก็บสำเนาคะแนนเดิมลงชีต QuizArchive ก่อนเสมอ จึงกู้คืนได้ด้วย restoreStudentQuiz()
 * ไม่ลบข้อมูลถาวร และไม่แตะชีต Attempts ที่เป็นประวัติการส่งทุกครั้ง
 * บันทึก Audit ครบตาม Blueprint #187 — ใคร ทำอะไร กับใคร ค่าก่อน ค่าหลัง เวลา เหตุผล
 */
function resetStudentQuiz(token, username, reason) {
  const session = requireRole_(token, 'admin');
  const target = normalizeUsername_(username);
  const note = sanitizePlainText_(reason, 200).trim();
  const user = findUser_(target);

  if (!user || user.role !== 'student') {
    throw new Error('ไม่พบบัญชีนักเรียน');
  }
  if (note.length < 5) {
    throw new Error('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร เพื่อบันทึกไว้ในประวัติการแก้ไข');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSpreadsheet_().getSheetByName('Progress');
    const row = findRowByValue_(sheet, 1, target);

    if (row < 2) {
      throw new Error('นักเรียนคนนี้ยังไม่มีคะแนนให้รีเซ็ต');
    }

    const current = sheet.getRange(row, 3, 1, 5).getValues()[0];
    const before = {
      latestScore: Number(current[2]) || 0,
      bestScore: Number(current[3]) || 0,
      attempts: Number(current[4]) || 0
    };

    let state = null;
    try {
      state = JSON.parse(String(current[0] || ''));
    } catch (error) {
      state = null;
    }
    // สำเนาต้องครอบคลุมทั้งคะแนนและความก้าวหน้ารายขั้น
    // ไม่เช่นนั้นกู้คืนแล้วจะได้คะแนนกลับมาแต่ขั้นที่ทำไปแล้วหายไป
    const snapshot = buildProgressSnapshot_(state);

    // Soft Delete — เก็บสำเนาก่อนเขียนทับเสมอ
    appendQuizArchive_(session.username, target, note, before, snapshot);

    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      state = createDefaultProgress_({ username: target });
    }
    state.quiz = createEmptyQuizState_();
    state.syncRevision = nextProgressSyncRevision_(state);
    state.syncMutation = 'quiz_reset';
    // ถอยขั้นแบบทดสอบเป็นต้นไป เพื่อให้ระบบพานักเรียนกลับมาทำใหม่
    state.completedSections = contiguousCompleted_(snapshot.completedSections)
      .filter(function (order) {
        return order < QUIZ_SECTION_ORDER;
      });
    state.currentSection = Math.min(
      snapshot.currentSection,
      unlockedSection_(state.completedSections)
    );
    // ต้องเขียนคอลัมน์ currentSection คู่กับ progressJson เสมอ
    // แดชบอร์ดครูอ่านเลขขั้นจากคอลัมน์นี้ ไม่ได้อ่านจากใน JSON
    // ถ้าเขียนแค่ JSON ครูจะเห็นเลขขั้นเดิมค้างอยู่ แล้วเข้าใจว่ารีเซ็ตไม่สำเร็จ
    sheet.getRange(row, 3, 1, 2).setValues([[
      JSON.stringify(state), state.currentSection
    ]]);

    sheet.getRange(row, 5, 1, 4).setValues([[0, 0, 0, new Date()]]);

    appendAudit_(
      session.username,
      'quiz_reset',
      'success',
      target +
        ' | ก่อน ' + before.latestScore + '/' + before.bestScore + '/' + before.attempts +
        ' | หลัง 0/0/0 | เหตุผล ' + note
    );

    return { ok: true, username: target, displayName: user.displayName, before: before };
  } finally {
    lock.releaseLock();
  }
}

/**
 * รีเซ็ตความก้าวหน้าทั้งบท ให้นักเรียนกลับไปเริ่มที่ Section 1 ใหม่ทั้งหมด
 * ต่างจาก resetStudentQuiz ที่ถอยเฉพาะขั้นแบบทดสอบ
 *
 * ต้องล้างคำตอบใน worksheet และ hookAnswers ด้วย ไม่ใช่ล้างแค่ completedSections
 * เพราะระบบมีตัวซ่อมความก้าวหน้าที่อ่านคำตอบเหล่านี้เป็นหลักฐาน
 * ถ้าล้างแต่เลขขั้นแล้วปล่อยคำตอบไว้ ตัวซ่อมจะเติมกลับให้ทันทีที่นักเรียนเปิดบทเรียน
 * ครูจะเห็นว่ารีเซ็ตแล้วไม่มีอะไรเกิดขึ้น
 *
 * Soft Delete ตาม Blueprint #227 — เก็บสำเนาก่อนเสมอ กู้คืนได้ด้วยปุ่มเดียวกับรีเซ็ตคะแนน
 * บันทึก Audit ครบตาม Blueprint #187
 */
function resetStudentProgress(token, username, reason) {
  const session = requireRole_(token, 'admin');
  const target = normalizeUsername_(username);
  const note = sanitizePlainText_(reason, 200).trim();
  const user = findUser_(target);

  if (!user || user.role !== 'student') {
    throw new Error('ไม่พบบัญชีนักเรียน');
  }
  if (note.length < 5) {
    throw new Error('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร เพื่อบันทึกไว้ในประวัติการแก้ไข');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSpreadsheet_().getSheetByName('Progress');
    const row = findRowByValue_(sheet, 1, target);

    if (row < 2) {
      throw new Error('นักเรียนคนนี้ยังไม่มีความก้าวหน้าให้รีเซ็ต');
    }

    const current = sheet.getRange(row, 3, 1, 5).getValues()[0];
    const before = {
      latestScore: Number(current[2]) || 0,
      bestScore: Number(current[3]) || 0,
      attempts: Number(current[4]) || 0
    };

    let state = null;
    try {
      state = JSON.parse(String(current[0] || ''));
    } catch (error) {
      state = null;
    }

    const snapshot = buildProgressSnapshot_(state);
    const doneBefore = contiguousCompleted_(snapshot.completedSections).length;

    if (doneBefore === 0 && before.attempts === 0) {
      throw new Error('นักเรียนคนนี้ยังไม่ได้เริ่มบทเรียน จึงไม่มีอะไรให้รีเซ็ต');
    }

    appendQuizArchive_(session.username, target, note, before, snapshot);

    const cleared = {
      version: APP_CONFIG.stateVersion,
      username: target,
      syncRevision: nextProgressSyncRevision_(state),
      syncMutation: 'progress_reset',
      currentSection: 1,
      completedSections: [],
      hookAnswers: {},
      worksheet: {},
      reflection: null,
      quiz: createEmptyQuizState_()
    };

    sheet.getRange(row, 3, 1, 2).setValues([[JSON.stringify(cleared), 1]]);
    sheet.getRange(row, 5, 1, 4).setValues([[0, 0, 0, new Date()]]);

    appendAudit_(
      session.username,
      'progress_reset',
      'success',
      target +
        ' | ก่อน ขั้น ' + doneBefore + '/' + LESSON_SECTION_COUNT +
        ' คะแนน ' + before.latestScore + '/' + before.bestScore +
        ' ทำ ' + before.attempts + ' ครั้ง' +
        ' | หลัง ขั้น 0/' + LESSON_SECTION_COUNT + ' คะแนน 0/0 ทำ 0 ครั้ง' +
        ' | เหตุผล ' + note
    );

    return {
      ok: true,
      username: target,
      displayName: user.displayName,
      before: before,
      completedBefore: doneBefore
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Rollback ตาม Blueprint #176 — คืนคะแนนจากสำเนาล่าสุดที่ยังไม่ถูกกู้คืน
 * ใช้เมื่อรีเซ็ตผิดคนหรือครูเปลี่ยนใจ
 */
function restoreStudentQuiz(token, username) {
  const session = requireRole_(token, 'admin');
  const target = normalizeUsername_(username);
  const user = findUser_(target);

  if (!user || user.role !== 'student') {
    throw new Error('ไม่พบบัญชีนักเรียน');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const archive = getSpreadsheet_().getSheetByName('QuizArchive');
    if (!archive) {
      throw new Error('ยังไม่มีสำเนาคะแนนให้กู้คืน');
    }

    const entries = readDataObjects_(archive).filter(function (item) {
      return String(item.username) === target && !item.restoredAt;
    });
    if (entries.length === 0) {
      throw new Error('ไม่พบสำเนาคะแนนที่ยังไม่ได้กู้คืนของนักเรียนคนนี้');
    }

    const entry = entries[entries.length - 1];
    const sheet = getSpreadsheet_().getSheetByName('Progress');
    const row = findRowByValue_(sheet, 1, target);
    if (row < 2) {
      throw new Error('ไม่พบแถวความก้าวหน้าของนักเรียน');
    }

    const restored = {
      latestScore: Number(entry.beforeLatestScore) || 0,
      bestScore: Number(entry.beforeBestScore) || 0,
      attempts: Number(entry.beforeAttempts) || 0
    };

    let state = null;
    try {
      state = JSON.parse(String(sheet.getRange(row, 3).getValue() || ''));
    } catch (error) {
      state = null;
    }
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      state = createDefaultProgress_({ username: target });
    }
    const restoredSyncRevision = nextProgressSyncRevision_(state);

    let snapshot = null;
    try {
      snapshot = JSON.parse(String(entry.beforeQuizJson || 'null'));
    } catch (error) {
      snapshot = null;
    }

    const isSnapshot = snapshot &&
      typeof snapshot === 'object' &&
      !Array.isArray(snapshot) &&
      Array.isArray(snapshot.completedSections);

    // สำเนารุ่นแรกเก็บเฉพาะก้อน quiz จึงต้องรองรับทั้งสองรูปแบบ
    const beforeQuiz = isSnapshot ? snapshot.quiz : snapshot;

    state.quiz = beforeQuiz && typeof beforeQuiz === 'object' && !Array.isArray(beforeQuiz)
      ? normalizeStoredQuiz_(beforeQuiz)
      : Object.assign(createEmptyQuizState_(), {
          latestScore: restored.latestScore,
          bestScore: restored.bestScore,
          attempts: restored.attempts
        });
    if (isSnapshot) {
      state.completedSections = contiguousCompleted_(snapshot.completedSections);
      state.currentSection = Math.min(
        Number(snapshot.currentSection) || 1,
        unlockedSection_(state.completedSections)
      );
      // สำเนารุ่นแรกไม่มีสามช่องนี้ จึงคืนเฉพาะเมื่อมีจริง
      // ไม่อย่างนั้นจะไปเขียนทับคำตอบปัจจุบันด้วยค่าว่าง
      if (snapshot.worksheet) state.worksheet = snapshot.worksheet;
      if (snapshot.hookAnswers) state.hookAnswers = snapshot.hookAnswers;
      if (snapshot.reflection) state.reflection = snapshot.reflection;
    }
    state.syncRevision = restoredSyncRevision;
    state.syncMutation = 'restore';
    // เขียนเลขขั้นคู่กับ JSON ด้วยเหตุผลเดียวกับตอนรีเซ็ต
    sheet.getRange(row, 3, 1, 2).setValues([[
      JSON.stringify(state), Number(state.currentSection) || 1
    ]]);

    const now = new Date();
    sheet.getRange(row, 5, 1, 4).setValues([[
      restored.latestScore, restored.bestScore, restored.attempts, now
    ]]);
    archive.getRange(entry._rowNumber, 9, 1, 2).setValues([[now, session.username]]);

    appendAudit_(
      session.username,
      'quiz_restore',
      'success',
      target + ' | ก่อน 0/0/0 | หลัง ' +
        restored.latestScore + '/' + restored.bestScore + '/' + restored.attempts +
        ' | กู้จากสำเนา ' + serializeDate_(entry.timestamp)
    );

    return { ok: true, username: target, displayName: user.displayName, restored: restored };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Migration แบบเพิ่มอย่างเดียวตาม Blueprint #123
 * สร้างชีต QuizArchive เมื่อยังไม่มี ระบบที่ติดตั้งไปแล้วจึงใช้ต่อได้โดยไม่ต้อง setupSystem ใหม่
 */
function ensureQuizArchiveSheet_() {
  const spreadsheet = getSpreadsheet_();
  const existing = spreadsheet.getSheetByName('QuizArchive');
  if (existing) return existing;

  const sheet = spreadsheet.insertSheet('QuizArchive');
  const headers = SHEET_SCHEMAS.QuizArchive;
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground('#43105b')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function appendQuizArchive_(actor, username, reason, before, snapshot) {
  ensureQuizArchiveSheet_().appendRow([
    new Date(),
    actor,
    username,
    reason,
    before.latestScore,
    before.bestScore,
    before.attempts,
    JSON.stringify(snapshot),
    '',
    ''
  ]);
}

/** Builds safe dashboard rows without password hashes, salts, or credentials. */
function buildStudentDashboardRows_() {
  const users = readDataObjects_(
    getSpreadsheet_().getSheetByName('Users')
  ).filter(function (user) {
    return user.role === 'student';
  });

  const progressRows = readDataObjects_(
    getSpreadsheet_().getSheetByName('Progress')
  );
  const progressByUsername = {};

  const archiveSheet = getSpreadsheet_().getSheetByName('QuizArchive');
  const restorableByUsername = {};
  if (archiveSheet) {
    readDataObjects_(archiveSheet).forEach(function (row) {
      if (!row.restoredAt) {
        restorableByUsername[String(row.username)] = true;
      }
    });
  }

  progressRows.forEach(function (row) {
    // ครูต้องรู้ว่านักเรียนทำไปกี่ขั้นแล้ว เพื่อตัดสินว่าควรรีเซ็ตหรือยัง
    // อ่านจาก progressJson เพราะคอลัมน์ currentSection บอกแค่ว่าอยู่ตรงไหน
    let completedCount = 0;
    try {
      const parsed = JSON.parse(String(row.progressJson || ''));
      completedCount = contiguousCompleted_(parsed.completedSections).length;
    } catch (error) {
      completedCount = 0;
    }

    progressByUsername[row.username] = {
      completedCount: completedCount,
      currentSection: Number(row.currentSection || 1),
      latestScore: Number(row.latestScore || 0),
      bestScore: Number(row.bestScore || 0),
      attempts: Number(row.attempts || 0),
      updatedAt: serializeDate_(row.updatedAt)
    };
  });

  return users.map(function (user) {
    return Object.assign({
      username: String(user.username),
      studentNumber: String(user.studentNumber),
      displayName: String(user.displayName),
      active: toBoolean_(user.active),
      canRestoreQuiz: Boolean(restorableByUsername[String(user.username)])
    }, progressByUsername[user.username] || {
      completedCount: 0,
      currentSection: 1,
      latestScore: 0,
      bestScore: 0,
      attempts: 0,
      updatedAt: null
    });
  });
}

/** Returns an authenticated Drive file as Base64 without making it public. */
function getDownloadFile(token, fileKey) {
  const session = requireSession_(token);
  const key = String(fileKey || '');
  const fileId = APP_CONFIG.downloadFiles[key];
  if (!fileId) {
    throw new Error('ไม่พบเอกสารที่ร้องขอ');
  }

  const file = DriveApp.getFileById(fileId);
  const size = file.getSize();
  if (size <= 0 || size > APP_CONFIG.maxDownloadFileBytes) {
    throw new Error('ไฟล์มีขนาดไม่เหมาะสมสำหรับดาวน์โหลดผ่านเว็บบทเรียน');
  }

  const allowedTypes = {
    lessonPlan: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    slides: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  const blob = file.getBlob();
  if (blob.getContentType() !== allowedTypes[key]) {
    throw new Error('ชนิดไฟล์ดาวน์โหลดไม่ถูกต้อง');
  }

  appendAudit_(session.username, 'document_download', 'success', key);
  return {
    ok: true,
    fileName: file.getName(),
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

function initializeSheets_(spreadsheet) {
  const names = Object.keys(SHEET_SCHEMAS);
  const first = spreadsheet.getSheets()[0];
  first.setName(names[0]);

  names.forEach(function (name, index) {
    const sheet = index === 0 ? first : spreadsheet.insertSheet(name);
    const headers = SHEET_SCHEMAS[name];
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#6d1a8d')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  });
}

function seedStudents_(spreadsheet, initialPassword) {
  const now = new Date();
  const rows = STUDENT_ROSTER.map(function (student) {
    const salt = createSalt_();
    // D-002: นักเรียนใช้รหัสที่ครูกำหนดและไม่มีขั้นเปลี่ยนรหัสผ่านด้วยตนเอง
    return [
      student.username,
      'student',
      student.studentNumber,
      student.displayName,
      hashPassword_(initialPassword, salt),
      salt,
      true,
      false,
      now,
      now
    ];
  });
  spreadsheet.getSheetByName('Users').getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function seedSettings_(spreadsheet, folder) {
  const sheet = spreadsheet.getSheetByName('Settings');
  const now = new Date();
  const settings = [
    ['subject', APP_CONFIG.subject, now],
    ['grade', APP_CONFIG.grade, now],
    ['academicYear', APP_CONFIG.academicYear, now],
    ['semester', APP_CONFIG.semester, now],
    ['driveFolderId', folder.getId(), now]
  ];
  sheet.getRange(2, 1, settings.length, settings[0].length).setValues(settings);
}

function getSetupStatus_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(APP_CONFIG.spreadsheetProperty);
  const folderId = properties.getProperty(APP_CONFIG.driveFolderProperty);
  if (!spreadsheetId || !folderId) {
    return { ok: false, configured: false };
  }
  return {
    ok: true,
    configured: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit',
    driveFolderUrl: 'https://drive.google.com/drive/folders/' + folderId
  };
}

function createSession_(user) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const session = {
    username: user.username,
    role: user.role,
    studentNumber: user.studentNumber,
    displayName: user.displayName,
    mustChangePassword: user.mustChangePassword,
    issuedAt: new Date().toISOString()
  };
  purgeExpiredSessions_();
  storeSession_(token, session);
  return token;
}

function requireSession_(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (!normalizedToken) {
    throw new Error('SESSION_EXPIRED');
  }
  const cache = CacheService.getScriptCache();
  const cacheKey = sessionCacheKey_(normalizedToken);
  const propertyKey = sessionPropertyKey_(normalizedToken);
  const properties = PropertiesService.getScriptProperties();
  const json = cache.get(cacheKey) || properties.getProperty(propertyKey);
  if (!json) {
    throw new Error('SESSION_EXPIRED');
  }

  let session;
  try {
    session = JSON.parse(json);
  } catch (error) {
    deleteSession_(normalizedToken);
    throw new Error('SESSION_EXPIRED');
  }

  if (!Number.isFinite(Number(session.expiresAt)) || Number(session.expiresAt) <= Date.now()) {
    deleteSession_(normalizedToken);
    throw new Error('SESSION_EXPIRED');
  }

  // Sliding expiry remains six hours, while Script Properties is the durable source of truth.
  storeSession_(normalizedToken, session);
  return session;
}

function storeSession_(token, session) {
  const normalizedToken = validateTokenFormat_(token);
  if (!normalizedToken) {
    throw new Error('SESSION_EXPIRED');
  }
  const storedSession = Object.assign({}, session, {
    expiresAt: Date.now() + APP_CONFIG.sessionTtlSeconds * 1000
  });
  const json = JSON.stringify(storedSession);
  PropertiesService.getScriptProperties().setProperty(
    sessionPropertyKey_(normalizedToken),
    json
  );
  CacheService.getScriptCache().put(
    sessionCacheKey_(normalizedToken),
    json,
    APP_CONFIG.sessionTtlSeconds
  );
}

function deleteSession_(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (!normalizedToken) return;
  CacheService.getScriptCache().remove(sessionCacheKey_(normalizedToken));
  deletePreviewState_(normalizedToken);
  PropertiesService.getScriptProperties().deleteProperty(
    sessionPropertyKey_(normalizedToken)
  );
}

function purgeExpiredSessions_() {
  const properties = PropertiesService.getScriptProperties();
  const values = properties.getProperties();
  const now = Date.now();
  Object.keys(values).forEach(function (key) {
    if (key.indexOf(APP_CONFIG.sessionPropertyPrefix) !== 0) return;
    try {
      const session = JSON.parse(values[key]);
      if (Number(session.expiresAt) > now) return;
    } catch (error) {
      // Invalid session records are removed below.
    }
    const storageId = key.slice(APP_CONFIG.sessionPropertyPrefix.length);
    properties.deleteProperty(key);
    deletePreviewStatePropertiesByBase_(
      APP_CONFIG.previewStatePropertyPrefix + storageId,
      properties
    );
  });
}

function sessionCacheKey_(token) {
  return 'session:' + token;
}

function sessionPropertyKey_(token) {
  return APP_CONFIG.sessionPropertyPrefix + hashPassword_(token, 'session');
}

function requireRole_(token, role) {
  const session = requireSession_(token);
  if (session.role !== role) {
    appendAudit_(session.username, 'role_guard', 'denied', 'ต้องเป็น ' + role);
    throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้');
  }
  return session;
}

function publicUser_(user) {
  return {
    username: user.username,
    role: user.role,
    studentNumber: user.studentNumber,
    displayName: user.displayName
  };
}

function findUser_(username) {
  const sheet = getSpreadsheet_().getSheetByName('Users');
  const rows = readDataObjects_(sheet);
  const match = rows.find(function (row) { return row.username === username; });
  if (!match) return null;
  return {
    rowNumber: match._rowNumber,
    username: String(match.username),
    role: String(match.role),
    studentNumber: String(match.studentNumber),
    displayName: String(match.displayName),
    passwordHash: String(match.passwordHash),
    salt: String(match.salt),
    active: toBoolean_(match.active),
    mustChangePassword: toBoolean_(match.mustChangePassword)
  };
}

function upsertUser_(user) {
  const sheet = getSpreadsheet_().getSheetByName('Users');
  const existingRow = findRowByValue_(sheet, 1, user.username);
  const now = new Date();
  const createdAt = existingRow > 0 ? sheet.getRange(existingRow, 9).getValue() : now;
  const values = [[
    user.username,
    user.role,
    user.studentNumber,
    user.displayName,
    user.passwordHash,
    user.salt,
    Boolean(user.active),
    Boolean(user.mustChangePassword),
    createdAt,
    now
  ]];
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, values[0].length).setValues(values);
  } else {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, values[0].length).setValues(values);
  }
}

function findProgressRow_(username) {
  const rows = readDataObjects_(getSpreadsheet_().getSheetByName('Progress'));
  const row = rows.find(function (item) { return item.username === username; });
  if (!row) return null;
  return {
    progressJson: String(row.progressJson || ''),
    updatedAt: serializeDate_(row.updatedAt)
  };
}

/**
 * คืนลำดับต่อเนื่องของขั้นที่ทำเสร็จจริง — Blueprint #16 Prerequisite Engine
 * ถ้าได้รับ [1,2,5] จะคืน [1,2] เพราะข้าม 3 และ 4 ไม่ได้
 */
function contiguousCompleted_(completedSections) {
  const done = {};
  (completedSections || []).forEach(function (section) {
    done[Number(section)] = true;
  });

  const prefix = [];
  for (let order = 1; order <= LESSON_SECTION_COUNT; order += 1) {
    if (!done[order]) break;
    prefix.push(order);
  }
  return prefix;
}

/** ขั้นสูงสุดที่นักเรียนเข้าถึงได้ คือขั้นถัดจากขั้นที่ทำเสร็จต่อเนื่องล่าสุด */
function unlockedSection_(completedSections) {
  return Math.min(
    contiguousCompleted_(completedSections).length + 1,
    LESSON_SECTION_COUNT
  );
}

/**
 * Reward Engine — Blueprint #88
 * XP และ Badge คำนวณใหม่จากความก้าวหน้าจริงทุกครั้งที่เรียก
 * ไม่ได้สะสมจากค่าที่ผู้ใช้ส่งมา จึงฟาร์มด้วยการ refresh ไม่ได้ ตาม #89
 */
/**
 * สรุปสถานะกิจกรรมเสริมจาก worksheet โดยไม่แตะลำดับขั้นบังคับ
 * เปิดได้เมื่อทำขั้นที่กำหนดใน unlockAfter สำเร็จแล้วเท่านั้น ตาม Blueprint #16
 */
function optionalStepsStatus_(state) {
  const completed = contiguousCompleted_(state ? state.completedSections : []);
  const worksheet = (state && state.worksheet) || {};

  return LESSON_OPTIONAL_STEPS.map(function (step) {
    const saved = worksheet[step.stateKey] || {};
    const unlocked = completed.indexOf(step.unlockAfter) !== -1;
    return {
      id: step.id,
      title: step.title,
      kind: step.kind,
      unlockAfter: step.unlockAfter,
      unlocked: unlocked,
      completed: unlocked && saved.completed === true,
      bestScore: Number(saved.bestScore) || 0,
      total: Number(saved.total) || 0,
      xpReward: step.xpReward
    };
  });
}

function computeRewards_(state) {
  const completed = contiguousCompleted_(state ? state.completedSections : []);
  const quiz = (state && state.quiz) || {};
  const bestScore = Number(quiz.bestScore) || 0;
  const attempts = Number(quiz.attempts) || 0;
  const passed = bestScore >= QUIZ_PASS_MARK;
  const perfect = bestScore >= APP_CONFIG.quizQuestionCount;

  // นับจากสถานะจริงทุกครั้ง ไม่สะสม เล่นซ้ำจึงไม่ได้ XP เพิ่ม ตาม Blueprint #89
  const optionalSteps = optionalStepsStatus_(state);

  let xp = completed.length * APP_CONFIG.xpPerSection;
  if (passed) xp += APP_CONFIG.xpQuizPass;
  if (perfect) xp += APP_CONFIG.xpPerfectQuiz;
  optionalSteps.forEach(function (step) {
    if (step.completed) xp += step.xpReward;
  });

  const badges = [];
  if (completed.length >= 1) {
    badges.push({ id: 'starter', label: 'เริ่มต้นแล้ว', detail: 'ทำกิจกรรมแรกสำเร็จ' });
  }
  if (completed.length >= Math.ceil(LESSON_SECTION_COUNT / 2)) {
    badges.push({ id: 'halfway', label: 'ครึ่งทางแล้ว', detail: 'ทำกิจกรรมผ่านครึ่งบทเรียน' });
  }
  if (passed) {
    badges.push({
      id: 'quiz-pass',
      label: 'ผ่านแบบทดสอบ',
      detail: 'ได้ ' + bestScore + '/' + APP_CONFIG.quizQuestionCount
    });
  }
  if (passed && attempts === 1) {
    badges.push({ id: 'first-try', label: 'ผ่านครั้งแรก', detail: 'ทำครั้งเดียวก็ผ่าน' });
  }
  if (perfect) {
    badges.push({ id: 'perfect', label: 'เต็มทุกข้อ', detail: 'ตอบถูกครบทุกข้อ' });
  }
  if (completed.length >= LESSON_SECTION_COUNT) {
    badges.push({ id: 'complete', label: 'จบบทเรียน', detail: 'ทำครบทุกขั้นตอน' });
  }
  LESSON_OPTIONAL_STEPS.forEach(function (step, index) {
    if (optionalSteps[index] && optionalSteps[index].completed) {
      badges.push({
        id: step.badge.id,
        label: step.badge.label,
        detail: step.badge.detail
      });
    }
  });

  return {
    xp: xp,
    badges: badges,
    completedCount: completed.length,
    totalSections: LESSON_SECTION_COUNT,
    bestScore: bestScore,
    passMark: QUIZ_PASS_MARK,
    passed: passed,
    optionalSteps: optionalSteps,
    encouragement: buildEncouragement_(completed.length, quiz, passed, perfect)
  };
}

/**
 * Encouragement Engine — Blueprint #58 และ #69 Celebration
 * ทุกข้อความต้องอ้างตัวเลขจริงจากงานที่ผู้เรียนทำ ไม่ใช่คำชมลอย ๆ
 * ตาม #59 ที่ห้ามชมมั่ว และ #72 ที่ห้ามเปรียบเทียบกับคนอื่น
 * tone ใช้บอกหน้าเว็บว่าจะฉลองหรือแค่ให้กำลังใจ
 */
function buildEncouragement_(doneCount, quiz, passed, perfect) {
  const total = LESSON_SECTION_COUNT;
  const attempts = Number(quiz.attempts) || 0;
  const latest = Number(quiz.latestScore) || 0;
  const best = Number(quiz.bestScore) || 0;
  const maximum = APP_CONFIG.quizQuestionCount;
  const remaining = Math.max(total - doneCount, 0);

  if (doneCount >= total) {
    return {
      tone: 'celebrate',
      title: 'จบบทเรียนครบทุกขั้นแล้ว',
      message: perfect
        ? 'ทำครบ ' + total + ' ขั้น และตอบถูกทั้ง ' + maximum + ' ข้อ'
        : 'ทำครบ ' + total + ' ขั้น และคะแนนสูงสุดคือ ' + best + '/' + maximum
    };
  }

  if (passed) {
    return {
      tone: 'celebrate',
      title: 'ผ่านแบบทดสอบแล้ว',
      message: 'ได้ ' + best + '/' + maximum + ' จากเกณฑ์ ' + QUIZ_PASS_MARK +
        ' เหลืออีก ' + remaining + ' ขั้นก็ครบบทเรียน'
    };
  }

  if (attempts > 0 && !passed) {
    const missing = Math.max(QUIZ_PASS_MARK - best, 0);
    return {
      tone: 'support',
      title: attempts >= APP_CONFIG.quizMaxAttempts
        ? 'ใช้สิทธิ์ครบแล้ว ไปคุยกับครูกันนะ'
        : 'ใกล้แล้ว ขาดอีกนิดเดียว',
      message: 'คะแนนสูงสุดตอนนี้ ' + best + '/' + maximum +
        ' ขาดอีก ' + missing + ' ข้อจะถึงเกณฑ์ ' +
        (attempts >= APP_CONFIG.quizMaxAttempts
          ? 'ใช้ครบ ' + attempts + ' ครั้งแล้ว'
          : 'เหลือสิทธิ์อีก ' + (APP_CONFIG.quizMaxAttempts - attempts) + ' ครั้ง')
    };
  }

  if (doneCount === 0) {
    return {
      tone: 'start',
      title: 'เริ่มกันเลย',
      message: 'บทเรียนนี้มี ' + total + ' ขั้น ทำทีละขั้นไม่ต้องรีบ'
    };
  }

  if (doneCount >= Math.ceil(total / 2)) {
    return {
      tone: 'progress',
      title: 'ผ่านครึ่งทางแล้ว',
      message: 'ทำไปแล้ว ' + doneCount + ' จาก ' + total + ' ขั้น เหลืออีก ' + remaining
    };
  }

  return {
    tone: 'progress',
    title: 'กำลังไปได้ดี',
    message: 'ทำไปแล้ว ' + doneCount + ' จาก ' + total + ' ขั้น เหลืออีก ' + remaining
  };
}

function createEmptyQuizState_() {
  return {
    answers: {},
    results: {},
    latestScore: 0,
    bestScore: 0,
    attempts: 0,
    locked: false,
    lastSubmissionId: '',
    lastSubmissionAnswers: {}
  };
}

function progressSyncRevision_(stateOrValue) {
  const raw = stateOrValue && typeof stateOrValue === 'object'
    ? stateOrValue.syncRevision
    : stateOrValue;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function progressSyncMutation_(stateOrValue) {
  const raw = stateOrValue && typeof stateOrValue === 'object'
    ? stateOrValue.syncMutation
    : stateOrValue;
  const mutation = String(raw || 'initial');
  return ['initial', 'quiz_reset', 'progress_reset', 'restore'].indexOf(mutation) >= 0
    ? mutation
    : 'initial';
}

function ensureProgressSyncMetadata_(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  state.syncRevision = progressSyncRevision_(state);
  state.syncMutation = progressSyncMutation_(state);
  return state;
}

function nextProgressSyncRevision_(state) {
  const current = progressSyncRevision_(state);
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new Error('เลขรุ่นข้อมูลความก้าวหน้าเต็ม กรุณาแจ้งผู้ดูแลระบบ');
  }
  return current + 1;
}

function assertProgressSyncRevision_(incomingRevision, trustedState) {
  if (progressSyncRevision_(incomingRevision) !== progressSyncRevision_(trustedState)) {
    throw new Error(
      'PROGRESS_CONFLICT: ข้อมูลถูกครูรีเซ็ตหรือกู้คืน กรุณาโหลดข้อมูลล่าสุด'
    );
  }
}

function createDefaultProgress_(session) {
  return {
    version: APP_CONFIG.stateVersion,
    username: session.username,
    syncRevision: 0,
    syncMutation: 'initial',
    currentSection: 1,
    completedSections: [],
    hookAnswers: {},
    worksheet: {},
    reflection: {},
    quiz: createEmptyQuizState_()
  };
}

function isPlainRecord_(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn_(value, key) {
  return isPlainRecord_(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeEvidenceChoice_(value, allowedChoices) {
  const choice = typeof value === 'string' ? value : '';
  return allowedChoices.indexOf(choice) >= 0 ? choice : '';
}

function normalizeHookEvidence_(incomingValue, trustedValue) {
  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  const sensorGuess =
    normalizeEvidenceChoice_(incoming.sensorGuess, REQUIRED_EVIDENCE_RULES.sensorGuesses) ||
    normalizeEvidenceChoice_(trusted.sensorGuess, REQUIRED_EVIDENCE_RULES.sensorGuesses);
  const predict800 =
    normalizeEvidenceChoice_(incoming.predict800, REQUIRED_EVIDENCE_RULES.predict800Choices) ||
    normalizeEvidenceChoice_(trusted.predict800, REQUIRED_EVIDENCE_RULES.predict800Choices);
  const clean = {};
  if (sensorGuess) clean.sensorGuess = sensorGuess;
  if (predict800) clean.predict800 = predict800;
  return clean;
}

function normalizeUnpluggedMapEvidence_(incomingValue, trustedValue) {
  const sources = [incomingValue, trustedValue];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    if (!isPlainRecord_(source)) continue;
    const score = Number(source.score);
    if (!Number.isInteger(score) || score < 0 || score > 100) continue;
    return {
      score: score,
      // สูตรเดียวกับสไลเดอร์ 0–100 → 0–4 ห้ามเชื่อ grade ที่ client ส่งมา
      grade: score * 4 / 100
    };
  }
  return null;
}

function normalizeCheckedChoiceEvidence_(
  incomingValue,
  trustedValue,
  allowedChoices,
  correctChoice,
  prerequisiteMet,
  trustedWasComplete
) {
  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  const incomingAnswer = normalizeEvidenceChoice_(incoming.answer, allowedChoices);
  const trustedAnswer = normalizeEvidenceChoice_(trusted.answer, allowedChoices);
  let answer = incomingAnswer || trustedAnswer;

  // ขั้นที่ผ่านแล้วต้องไม่ถอยเพราะ request เก่าหรือ client ที่ยังไม่ทัน sync
  if (trustedWasComplete && answer !== correctChoice && trustedAnswer) {
    answer = trustedAnswer;
  }
  if (!answer) return null;

  const correct = answer === correctChoice;
  return {
    answer: answer,
    correct: correct,
    completed: Boolean(trustedWasComplete || (prerequisiteMet && correct))
  };
}

function normalizeAccelEvidence_(value) {
  const accel = Number(value);
  return Number.isInteger(accel) && accel >= -1023 && accel <= 1023
    ? accel
    : null;
}

function normalizeTiltEvidence_(
  incomingValue,
  trustedValue,
  prerequisiteMet,
  trustedWasComplete
) {
  const hasIncoming = isPlainRecord_(incomingValue);
  const hasTrusted = isPlainRecord_(trustedValue);
  if (!hasIncoming && !hasTrusted) return null;

  const incoming = hasIncoming ? incomingValue : {};
  const trusted = hasTrusted ? trustedValue : {};
  const incomingAccel = normalizeAccelEvidence_(incoming.accel);
  const trustedAccel = normalizeAccelEvidence_(trusted.accel);
  const accel = incomingAccel !== null
    ? incomingAccel
    : trustedAccel !== null ? trustedAccel : 0;
  const constrainEnabled = hasOwn_(incoming, 'constrainEnabled')
    ? incoming.constrainEnabled === true
    : trusted.constrainEnabled === true;

  // flags สองตัวนี้เป็นหลักฐานประวัติการทดลองและต้องรวมแบบ monotonic
  // เพื่อให้งานที่ทำออฟไลน์ทั้งสองโหมดไม่หายเมื่อกลับมา sync
  const seenUnsafe = incoming.seenUnsafe === true || trusted.seenUnsafe === true;
  const seenSafe = incoming.seenSafe === true || trusted.seenSafe === true;

  return {
    accel: accel,
    constrainEnabled: constrainEnabled,
    seenUnsafe: seenUnsafe,
    seenSafe: seenSafe,
    completed: Boolean(
      trustedWasComplete || (prerequisiteMet && seenUnsafe && seenSafe)
    )
  };
}

function normalizeDebugEvidence_(
  incomingValue,
  trustedValue,
  prerequisiteMet,
  trustedWasComplete
) {
  const checked = normalizeCheckedChoiceEvidence_(
    incomingValue,
    trustedValue,
    REQUIRED_EVIDENCE_RULES.debugChoices,
    'map-four',
    prerequisiteMet,
    trustedWasComplete
  );
  if (!checked) return null;

  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  const incomingAccel = normalizeAccelEvidence_(incoming.lastAccel);
  const trustedAccel = normalizeAccelEvidence_(trusted.lastAccel);
  checked.lastAccel = incomingAccel !== null
    ? incomingAccel
    : trustedAccel !== null ? trustedAccel : 600;
  return checked;
}

function validGlossaryEvidenceIds_(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).filter(function (id) {
    return REQUIRED_EVIDENCE_RULES.glossaryIds.indexOf(id) >= 0;
  })));
}

function normalizeGlossaryEvidence_(
  incomingValue,
  trustedValue,
  prerequisiteMet,
  trustedWasComplete
) {
  const hasIncoming = isPlainRecord_(incomingValue);
  const hasTrusted = isPlainRecord_(trustedValue);
  if (!hasIncoming && !hasTrusted) return null;

  const incomingOpened = validGlossaryEvidenceIds_(
    hasIncoming ? incomingValue.opened : []
  );
  const trustedOpened = validGlossaryEvidenceIds_(
    hasTrusted ? trustedValue.opened : []
  );
  const opened = Array.from(new Set(trustedOpened.concat(incomingOpened)));
  const abbreviationCount = opened.filter(function (id) {
    return REQUIRED_EVIDENCE_RULES.glossaryAbbreviationIds.indexOf(id) >= 0;
  }).length;
  const explored =
    opened.length >= REQUIRED_EVIDENCE_RULES.glossaryRequired &&
    abbreviationCount >= REQUIRED_EVIDENCE_RULES.glossaryAbbreviationsRequired;

  return {
    opened: opened,
    // นับใหม่จาก ID ที่ server รู้จัก ไม่เชื่อตัวเลขที่ client ส่งมา
    abbreviationCount: abbreviationCount,
    completed: Boolean(trustedWasComplete || (prerequisiteMet && explored))
  };
}

function normalizeReflectionEvidence_(incomingValue, trustedValue, trustedWasComplete) {
  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  let summary = hasOwn_(incoming, 'summary')
    ? sanitizePlainText_(incoming.summary, 500)
    : sanitizePlainText_(trusted.summary, 500);
  let confidence = hasOwn_(incoming, 'confidence')
    ? normalizeEvidenceChoice_(
        incoming.confidence,
        REQUIRED_EVIDENCE_RULES.confidenceChoices
      )
    : normalizeEvidenceChoice_(
        trusted.confidence,
        REQUIRED_EVIDENCE_RULES.confidenceChoices
      );

  const trustedSummary = sanitizePlainText_(trusted.summary, 500);
  const trustedConfidence = normalizeEvidenceChoice_(
    trusted.confidence,
    REQUIRED_EVIDENCE_RULES.confidenceChoices
  );
  if (
    trustedWasComplete &&
    (summary.length < 10 || !confidence) &&
    trustedSummary.length >= 10 &&
    trustedConfidence
  ) {
    summary = trustedSummary;
    confidence = trustedConfidence;
  }

  return summary || confidence
    ? { summary: summary, confidence: confidence }
    : {};
}

function reflectionEvidenceComplete_(reflection) {
  return Boolean(
    reflection &&
    sanitizePlainText_(reflection.summary, 500).length >= 10 &&
    normalizeEvidenceChoice_(
      reflection.confidence,
      REQUIRED_EVIDENCE_RULES.confidenceChoices
    )
  );
}

function setNormalizedEvidence_(worksheet, key, value) {
  if (value) {
    worksheet[key] = value;
  } else {
    delete worksheet[key];
  }
}

function sanitizeLearningEvidenceText_(value, maximumLength) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeMiniGameAttemptId_(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{8,100}$/.test(id) ? id : '';
}

function normalizeMiniGameAttemptAnswers_(value) {
  const rules = OPTIONAL_EVIDENCE_RULES.miniGame;
  if (!Array.isArray(value) || value.length !== rules.items.length) return null;

  const byAccel = {};
  for (let index = 0; index < value.length; index += 1) {
    const answer = value[index];
    if (!isPlainRecord_(answer) || typeof answer.saidSafe !== 'boolean') return null;
    const accel = Number(answer.accel);
    if (!Number.isInteger(accel) || hasOwn_(byAccel, String(accel))) return null;
    byAccel[String(accel)] = answer.saidSafe;
  }

  const normalized = [];
  for (let index = 0; index < rules.items.length; index += 1) {
    const item = rules.items[index];
    if (!hasOwn_(byAccel, String(item.accel))) return null;
    normalized.push({ accel: item.accel, saidSafe: byAccel[String(item.accel)] });
  }
  return normalized;
}

function miniGameScore_(answers) {
  const items = OPTIONAL_EVIDENCE_RULES.miniGame.items;
  return answers.reduce(function (score, answer, index) {
    return score + (answer.saidSafe === items[index].safe ? 1 : 0);
  }, 0);
}

function normalizeMiniGameEvidence_(incomingValue, trustedValue, unlocked) {
  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  const rules = OPTIONAL_EVIDENCE_RULES.miniGame;
  const total = rules.items.length;
  let bestScore = clampInteger_(trusted.bestScore, 0, total);
  let plays = clampInteger_(trusted.plays, 0, 1000000);
  let lastAttemptId = normalizeMiniGameAttemptId_(trusted.lastAttemptId);
  const attemptId = normalizeMiniGameAttemptId_(incoming.attemptId);
  const attemptAnswers = normalizeMiniGameAttemptAnswers_(incoming.attemptAnswers);

  if (unlocked && attemptId && attemptAnswers && attemptId !== lastAttemptId) {
    bestScore = Math.max(bestScore, miniGameScore_(attemptAnswers));
    plays = Math.min(1000000, plays + 1);
    lastAttemptId = attemptId;
  }

  if (!Object.keys(incoming).length && !Object.keys(trusted).length) return null;
  const clean = {
    completed: Boolean(unlocked && bestScore >= rules.passMark),
    bestScore: bestScore,
    total: total,
    plays: plays
  };
  if (lastAttemptId) clean.lastAttemptId = lastAttemptId;
  return clean;
}

function normalizeMissionAnswers_(value) {
  const source = isPlainRecord_(value) ? value : {};
  const rules = OPTIONAL_EVIDENCE_RULES.mission;
  const clean = {};
  Object.keys(rules.answers).forEach(function (questionId) {
    const answer = normalizeEvidenceChoice_(source[questionId], rules.choices);
    if (answer) clean[questionId] = answer;
  });
  return clean;
}

function verifiedMissionStage_(answers) {
  const key = OPTIONAL_EVIDENCE_RULES.mission.answers;
  let stage = 1;
  if (answers.q1 === key.q1 && answers.q2 === key.q2) stage = 2;
  if (stage === 2 && answers.q3 === key.q3) stage = 3;
  if (stage === 3 && answers.q4 === key.q4) stage = 4;
  return stage;
}

function normalizeMissionEvidence_(incomingValue, trustedValue, unlocked) {
  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  const rules = OPTIONAL_EVIDENCE_RULES.mission;
  if (!Object.keys(incoming).length && !Object.keys(trusted).length) return null;

  const trustedAnswers = normalizeMissionAnswers_(trusted.answers);
  const incomingAnswers = normalizeMissionAnswers_(incoming.answers);
  const answers = Object.assign({}, trustedAnswers);
  Object.keys(rules.answers).forEach(function (questionId) {
    // คำตอบที่ server เคยยืนยันว่าถูกแล้วจะไม่ถอยหลังจากการ sync งานเก่า
    if (trustedAnswers[questionId] === rules.answers[questionId]) return;
    if (incomingAnswers[questionId]) answers[questionId] = incomingAnswers[questionId];
  });

  const trustedLetter = sanitizeLearningEvidenceText_(trusted.letter, rules.letterMax);
  const incomingLetter = hasOwn_(incoming, 'letter')
    ? sanitizeLearningEvidenceText_(incoming.letter, rules.letterMax)
    : '';
  const letter = incomingLetter || trustedLetter;
  const verifiedStage = verifiedMissionStage_(answers);
  const trustedStage = clampInteger_(trusted.stage, 1, rules.stageCount);
  const trustedWasComplete = trusted.completed === true;
  const evidenceComplete =
    verifiedStage >= rules.stageCount && letter.length >= rules.letterMin;
  const completed = Boolean(unlocked && (trustedWasComplete || evidenceComplete));
  const stage = completed
    ? rules.stageCount
    : Math.max(verifiedStage, trustedStage);

  const clean = { stage: stage, completed: completed, answers: answers };
  if (letter) clean.letter = letter;
  return clean;
}

function normalizeCodingLabEvidence_(incomingValue, trustedValue, unlocked) {
  const incoming = isPlainRecord_(incomingValue) ? incomingValue : {};
  const trusted = isPlainRecord_(trustedValue) ? trustedValue : {};
  const rules = OPTIONAL_EVIDENCE_RULES.codingLab;
  if (!Object.keys(incoming).length && !Object.keys(trusted).length) return null;

  const clean = {};
  let allChecked = true;
  for (let index = 1; index <= 4; index += 1) {
    const key = 'check' + index;
    clean[key] = trusted[key] === true || incoming[key] === true;
    allChecked = allChecked && clean[key];
  }

  const trustedPause = normalizeEvidenceChoice_(trusted.pauseAnswer, rules.pauseChoices);
  const incomingPause = normalizeEvidenceChoice_(incoming.pauseAnswer, rules.pauseChoices);
  const pauseAnswer = incomingPause || trustedPause;
  if (pauseAnswer) clean.pauseAnswer = pauseAnswer;

  const trustedNote = sanitizeLearningEvidenceText_(trusted.note, rules.noteMax);
  const incomingNote = hasOwn_(incoming, 'note')
    ? sanitizeLearningEvidenceText_(incoming.note, rules.noteMax)
    : '';
  const note = incomingNote || trustedNote;
  if (note) clean.note = note;

  const evidenceComplete =
    allChecked &&
    pauseAnswer === rules.correctPauseAnswer &&
    note.length >= rules.noteMin;
  clean.completed = Boolean(
    unlocked && (trusted.completed === true || evidenceComplete)
  );
  return clean;
}

function optionalStepUnlocked_(completedSections, stateKey) {
  const step = LESSON_OPTIONAL_STEPS.filter(function (item) {
    return item.stateKey === stateKey;
  })[0];
  return Boolean(step && completedSections.indexOf(step.unlockAfter) >= 0);
}

function normalizeOptionalLearningEvidence_(
  baseWorksheet,
  incomingValue,
  trustedValue,
  completedSections
) {
  const worksheet = sanitizeJsonObject_(baseWorksheet);
  const incoming = sanitizeJsonObject_(incomingValue);
  const trusted = sanitizeJsonObject_(trustedValue);
  setNormalizedEvidence_(
    worksheet,
    'miniGame',
    normalizeMiniGameEvidence_(
      incoming.miniGame,
      trusted.miniGame,
      optionalStepUnlocked_(completedSections, 'miniGame')
    )
  );
  setNormalizedEvidence_(
    worksheet,
    'mission',
    normalizeMissionEvidence_(
      incoming.mission,
      trusted.mission,
      optionalStepUnlocked_(completedSections, 'mission')
    )
  );
  setNormalizedEvidence_(
    worksheet,
    'codingLab',
    normalizeCodingLabEvidence_(
      incoming.codingLab,
      trusted.codingLab,
      optionalStepUnlocked_(completedSections, 'codingLab')
    )
  );
  return worksheet;
}

function rejectedOptionalRewardRequests_(incomingValue, normalizedValue) {
  const incoming = sanitizeJsonObject_(incomingValue);
  const normalized = sanitizeJsonObject_(normalizedValue);
  return LESSON_OPTIONAL_STEPS.filter(function (step) {
    const requested = isPlainRecord_(incoming[step.stateKey])
      ? incoming[step.stateKey]
      : {};
    const accepted = isPlainRecord_(normalized[step.stateKey])
      ? normalized[step.stateKey]
      : {};
    if (requested.completed === true && accepted.completed !== true) return true;
    if (
      step.stateKey === 'miniGame' &&
      Number(requested.bestScore) > Number(accepted.bestScore || 0)
    ) return true;
    return false;
  }).map(function (step) {
    return step.id;
  });
}

/**
 * สร้าง canonical evidence และ derive Required Sections จากหลักฐานทีละขั้น
 * งานเดิมที่ server เคยบันทึกว่าสำเร็จจะคงอยู่เพื่อไม่ทำลายข้อมูลนักเรียน
 * แต่ client ไม่สามารถเพิ่มขั้นใหม่ด้วย completedSections เพียงอย่างเดียวได้
 */
function normalizeRequiredLearningEvidence_(state, trustedState) {
  const trusted = isPlainRecord_(trustedState) ? trustedState : {};
  const trustedCompleted = contiguousCompleted_(trusted.completedSections || []);
  const completedSections = trustedCompleted.slice();
  const incomingWorksheet = sanitizeJsonObject_(state.worksheet);
  const trustedWorksheet = sanitizeJsonObject_(trusted.worksheet);
  const worksheet = Object.assign({}, trustedWorksheet, incomingWorksheet);
  const hookAnswers = normalizeHookEvidence_(state.hookAnswers, trusted.hookAnswers);

  function trustedHas(order) {
    return trustedCompleted.indexOf(order) >= 0;
  }
  function appendWhenNext(order, condition) {
    if (completedSections.length === order - 1 && condition) {
      completedSections.push(order);
    }
  }

  appendWhenNext(1, Boolean(hookAnswers.sensorGuess));
  appendWhenNext(2, Boolean(hookAnswers.predict800));

  const unpluggedMap = normalizeUnpluggedMapEvidence_(
    incomingWorksheet.unpluggedMap,
    trustedWorksheet.unpluggedMap
  );
  setNormalizedEvidence_(worksheet, 'unpluggedMap', unpluggedMap);
  appendWhenNext(3, Boolean(unpluggedMap));

  const mgCheck = normalizeCheckedChoiceEvidence_(
    incomingWorksheet.mgCheck,
    trustedWorksheet.mgCheck,
    REQUIRED_EVIDENCE_RULES.mgChoices,
    'working-range',
    completedSections.indexOf(3) >= 0,
    trustedHas(4)
  );
  setNormalizedEvidence_(worksheet, 'mgCheck', mgCheck);
  appendWhenNext(4, Boolean(mgCheck && mgCheck.completed));

  const tiltSimulator = normalizeTiltEvidence_(
    incomingWorksheet.tiltSimulator,
    trustedWorksheet.tiltSimulator,
    completedSections.indexOf(4) >= 0,
    trustedHas(5)
  );
  setNormalizedEvidence_(worksheet, 'tiltSimulator', tiltSimulator);
  appendWhenNext(5, Boolean(tiltSimulator && tiltSimulator.completed));

  const debugCase = normalizeDebugEvidence_(
    incomingWorksheet.debugCase,
    trustedWorksheet.debugCase,
    completedSections.indexOf(5) >= 0,
    trustedHas(6)
  );
  setNormalizedEvidence_(worksheet, 'debugCase', debugCase);
  appendWhenNext(6, Boolean(debugCase && debugCase.completed));

  const glossary = normalizeGlossaryEvidence_(
    incomingWorksheet.glossary,
    trustedWorksheet.glossary,
    completedSections.indexOf(6) >= 0,
    trustedHas(7)
  );
  setNormalizedEvidence_(worksheet, 'glossary', glossary);
  appendWhenNext(7, Boolean(glossary && glossary.completed));

  // Section 8 เพิ่มได้จาก submitQuizAttemptV2 เท่านั้น จึงไม่มี appendWhenNext(8)
  const reflection = normalizeReflectionEvidence_(
    state.reflection,
    trusted.reflection,
    trustedHas(9)
  );
  appendWhenNext(
    9,
    completedSections.indexOf(QUIZ_SECTION_ORDER) >= 0 &&
      reflectionEvidenceComplete_(reflection)
  );

  return {
    hookAnswers: hookAnswers,
    worksheet: worksheet,
    reflection: reflection,
    completedSections: contiguousCompleted_(completedSections)
  };
}

function validateProgressState_(state, session, trustedState) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('รูปแบบข้อมูลความก้าวหน้าไม่ถูกต้อง');
  }
  const json = JSON.stringify(state);
  if (json.length > APP_CONFIG.maxProgressJsonLength) {
    throw new Error('ข้อมูลความก้าวหน้ามีขนาดใหญ่เกินกำหนด');
  }

  const requestedSection = Number(state.currentSection);
  if (
    !Number.isInteger(requestedSection) ||
    requestedSection < 1 ||
    requestedSection > LESSON_SECTION_COUNT
  ) {
    throw new Error('Section ปัจจุบันไม่ถูกต้อง');
  }

  const quiz = state.quiz || {};
  const trusted = trustedState &&
    typeof trustedState === 'object' &&
    !Array.isArray(trustedState)
    ? trustedState
    : createDefaultProgress_(session);
  assertProgressSyncRevision_(state.syncRevision, trusted);
  const trustedQuiz = normalizeStoredQuiz_(trusted.quiz);
  const draftAnswers = validateQuizAnswers_(quiz.answers || {}, false);
  const rawCompleted = Array.isArray(state.completedSections)
    ? state.completedSections
        .map(Number)
        .filter(function (section) {
          return (
            Number.isInteger(section) &&
            section >= 1 &&
            section <= LESSON_SECTION_COUNT
          );
        })
    : [];

  const uniqueCompleted = Array.from(new Set(rawCompleted)).sort(function (a, b) {
    return a - b;
  });
  const normalizedEvidence = normalizeRequiredLearningEvidence_(state, trusted);
  const completedSections = session.previewMode === 'free'
    ? uniqueCompleted
    : normalizedEvidence.completedSections;
  const normalizedWorksheet = normalizeOptionalLearningEvidence_(
    normalizedEvidence.worksheet,
    state.worksheet,
    trusted.worksheet,
    completedSections
  );
  const rejectedCompleted = uniqueCompleted.filter(function (section) {
    return completedSections.indexOf(section) < 0;
  });
  const rejectedOptional = rejectedOptionalRewardRequests_(
    state.worksheet,
    normalizedWorksheet
  );

  // completedSections เป็นผลลัพธ์ ไม่ใช่คำสั่ง: บันทึกเหตุการณ์เมื่อ client ขอเกินหลักฐาน
  if (!session.preview && rejectedCompleted.length) {
    appendAudit_(
      session.username,
      'progress_guard',
      'blocked',
      'client ขอเพิ่มขั้นที่ไม่มีหลักฐาน [' + rejectedCompleted.join(',') +
        '] รับได้ [' + completedSections.join(',') + ']'
    );
  }
  if (!session.preview && rejectedOptional.length) {
    appendAudit_(
      session.username,
      'optional_reward_guard',
      'blocked',
      'client ขอรางวัลโดยหลักฐานไม่ครบ [' + rejectedOptional.join(',') + ']'
    );
  }

  // โหมด free ของครูข้ามลำดับได้ เพราะเป็นข้อมูลจำลองที่ไม่กระทบใคร
  const currentSection = session.previewMode === 'free'
    ? requestedSection
    : Math.min(requestedSection, unlockedSection_(completedSections));
  const trustedSubmittedAnswers = trustedQuiz.lastSubmissionId
    ? trustedQuiz.lastSubmissionAnswers
    : trustedQuiz.answers;
  const keepTrustedResults = Boolean(
    trustedQuiz.attempts > 0 &&
    quiz.locked === true &&
    Object.keys(draftAnswers).length === APP_CONFIG.quizQuestionCount &&
    sameQuizAnswers_(trustedSubmittedAnswers, draftAnswers)
  );

  return {
    version: APP_CONFIG.stateVersion,
    username: session.username,
    syncRevision: progressSyncRevision_(trusted),
    syncMutation: progressSyncMutation_(trusted),
    currentSection: currentSection,
    completedSections: completedSections,
    hookAnswers: normalizedEvidence.hookAnswers,
    worksheet: normalizedWorksheet,
    reflection: normalizedEvidence.reflection,
    quiz: {
      answers: draftAnswers,
      // เฉลยเปิดได้ต่อเมื่อมี attempt จริงบน server แล้วเท่านั้น
      results: keepTrustedResults ? buildQuizResults_(draftAnswers) : {},
      latestScore: trustedQuiz.latestScore,
      bestScore: trustedQuiz.bestScore,
      attempts: trustedQuiz.attempts,
      locked: trustedQuiz.attempts >= APP_CONFIG.quizMaxAttempts
        ? true
        : keepTrustedResults,
      lastSubmissionId: trustedQuiz.lastSubmissionId,
      lastSubmissionAnswers: trustedQuiz.lastSubmissionAnswers
    }
  };
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.spreadsheetProperty);
  if (!id) throw new Error('ระบบยังไม่ได้ตั้งค่า กรุณาเรียก setupSystem()');
  return SpreadsheetApp.openById(id);
}

function readDataObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(function (row, index) {
    const object = { _rowNumber: index + 2 };
    headers.forEach(function (header, column) {
      object[header] = row[column];
    });
    return object;
  });
}

function findRowByValue_(sheet, column, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, column, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === String(value)) return index + 2;
  }
  return -1;
}

function appendAudit_(username, action, result, details) {
  getSpreadsheet_().getSheetByName('Audit').appendRow([
    new Date(),
    sanitizePlainText_(username, 40),
    sanitizePlainText_(action, 60),
    sanitizePlainText_(result, 30),
    sanitizePlainText_(details, 240)
  ]);
}

function createSalt_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + ':' + String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function validateNewPassword_(password) {
  const value = String(password || '');
  if (value.length < 8 || value.length > 128) {
    throw new Error('รหัสผ่านใหม่ต้องมีความยาว 8–128 ตัวอักษร');
  }
  if (!/[A-Za-zก-๙]/.test(value) || !/[0-9]/.test(value)) {
    throw new Error('รหัสผ่านใหม่ต้องมีทั้งตัวอักษรและตัวเลข');
  }
}

function validateTokenFormat_(token) {
  const value = String(token || '');
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}

function normalizeUsername_(username) {
  return String(username || '').trim().toLowerCase();
}

function sanitizePlainText_(value, maximumLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function sanitizeJsonObject_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function clampInteger_(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function serializeDate_(value) {
  return value instanceof Date ? value.toISOString() : String(value || '') || null;
}

function safeErrorMessage_(error) {
  return sanitizePlainText_(error && error.message ? error.message : error, 240);
}
