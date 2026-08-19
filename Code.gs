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
  spreadsheetProperty: 'TILT_LAB_SPREADSHEET_ID',
  driveFolderProperty: 'TILT_LAB_DRIVE_FOLDER_ID',
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
  })
]);

const STUDENT_ROSTER = Object.freeze([
  { username: 'std001', studentNumber: '001', displayName: 'เด็กชายณฐชยนต์  สุขแจ่ม' },
  { username: 'std002', studentNumber: '002', displayName: 'เด็กชายธนากร  พรมมาแข้' },
  { username: 'std003', studentNumber: '003', displayName: 'เด็กหญิงนภาพร  ก้อนจันทร์เทศ' },
  { username: 'std004', studentNumber: '004', displayName: 'เด็กหญิงนรินธร  ก้อนจันทร์เทศ' },
  { username: 'std005', studentNumber: '005', displayName: 'เด็กหญิงสุภัสสรา  สีสิงห์' },
  { username: 'std006', studentNumber: '006', displayName: 'เด็กหญิงเสาวลักษณ์  รุ่งฉวี' },
  { username: 'std007', studentNumber: '007', displayName: 'เด็กหญิงลิตานันท์  สิงห์งาม' }
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
    'attemptNumber', 'answersJson'
  ],
  Audit: ['timestamp', 'username', 'action', 'result', 'details'],
  QuizArchive: [
    'timestamp', 'actor', 'username', 'reason', 'beforeLatestScore',
    'beforeBestScore', 'beforeAttempts', 'beforeQuizJson', 'restoredAt', 'restoredBy'
  ],
  Settings: ['key', 'value', 'updatedAt']
});

/** Serves the student and administrator web app. */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
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

/** Removes a session token from the server cache. */
function logout(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (normalizedToken) {
    CacheService.getScriptCache().remove('session:' + normalizedToken);
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
    const previewState = readPreviewState_(token, session);
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
  if (session.mustChangePassword) {
    throw new Error('กรุณาเปลี่ยนรหัสผ่านก่อนเริ่มบันทึกบทเรียน');
  }

  const cleanState = validateProgressState_(state, session);

  // โหมดทดลองไม่เขียนลงชีตใด ๆ ตาม Blueprint #113
  if (session.preview) {
    writePreviewState_(token, cleanState);
    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      preview: true,
      rewards: computeRewards_(cleanState)
    };
  }

  const json = JSON.stringify(cleanState);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSpreadsheet_().getSheetByName('Progress');
    const existing = findRowByValue_(sheet, 1, session.username);
    const now = new Date();
    const rowValues = [
      session.username,
      APP_CONFIG.stateVersion,
      json,
      cleanState.currentSection,
      cleanState.quiz.latestScore,
      cleanState.quiz.bestScore,
      cleanState.quiz.attempts,
      now
    ];

    if (existing > 0) {
      sheet.getRange(existing, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    appendAudit_(session.username, 'progress_save', 'success', 'Section ' + cleanState.currentSection);
    return {
      ok: true,
      updatedAt: now.toISOString(),
      rewards: computeRewards_(cleanState)
    };
  } finally {
    lock.releaseLock();
  }
}

/** Records a completed quiz attempt without accepting an incomplete attempt. */
function recordQuizAttempt(token, attempt) {
  const session = requireSession_(token);
  const input = attempt || {};
  const answers = input.answers;
  const questionCount = Number(input.maximumScore);
  const score = Number(input.score);
  const attemptNumber = Number(input.attemptNumber);

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('คำตอบแบบทดสอบไม่ครบ');
  }
  if (questionCount !== APP_CONFIG.quizQuestionCount) {
    throw new Error(
      'จำนวนข้อไม่ตรงกับที่ระบบกำหนด (' + APP_CONFIG.quizQuestionCount + ' ข้อ)'
    );
  }
  if (Object.keys(answers).length !== questionCount) {
    throw new Error('ต้องตอบให้ครบทุกข้อก่อนส่ง');
  }
  if (!Number.isInteger(score) || score < 0 || score > questionCount) {
    throw new Error('คะแนนไม่ถูกต้อง');
  }
  if (
    !Number.isInteger(attemptNumber) ||
    attemptNumber < 1 ||
    attemptNumber > APP_CONFIG.quizMaxAttempts
  ) {
    throw new Error('จำนวนครั้งที่ทำไม่ถูกต้อง');
  }

  // Prerequisite ฝั่งเซิร์ฟเวอร์ตาม Blueprint #16 และ #141
  // เดิมตรวจเงื่อนไขนี้ที่หน้าเว็บเท่านั้น จึงข้ามได้ด้วยการเรียก API ตรง
  let savedState = null;
  if (session.preview) {
    savedState = readPreviewState_(token, session);
  } else {
    const progressRow = findProgressRow_(session.username);
    if (progressRow) {
      try {
        savedState = JSON.parse(progressRow.progressJson);
      } catch (error) {
        savedState = null;
      }
    }
  }

  // โหมดทดลองแบบ free ให้ครูลองทำแบบทดสอบได้เลยโดยไม่ต้องไล่ทำครบทุกขั้น
  const doneBeforeQuiz = session.previewMode === 'free'
    ? QUIZ_SECTION_ORDER - 1
    : contiguousCompleted_(savedState ? savedState.completedSections : []).length;
  const requiredBeforeQuiz = QUIZ_SECTION_ORDER - 1;

  if (doneBeforeQuiz < requiredBeforeQuiz) {
    appendAudit_(
      session.username,
      'quiz_guard',
      'blocked',
      'ทำครบ ' + doneBeforeQuiz + '/' + requiredBeforeQuiz + ' ขั้นก่อนแบบทดสอบ'
    );
    throw new Error(
      'กรุณาทำกิจกรรม Section 1–' + requiredBeforeQuiz +
        ' ให้ครบก่อนส่งแบบทดสอบ (ตอนนี้ครบ ' + doneBeforeQuiz + ' ขั้น)'
    );
  }

  if (session.preview) {
    // ไม่เขียนประวัติการส่งของโหมดทดลองลงชีตของนักเรียนจริง
    return { ok: true, preview: true };
  }

  getSpreadsheet_().getSheetByName('Attempts').appendRow([
    new Date(),
    session.username,
    'final_quiz',
    score,
    questionCount,
    attemptNumber,
    JSON.stringify(answers)
  ]);

  appendAudit_(session.username, 'quiz_submit', 'success', score + '/' + questionCount);
  return { ok: true };
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
    // ฝั่งหน้าเว็บเคยเขียนเลข 8 ไว้ตายตัว พอเพิ่มขั้นสะท้อนผลเป็น 9 เลขจึงเพี้ยน
    totalSections: LESSON_SECTION_COUNT,
    students: students
  };
}

