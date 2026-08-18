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
  spreadsheetProperty: 'TILT_LAB_SPREADSHEET_ID',
  driveFolderProperty: 'TILT_LAB_DRIVE_FOLDER_ID',
  initialPasswordProperty: 'INITIAL_STUDENT_PASSWORD'
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
    schoolName: APP_CONFIG.schoolName
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
  const row = findProgressRow_(session.username);

  if (!row) {
    return {
      ok: true,
      state: createDefaultProgress_(session),
      updatedAt: null
    };
  }

  let state;
  try {
    state = JSON.parse(row.progressJson);
  } catch (error) {
    appendAudit_(session.username, 'progress_read', 'failed', 'progressJson ไม่ถูกต้อง');
    throw new Error('ข้อมูลความก้าวหน้าเสียหาย กรุณาแจ้งครูผู้สอน');
  }

  return { ok: true, state: state, updatedAt: row.updatedAt };
}

/** Validates and upserts the current student's progress. */
function saveProgress(token, state) {
  const session = requireSession_(token);
  if (session.mustChangePassword) {
    throw new Error('กรุณาเปลี่ยนรหัสผ่านก่อนเริ่มบันทึกบทเรียน');
  }

  const cleanState = validateProgressState_(state, session);
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
    return { ok: true, updatedAt: now.toISOString() };
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
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
    throw new Error('จำนวนข้อไม่ถูกต้อง');
  }
  if (Object.keys(answers).length !== questionCount) {
    throw new Error('ต้องตอบให้ครบทุกข้อก่อนส่ง');
  }
  if (!Number.isInteger(score) || score < 0 || score > questionCount) {
    throw new Error('คะแนนไม่ถูกต้อง');
  }
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1 || attemptNumber > 3) {
    throw new Error('จำนวนครั้งที่ทำไม่ถูกต้อง');
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
    students: students
  };
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

  progressRows.forEach(function (row) {
    progressByUsername[row.username] = {
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
      active: toBoolean_(user.active)
    }, progressByUsername[user.username] || {
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

  const currentSection = Number(state.currentSection);
  if (!Number.isInteger(currentSection) || currentSection < 1 || currentSection > 8) {
    throw new Error('Section ปัจจุบันไม่ถูกต้อง');
  }

  const quiz = state.quiz || {};
  const latestScore = clampInteger_(quiz.latestScore, 0, 6);
  const bestScore = clampInteger_(quiz.bestScore, latestScore, 6);
  const attempts = clampInteger_(quiz.attempts, 0, 3);
  const completedSections = Array.isArray(state.completedSections)
    ? state.completedSections
        .map(Number)
        .filter(function (section) {
          return Number.isInteger(section) && section >= 1 && section <= 8;
        })
    : [];

  return {
    version: APP_CONFIG.stateVersion,
    username: session.username,
    currentSection: currentSection,
    completedSections: Array.from(new Set(completedSections)).sort(),
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
