# แผนหมุนเวียน Credential นักเรียน

**สถานะ:** CLOSED สำหรับ TEST และ Production · TEST หมุนเวียน 2 บัญชี/ยกเลิกเซสชันเดิม 2 บัญชี · Production v38 หมุนเวียน 7 บัญชี/ยกเลิกเซสชันเดิม 7 บัญชี · fresh login และข้อมูลการเรียนคงอยู่ผ่าน  
**วันที่:** 29 ส.ค. 2569  
**เหตุผล:** เคยมีหลักฐานค่ารหัสนักเรียนอยู่ในไฟล์ที่ Git ติดตาม จึงต้องถือว่าค่าเดิมถูกเปิดเผย แม้จะลบออกจากเอกสารใน working tree แล้ว ค่าเดิมยังอยู่ใน Git HEAD/history จนกว่าจะมีการจัดการแยกต่างหาก

## ขอบเขตและข้อห้าม

- แผนนี้รักษา D-002: นักเรียนไม่เปลี่ยนรหัสเอง และยังใช้เกณฑ์รหัสนักเรียน 4–128 ตัวอักษร
- การหมุนเวียน TEST และ Production เป็นคนละการอนุมัติ ห้ามนำสิทธิ์ของ environment หนึ่งไปใช้กับอีก environment
- ห้ามส่งหรือบันทึกค่ารหัสใหม่ในแชต, Git, เอกสาร, screenshot, terminal output, log หรือ audit
- ผู้ใช้ต้องกรอกค่ารหัสใหม่โดยตรงในหน้า admin ที่เชื่อถือได้
- ห้ามย้อนกลับไปใช้ค่าที่เคยเปิดเผย หากต้อง rollback ให้สร้างค่าชุดใหม่อีกชุด
- การหมุนเวียน credential ไม่ใช่คำสั่ง deploy และห้ามเปลี่ยน deployment โดยปริยาย

## การควบคุมหลักฐานใน Git

- working tree ปัจจุบันต้องไม่มีค่ารหัสจริงใน `docs/DEVIATIONS.md`
- ห้ามแสดง `git diff` ของบรรทัดเดิมแบบไม่ปิดบัง เพราะ diff จาก HEAD ยังมีค่าที่ถูกลบ
- commit การลบค่า, push และการเขียน Git history ใหม่เป็นคนละการอนุมัติ
- หาก repository เคยถูกแชร์หรือ push ให้ถือว่าค่าเดิมกู้คืนจาก history ได้และต้องหมุนเวียน ไม่ว่าภายหลังจะ rewrite history หรือไม่
- History rewrite เป็นการเปลี่ยนแปลงแบบทำลายประวัติ ต้องได้รับอนุมัติเฉพาะ ระบุ remote/branch และมีแผนประสานทุก clone; แผนนี้ยังไม่อนุญาตให้ดำเนินการ

## กลไกที่มีอยู่และควรใช้

ใช้ `resetStudentPasswords(token, payload)` ซึ่งมี server-side admin role guard และส่งต่อไปยัง `rotateStudentPasswords_()` กลไกปัจจุบันทำงานภายใต้ `LockService` และมีลำดับดังนี้:

1. ตรวจรูปแบบคำขอและขอบเขต `selected` หรือ `all`
2. ปิดกั้นบัญชีเป้าหมายด้วยสถานะ rotation ก่อนเปลี่ยนข้อมูล
3. อัปเดตรหัสผ่านและตรวจยืนยันผลต่อบัญชี
4. เพิ่ม student session epoch เพื่อยกเลิก session เดิม
5. ปลดสถานะ rotation เมื่อทุกบัญชีผ่านการตรวจยืนยัน
6. บันทึก audit เฉพาะจำนวนและผลสำเร็จ/ล้มเหลว โดยไม่บันทึกค่ารหัส

ระหว่างเตรียมหมุนเวียน TEST พบว่า deployment version 3 มี API ฝั่งเซิร์ฟเวอร์แล้ว แต่หน้า admin ยังไม่มีฟอร์มเรียก API นี้ จึงเพิ่มฟอร์มโดยไม่บันทึกรหัสและ push ไป TEST HEAD หลังได้รับอนุมัติแล้ว โดย pull กลับมาตรวจ hash ตรงกับ local ครบทั้ง 4 ไฟล์ ผู้ใช้อนุมัติ `Deploy TEST v4` แต่ตรวจพบว่า Apps Script มี version 4 และ 5 จากงานทดสอบเดิมอยู่แล้ว จึงหยุดก่อน mutation จากนั้นผู้ใช้สั่งทำต่อโดยอ้างอิง version ใหม่ที่ถูกต้อง ระบบจึงสร้าง version 6 และอัปเดต deployment ID เดิมของ TEST เท่านั้น Smoke test ยืนยันว่า Admin session และฟอร์มหมุนเวียนรหัสทำงานใน `/exec` แล้ว ต่อมาผู้ใช้กรอกค่ารหัสใหม่ใน browser โดยตรงและอนุมัติให้ดำเนินการ ระบบหมุนเวียนสำเร็จ 2 บัญชีและยกเลิกเซสชันเดิม 2 บัญชี โดยไม่ส่งหรือบันทึกค่ารหัสในแชตหรือเอกสาร หลังรีเฟรช Admin dashboard บัญชีสังเคราะห์ `test_student_01` ยังคงอยู่ Section 4/9 คะแนนล่าสุดและคะแนนสูงสุด 0/6 ทำแบบทดสอบ 0 ครั้ง สถานะกำลังเรียน จากนั้นผู้ใช้เข้าสู่ระบบบัญชีเดิมด้วยรหัสใหม่สำเร็จ หน้า Student คืนความก้าวหน้า 4/9, quiz attempts 0/3 และ worksheet `accelY = -417 mg` ครบ