/**
 * Teacher Preview Mode — Blueprint #78 และ #113
 * สร้าง Synthetic Session ที่แยกขาดจากข้อมูลนักเรียนจริง
 * ความก้าวหน้าของโหมดนี้เก็บใน CacheService ไม่เขียนลงชีตใด ๆ
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
  CacheService.getScriptCache().remove(previewStateKey_(token));
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
  CacheService.getScriptCache().put(
    'session:' + token,
    JSON.stringify(session),
    APP_CONFIG.sessionTtlSeconds
  );
  return token;
}

function previewStateKey_(token) {
  return 'previewState:' + validateTokenFormat_(token);
}

function readPreviewState_(token, session) {
  const cached = CacheService.getScriptCache().get(previewStateKey_(token));
  if (!cached) return createDefaultProgress_(session);
  try {
    return JSON.parse(cached);
  } catch (error) {
    return createDefaultProgress_(session);
  }
}

function writePreviewState_(token, state) {
  CacheService.getScriptCache().put(
    previewStateKey_(token),
    JSON.stringify(state),
    APP_CONFIG.sessionTtlSeconds
  );
}

/**
 * Administrator-only item analysis — Blueprint #76 Learning Analytics และ #196
 * รวมคำตอบครั้งล่าสุดของนักเรียนแต่ละคน แล้วนับว่าแต่ละตัวเลือกถูกเลือกกี่ครั้ง
 * ไม่ส่งเฉลยกลับไป เพราะหน้าเว็บมีชุดคำถามและเฉลยอยู่แล้ว
 * จึงไม่เพิ่มที่เก็บเฉลยเป็นแหล่งที่สองให้ไม่ตรงกันภายหลัง
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
    choiceCounts: choiceCounts
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
        answers: answers
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

    if (state && typeof state === 'object' && !Array.isArray(state)) {
      state.quiz = {
        answers: {},
        latestScore: 0,
        bestScore: 0,
        attempts: 0,
        locked: false
      };
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
    }

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
      currentSection: 1,
      completedSections: [],
      hookAnswers: {},
      worksheet: {},
      reflection: null,
      quiz: {
        answers: {},
        latestScore: 0,
        bestScore: 0,
        attempts: 0,
        locked: false
      }
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

    if (state && typeof state === 'object' && !Array.isArray(state)) {
      state.quiz = beforeQuiz && typeof beforeQuiz === 'object' && !Array.isArray(beforeQuiz)
        ? beforeQuiz
        : {
            answers: {},
            latestScore: restored.latestScore,
            bestScore: restored.bestScore,
            attempts: restored.attempts,
            locked: false
          };
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
      // เขียนเลขขั้นคู่กับ JSON ด้วยเหตุผลเดียวกับตอนรีเซ็ต
      sheet.getRange(row, 3, 1, 2).setValues([[
        JSON.stringify(state), Number(state.currentSection) || 1
      ]]);
    }

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
    return [
      student.username,
      'student',
      student.studentNumber,
      student.displayName,
      hashPassword_(initialPassword, salt),
      salt,
      true,
      true,
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
  CacheService.getScriptCache().put(
    'session:' + token,
    JSON.stringify(session),
    APP_CONFIG.sessionTtlSeconds
  );
  return token;
}

function requireSession_(token) {
  const normalizedToken = validateTokenFormat_(token);
  if (!normalizedToken) {
    throw new Error('SESSION_EXPIRED');
  }
  const cache = CacheService.getScriptCache();
  const json = cache.get('session:' + normalizedToken);
  if (!json) {
    throw new Error('SESSION_EXPIRED');
  }
  cache.put('session:' + normalizedToken, json, APP_CONFIG.sessionTtlSeconds);
  return JSON.parse(json);
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
    return {
      id: step.id,
      title: step.title,
      kind: step.kind,
      unlockAfter: step.unlockAfter,
      unlocked: completed.indexOf(step.unlockAfter) !== -1,
      completed: saved.completed === true,
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

function createDefaultProgress_(session) {
  return {
    version: APP_CONFIG.stateVersion,
    username: session.username,
    currentSection: 1,
    completedSections: [],
    hookAnswers: {},
    worksheet: {},
    reflection: {},
    quiz: {
      answers: {},
      latestScore: 0,
      bestScore: 0,
      attempts: 0,
      locked: false
    }
  };
}

function validateProgressState_(state, session) {
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
  const latestScore = clampInteger_(quiz.latestScore, 0, APP_CONFIG.quizQuestionCount);
  const bestScore = clampInteger_(
    quiz.bestScore, latestScore, APP_CONFIG.quizQuestionCount
  );
  const attempts = clampInteger_(quiz.attempts, 0, APP_CONFIG.quizMaxAttempts);
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

  // ตัดขั้นที่ข้ามลำดับทิ้ง แล้วบันทึกไว้ใน Audit เพื่อให้ครูตรวจสอบย้อนหลังได้
  const uniqueCompleted = Array.from(new Set(rawCompleted)).sort(function (a, b) {
    return a - b;
  });
  const completedSections = session.previewMode === 'free'
    ? uniqueCompleted
    : contiguousCompleted_(rawCompleted);
  if (!session.preview && new Set(rawCompleted).size !== completedSections.length) {
    appendAudit_(
      session.username,
      'progress_guard',
      'blocked',
      'ข้ามลำดับขั้น ส่งมา [' + Array.from(new Set(rawCompleted)).sort().join(',') +
        '] รับได้ [' + completedSections.join(',') + ']'
    );
  }

  // โหมด free ของครูข้ามลำดับได้ เพราะเป็นข้อมูลจำลองที่ไม่กระทบใคร
  const currentSection = session.previewMode === 'free'
    ? requestedSection
    : Math.min(requestedSection, unlockedSection_(completedSections));

  return {
    version: APP_CONFIG.stateVersion,
    username: session.username,
    currentSection: currentSection,
    completedSections: completedSections,
    hookAnswers: sanitizeJsonObject_(state.hookAnswers),
    worksheet: sanitizeJsonObject_(state.worksheet),
    reflection: sanitizeJsonObject_(state.reflection),
    quiz: {
      answers: sanitizeJsonObject_(quiz.answers),
      latestScore: latestScore,
      bestScore: bestScore,
      attempts: attempts,
      locked: Boolean(quiz.locked)
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
