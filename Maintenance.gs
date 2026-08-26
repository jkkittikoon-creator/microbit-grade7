/**
 * Tilt Lab — ฟังก์ชันดูแลระบบ (แยกจาก Code.gs)
 * ใช้หลังติดตั้งระบบด้วย setupSystem() เรียบร้อยแล้ว
 *
 * showSetupStatus()        ดูสถานะการติดตั้งและรายชื่อบัญชี ไม่แสดงรหัสผ่าน
 * resetStudentPasswords(token, payload)  API สำหรับ admin ที่ผ่าน role guard
 * rotateStudentPasswords_(actor, password, request)  private rotation implementation
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
 * payload.password รับรหัสใหม่ไว้เฉพาะในหน่วยความจำของ execution
 * payload.scope ต้องเป็น selected หรือ all; all ต้องยืนยันด้วย confirmAllStudents: true
 * payload.usernames ใช้เฉพาะ scope selected และต้องมีอย่างน้อยหนึ่งบัญชี
 *
 * ตาม D-002 นักเรียนไม่มีหน้าจอเปลี่ยนรหัสผ่านด้วยตนเอง
 * การรีเซ็ตจึงตั้ง mustChangePassword เป็น false เสมอ
 */
function resetStudentPasswords(token, payload) {
  const session = requireRole_(token, 'admin');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('รูปแบบคำขอหมุนเวียนรหัสไม่ถูกต้อง');
  }
  const input = payload;
  if (typeof input.password !== 'string') {
    throw new Error('รหัสนักเรียนใหม่ต้องเป็นข้อความ');
  }
  const password = input.password;
  validateStudentPassword_(password);

  let request;
  if (input.scope === 'all') {
    if (
      input.confirmAllStudents !== true ||
      Object.prototype.hasOwnProperty.call(input, 'usernames')
    ) {
      throw new Error('การหมุนเวียนรหัสนักเรียนทุกคนต้องยืนยันขอบเขตอย่างชัดเจน');
    }
    request = { allStudents: true, usernames: [] };
  } else if (input.scope === 'selected') {
    let usernameValues;
    if (Array.isArray(input.usernames)) {
      if (
        input.usernames.length === 0 ||
        input.usernames.some(function (value) { return typeof value !== 'string'; })
      ) {
        throw new Error('กรุณาเลือกบัญชีนักเรียนอย่างน้อยหนึ่งบัญชี');
      }
      usernameValues = input.usernames;
    } else if (typeof input.usernames === 'string' && input.usernames.trim()) {
      usernameValues = input.usernames.split(',');
    } else {
      throw new Error('กรุณาเลือกบัญชีนักเรียนอย่างน้อยหนึ่งบัญชี');
    }

    const requested = Array.from(new Set(
      usernameValues.map(function (value) { return normalizeUsername_(value); })
    ));
    if (
      requested.length === 0 ||
      requested.some(function (username) {
        return !/^[a-z0-9._-]{4,40}$/.test(username);
      })
    ) {
      throw new Error('รายการบัญชีนักเรียนไม่ถูกต้อง');
    }
    request = { allStudents: false, usernames: requested };
  } else {
    throw new Error('กรุณาระบุขอบเขตการหมุนเวียนรหัสเป็น selected หรือ all');
  }

  return rotateStudentPasswords_(session.username, password, request);
}