Production closeout เมื่อ 29 ส.ค. 2569 ใช้ Security-Only RC ที่ผ่าน isolated runtime regression 13/13 และ deploy ไปยัง Production deployment เดิมเป็น immutable version 38 โดยไม่รวม lesson X/Y candidate จาก working tree จากนั้น Admin rotation form หมุนเวียนบัญชีนักเรียนจริงครบ 7 บัญชีและเพิ่ม session epoch ครบ 7 บัญชี ระบบรายงานยกเลิกเซสชันเดิม 7 บัญชี ช่องรหัสในหน้า admin ถูกล้างทันที ผู้ใช้ทำ fresh login ของ `std001` ด้วยค่าชุดใหม่ที่กรอกเองสำเร็จ และระบบคืนความก้าวหน้า 5/9, 50 XP, 2 Badge, quiz 0/3 attempts และ worksheet state เดิม ข้อมูลสรุปนักเรียนทั้ง 7 คนตรงกับ baseline ก่อนหมุนเวียนทุกแถว Admin session และ Teacher Preview ยังคงทำงาน และไม่พบ password/credential/secret key ใน browser localStorage/sessionStorage การ deploy/rotation รอบนี้ไม่ commit, push หรือ rewrite Git history

## ขั้นตอนก่อนหมุนเวียน

1. ผู้ใช้ระบุ environment ให้ชัดเจนว่า `TEST` หรือ `Production`
2. ยืนยัน Apps Script project/deployment ปัจจุบันว่าเป็น target ที่ตั้งใจ
3. ระบุขอบเขตบัญชี: รายบัญชี (`selected`) หรือทุกบัญชีนักเรียน (`all`)
4. ตรวจว่ามี admin session ที่ถูกต้อง โดยไม่เปิดเผย token หรือรหัส
5. บันทึก baseline ที่ไม่อ่อนไหว: จำนวนบัญชี, progress, คะแนน และจำนวน session ที่คาดว่าจะถูกยกเลิก
6. สำหรับ `all` ต้องยืนยัน `confirmAllStudents: true` ที่หน้า admin

## ขั้นตอนดำเนินการเมื่อได้รับอนุมัติแยกต่างหาก

1. ผู้ใช้กรอกรหัสชุดใหม่โดยตรงในหน้า admin; ผู้ช่วยห้ามอ่าน คัดลอก หรือรับค่าผ่านแชต
2. เรียกเส้นทาง admin `resetStudentPasswords` สำหรับ target ที่อนุมัติเท่านั้น
3. ตรวจผลตอบกลับ `ok`, จำนวนบัญชี และจำนวน session ที่ถูกยกเลิก โดยไม่ตรวจหรือแสดงค่ารหัส
4. หากได้ `ROTATION_NOT_STARTED` ให้แก้ขอบเขตคำขอแล้วลองใหม่ได้ โดยยังไม่มีข้อมูลบัญชีเปลี่ยน
5. หากได้ `ROTATION_REMEDIATION_REQUIRED` ให้ถือว่าบัญชีอาจอยู่ในสถานะกึ่งกลาง และเรียกซ้ำกับ target เดิมทั้งหมดด้วยรหัสชุดใหม่ ห้ามใช้ค่าเดิม

## การตรวจหลังหมุนเวียน

1. ยืนยันว่า session นักเรียนเดิมใช้ต่อไม่ได้
2. ให้ผู้ใช้เข้าสู่ระบบหนึ่งบัญชีด้วยค่าชุดใหม่โดยกรอกเองใน browser
3. ตรวจว่า progress, คะแนน, quiz attempts และ worksheet เดิมยังอยู่ครบ
4. ตรวจว่า admin login และ Teacher Preview ไม่ได้รับผลกระทบ
5. ตรวจ audit ว่ามีเฉพาะ actor, จำนวนบัญชี, เวลา และผลลัพธ์ ไม่มี credential, hash, salt หรือ token
6. ตรวจ Script Properties ว่าไม่มีค่า initial password ค้างอยู่หลัง setup/rotation

## เกณฑ์ปิดเหตุการณ์

ปิด Production blocker ได้เมื่อครบทุกข้อ:

- ไม่มีค่ารหัสจริงอยู่ในไฟล์ Git-tracked ปัจจุบัน
- environment ที่ได้รับผลกระทบได้รับการหมุนเวียนผ่านกลไก admin ที่อนุมัติ
- session เดิมถูกยกเลิกและ login ด้วยค่าชุดใหม่ผ่าน
- progress และคะแนนไม่เปลี่ยนโดยไม่ตั้งใจ
- audit และเอกสารไม่มี credential
- มีการตัดสินใจเรื่อง commit/push และ Git history อย่างชัดเจน โดยไม่เผยค่าที่ถูกลบใน review output

## สถานะการอนุมัติและงานที่แยกออกไป

- `Rotate TEST student credentials` — COMPLETE เมื่อ 29 ส.ค. 2569: 2 บัญชี, revoke 2 sessions, fresh login และ progress/worksheet resume ผ่าน
- `Deploy Production Security-Only RC` — COMPLETE เมื่อ 29 ส.ค. 2569: deployment เดิมชี้ immutable v38 และ immediate post-deploy verification ผ่าน
- `Rotate Production student credentials` — COMPLETE เมื่อ 29 ส.ค. 2569: 7 บัญชี, revoke 7 sessions, fresh login และ data preservation ผ่าน
- commit/push ยังไม่ได้รับอนุมัติและไม่ได้ดำเนินการ
- Git history rewrite ยังไม่ได้รับอนุมัติและไม่ได้ดำเนินการ ถือเป็นงาน security/repository แยกต่างหากและไม่ทำให้ Production credential/session blocker เปิดค้างอีก
