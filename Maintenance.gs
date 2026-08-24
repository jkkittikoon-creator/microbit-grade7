/**
 * Tilt Lab — ฟังก์ชันดูแลระบบ (แยกจาก Code.gs)
 * ใช้หลังติดตั้งระบบด้วย setupSystem() เรียบร้อยแล้ว
 *
 * showSetupStatus()        ดูสถานะการติดตั้งและรายชื่อบัญชี ไม่แสดงรหัสผ่าน
 * resetStudentPasswords()  ตั้งหรือรีเซ็ตรหัสผ่านนักเรียน
 * disablePasswordChangePrompt()  ปิดหน้าจอบังคับตั้งรหัสใหม่ทุกบัญชี
 *
 * รหัสผ่านนักเรียนใช้เกณฑ์ผ่อนปรน (4 ตัวขึ้นไป จะเป็นตัวเลขล้วนก็ได้)
 * เพราะเป็นรหัสที่ครูกำหนดให้ใช้ร่วมกันในชั้นเรียน
 * บัญชี admin ยังใช้เกณฑ์เข้ม 8 ตัว + ตัวอักษร + ตัวเลข เหมือนเดิม
 *
 * ไฟล์นี้ใช้ตัวช่วยจาก Code.gs ร่วมกัน จึงต้องอยู่ในโปรเจกต์เดียวกัน
 */

/**
 * Resets student passwords after setup, for a forgotten password.
 * 1) ตั้ง Script property RESET_STUDENT_PASSWORD เป็นรหัสใหม่
 * 2) ถ้าต้องการรีเซ็ตเฉพาะบางคน ตั้ง RESET_STUDENT_USERNAMES เช่น std003,std005
 *    ถ้าไม่ตั้ง ระบบจะรีเซ็ตนักเรียนทุกคน
 * 3) เรียกฟังก์ชันนี้ ระบบจะ hash รหัสใหม่แล้วลบ property ทิ้งทันที
 *
 * ตาม D-002 นักเรียนไม่มีหน้าจอเปลี่ยนรหัสผ่านด้วยตนเอง
 * การรีเซ็ตจึงตั้ง mustChangePassword เป็น false เสมอ
 */
function resetStudentPasswords() {
  const properties = PropertiesService.getScriptProperties();
  const password = String(properties.getProperty('RESET_STUDENT_PASSWORD') || '');

  if (!password) {
    throw new Error('กรุณาตั้ง RESET_STUDENT_PASSWORD ใน Script properties ก่อนเรียกฟังก์ชันนี้');
  }
  validateStudentPassword_(password);

  const requested = String(properties.getProperty('RESET_STUDENT_USERNAMES') || '')
    .split(',')
    .map(function (value) { return normalizeUsername_(value); })
    .filter(function (value) { return value !== ''; });

  const students = readDataObjects_(getSpreadsheet_().getSheetByName('Users'))
    .filter(function (row) { return String(row.role) === 'student'; })
    .map(function (row) { return String(row.username); });

  const missing = requested.filter(function (username) {
    return students.indexOf(username) === -1;
  });
  if (missing.length > 0) {
    throw new Error('ไม่พบบัญชีนักเรียน: ' + missing.join(', '));
  }

  const targets = requested.length > 0 ? requested : students;
  if (targets.length === 0) {
    throw new Error('ไม่พบบัญชีนักเรียนที่จะรีเซ็ต');
  }

  targets.forEach(function (username) {
    setUserPassword_(username, password);
  });

  // Plaintext exists only in a temporary Script property during the reset.
  properties.deleteProperty('RESET_STUDENT_PASSWORD');
  properties.deleteProperty('RESET_STUDENT_USERNAMES');
  properties.deleteProperty('RESET_STUDENT_MUST_CHANGE');
  appendAudit_(
    'system',
    'password_reset',
    'success',
    'รีเซ็ตรหัสผ่านนักเรียน ' + targets.length + ' บัญชี'
  );

  return {
    ok: true,
    count: targets.length,
    usernames: targets,
    mustChangePassword: false
  };
}

/**
 * ปิดหน้าจอ "ตั้งรหัสผ่านใหม่" ให้ทุกบัญชี โดยไม่แตะรหัสผ่านเดิม
 * ใช้เมื่อไม่ต้องการให้ระบบบังคับนักเรียนตั้งรหัสของตัวเองอีก
 * นักเรียนจะเข้าบทเรียนได้ทันทีด้วยรหัสที่ครูกำหนดให้
 */
function disablePasswordChangePrompt() {
  const sheet = getSpreadsheet_().getSheetByName('Users');
  const now = new Date();
  const changed = [];

  readDataObjects_(sheet).forEach(function (row) {
    if (!toBoolean_(row.mustChangePassword)) return;
    sheet.getRange(row._rowNumber, 8).setValue(false);
    sheet.getRange(row._rowNumber, 10).setValue(now);
    changed.push(String(row.username));
  });

  appendAudit_(
    'system',
    'password_prompt_disable',
    'success',
    'ปิดการบังคับตั้งรหัสใหม่ ' + changed.length + ' บัญชี'
  );

  return { ok: true, count: changed.length, usernames: changed };
}

/**
 * Reports what is configured, for use from the Apps Script editor.
 * Never returns a password, a stored hash, or a salt.
 */
function showSetupStatus() {
  const properties = PropertiesService.getScriptProperties();
  const status = getSetupStatus_();
  const report = {
    configured: status.configured === true,
    spreadsheetUrl: status.spreadsheetUrl || '',
    driveFolderUrl: status.driveFolderUrl || '',
    pendingPasswordProperties: [
      APP_CONFIG.initialPasswordProperty,
      APP_CONFIG.adminPasswordProperty,
      'RESET_STUDENT_PASSWORD'
    ].filter(function (key) { return Boolean(properties.getProperty(key)); }),
    accounts: []
  };

  if (report.configured) {
    report.accounts = readDataObjects_(getSpreadsheet_().getSheetByName('Users'))
      .map(function (row) {
        return {
          username: String(row.username),
          role: String(row.role),
          displayName: String(row.displayName),
          active: toBoolean_(row.active),
          mustChangePassword: toBoolean_(row.mustChangePassword)
        };
      });
  }

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function setUserPassword_(username, password) {
  const sheet = getSpreadsheet_().getSheetByName('Users');
  const row = findRowByValue_(sheet, 1, username);
  if (row < 2) throw new Error('ไม่พบบัญชีผู้ใช้ ' + username);
  const salt = createSalt_();
  sheet.getRange(row, 5, 1, 4).setValues([[
    hashPassword_(password, salt),
    salt,
    true,
    false
  ]]);
  sheet.getRange(row, 10).setValue(new Date());
}

/**
 * รหัสผ่านสำหรับบัญชีนักเรียนเท่านั้น ใช้เกณฑ์ผ่อนปรนกว่า validateNewPassword_
 * เพราะครูเป็นผู้กำหนดและเปลี่ยนให้ได้ตลอดผ่าน resetStudentPasswords()
 * บัญชี admin ยังคงใช้ validateNewPassword_ ที่เข้มกว่าเสมอ
 */
function validateStudentPassword_(password) {
  const value = String(password || '');
  if (value.length < 4 || value.length > 128) {
    throw new Error('รหัสผ่านนักเรียนต้องมีความยาว 4–128 ตัวอักษร');
  }
}