function rotateStudentPasswords_(actor, password, request) {
  if (
    typeof password !== 'string' ||
    !request ||
    typeof request !== 'object' ||
    Array.isArray(request) ||
    typeof request.allStudents !== 'boolean' ||
    !Array.isArray(request.usernames) ||
    request.usernames.some(function (username) {
      return typeof username !== 'string' || !/^[a-z0-9._-]{4,40}$/.test(username);
    }) ||
    (request.allStudents && request.usernames.length !== 0) ||
    (!request.allStudents && request.usernames.length === 0)
  ) {
    throw new Error('ROTATION_NOT_STARTED: ขอบเขตการหมุนเวียนรหัสไม่ถูกต้อง');
  }
  const requested = Array.from(new Set(request.usernames));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ROTATION_NOT_STARTED: มีงานยืนยันตัวตนอื่นกำลังทำงาน กรุณาลองใหม่');
  }

  let properties = null;
  let targetCount = 0;
  let markerAttemptedCount = 0;
  let markerConfirmedCount = 0;
  let passwordUpdatedCount = 0;
  let epochAdvancedCount = 0;
  let markerClearedCount = 0;
  let failure = null;
  let result = null;
  const expectedEpochs = new Map();

  try {
    properties = PropertiesService.getScriptProperties();
    const students = Array.from(new Set(
      readDataObjects_(getSpreadsheet_().getSheetByName('Users'))
        .filter(function (row) { return String(row.role) === 'student'; })
        .map(function (row) { return normalizeUsername_(row.username); })
        .filter(function (username) { return username !== ''; })
    ));

    const missingCount = requested.filter(function (username) {
      return students.indexOf(username) === -1;
    }).length;
    if (missingCount > 0) {
      throw new Error('ไม่พบบัญชีนักเรียนตามรายการ ' + missingCount + ' บัญชี');
    }

    const targets = request.allStudents ? students : requested;
    targetCount = targets.length;
    if (targetCount === 0) {
      throw new Error('ไม่พบบัญชีนักเรียนที่จะรีเซ็ต');
    }

    // Block every selected student before the first password mutation.
    targets.forEach(function (username) {
      markerAttemptedCount += 1;
      beginStudentCredentialRotation_(username, properties);
      markerConfirmedCount += 1;
    });

    targets.forEach(function (username) {
      setUserPassword_(username, password);
      passwordUpdatedCount += 1;
      const epoch = advanceStudentSessionEpoch_(username, properties);
      expectedEpochs.set(username, epoch);
      epochAdvancedCount += 1;
    });

    // Clear ROTATING only after every target has a verified password update and new epoch.
    targets.forEach(function (username) {
      const expectedEpoch = expectedEpochs.get(username);
      const state = getStudentAuthState_(username, properties);
      if (!state.rotating || state.epoch !== expectedEpoch) {
        throw new Error('ROTATION_STATE_UNAVAILABLE');
      }
    });
    targets.forEach(function (username) {
      completeStudentCredentialRotation_(username, expectedEpochs.get(username), properties);
      markerClearedCount += 1;
    });

    result = {
      ok: true,
      count: passwordUpdatedCount,
      sessionsRevoked: epochAdvancedCount,
      mustChangePassword: false
    };
  } catch (error) {
    failure = error;
  } finally {
    lock.releaseLock();
  }

  if (failure) {
    try {
      appendAudit_(
        actor,
        'password_reset',
        'failure',
        'หมุนเวียนรหัสนักเรียนไม่สำเร็จ: blocked ' + markerConfirmedCount +
          ', password ' + passwordUpdatedCount +
          ', epoch ' + epochAdvancedCount + ', unblocked ' + markerClearedCount +
          ' จาก ' + targetCount + ' บัญชี'
      );
    } catch (ignored) {
      // The audit destination may be unavailable; never log the rotation input.
    }
    if (markerAttemptedCount > 0 || passwordUpdatedCount > 0) {
      throw new Error(
        'ROTATION_REMEDIATION_REQUIRED: การหมุนเวียนไม่สมบูรณ์ บัญชีที่ยังถูกปิดกั้นต้องเรียกซ้ำ ' +
          'ด้วยรหัสชุดใหม่สำหรับเป้าหมายทั้งหมด'
      );
    }
    throw new Error('ROTATION_NOT_STARTED: ไม่ได้เปลี่ยนข้อมูลบัญชี กรุณาตรวจรายการแล้วลองใหม่');
  }

  try {
    appendAudit_(
      actor,
      'password_reset',
      'success',
      'หมุนเวียนรหัสนักเรียนสำเร็จ ' + passwordUpdatedCount + ' บัญชี และยกเลิกเซสชันเดิมแล้ว'
    );
  } catch (ignored) {
    // Rotation is already complete; audit availability must not re-block valid accounts.
  }
  return result;
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
      APP_CONFIG.adminPasswordProperty
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
  const user = findUser_(username);
  if (!user || user.role !== 'student') {
    throw new Error('ไม่พบบัญชีนักเรียนสำหรับหมุนเวียนรหัส');
  }
  const sheet = getSpreadsheet_().getSheetByName('Users');
  const hashAndSaltRange = sheet.getRange(user.rowNumber, 5, 1, 2);
  const mustChangePasswordCell = sheet.getRange(user.rowNumber, 8);
  const updatedAtCell = sheet.getRange(user.rowNumber, 10);
  const salt = createSalt_();
  const passwordHash = hashPassword_(password, salt);
  const updatedAt = new Date();
  hashAndSaltRange.setValues([[passwordHash, salt]]);
  mustChangePasswordCell.setValue(false);
  updatedAtCell.setValue(updatedAt);

  const verifiedHashAndSalt = hashAndSaltRange.getValues()[0];
  const verifiedMustChangePassword = mustChangePasswordCell.getValue();
  const verifiedUpdatedAt = updatedAtCell.getValue();
  if (
    !constantTimeEqual_(String(verifiedHashAndSalt[0]), passwordHash) ||
    String(verifiedHashAndSalt[1]) !== salt ||
    verifiedMustChangePassword !== false ||
    serializeDate_(verifiedUpdatedAt) !== updatedAt.toISOString()
  ) {
    throw new Error('PASSWORD_UPDATE_NOT_VERIFIED');
  }
}

/**
 * รหัสผ่านสำหรับบัญชีนักเรียนเท่านั้น ใช้เกณฑ์ผ่อนปรนกว่า validateNewPassword_
 * เพราะครูเป็นผู้กำหนดและเปลี่ยนให้ได้ตลอดผ่าน resetStudentPasswords(token, payload)
 * บัญชี admin ยังคงใช้ validateNewPassword_ ที่เข้มกว่าเสมอ
 */
function validateStudentPassword_(password) {
  const value = String(password || '');
  if (value.length < 4 || value.length > 128) {
    throw new Error('รหัสผ่านนักเรียนต้องมีความยาว 4–128 ตัวอักษร');
  }
}
