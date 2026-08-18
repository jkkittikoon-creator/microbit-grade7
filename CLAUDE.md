# CAI Project Development Instructions

โปรเจกต์นี้เป็นระบบบทเรียนออนไลน์ CAI ที่มีระบบเดิมอยู่แล้ว

เป้าหมายคือพัฒนาและปรับปรุงระบบเดิม
ไม่ใช่สร้างโปรเจกต์ใหม่

ก่อนทำงานเกี่ยวกับบทเรียน นักเรียน ครู เกม การประเมิน
Progress Navigation Reward หรือ Learning UX
ให้อ่าน:

@docs/FULL_MASTER_BLUEPRINT_CAI_COMPLETE.md

ให้ถือ Blueprint นี้เป็น System Source of Truth
สำหรับการพัฒนาระบบ CAI

## Existing Project First

ต้องตรวจสอบระบบเดิมก่อนเสมอ

ใช้ลำดับ:

1. Reuse existing code
2. Extend existing code
3. Refactor when necessary
4. Create new components only when needed

ห้าม Rewrite ระบบทั้งหมดโดยไม่จำเป็น

## Data Safety

ห้าม:

- Reset database
- ลบข้อมูลนักเรียน
- ลบคะแนน
- ลบ progress
- ลบบัญชีผู้ใช้
- เปลี่ยน schema โดยไม่มี migration
- ทำลายระบบเดิมที่ใช้งานได้

## Learning Design

ให้นักเรียนเป็น Zero-Knowledge Learner โดยค่าเริ่มต้น

- อธิบายจากง่ายไปยาก
- ใช้ภาษาไทยเข้าใจง่ายตามวัย
- ใช้ตัวอย่างจากชีวิตจริงของนักเรียน
- เน้นภาพ ตัวอย่าง และการปฏิบัติ
- หนึ่งช่วงเน้นหนึ่งแนวคิดหลัก
- มี Practice
- Mini Game
- Mission
- Feedback
- Hint
- Remediation

## Navigation

ใช้หลัก:

ย้อนกลับได้ แต่ข้าม Required Step ไปข้างหน้าไม่ได้

ต้องมี:

- Guided Navigation
- Progress
- Next Required Step
- Auto Resume
- Lesson Lock
- Prerequisite
- Backend validation

## Development Rules

ก่อนแก้ Feature ใหญ่:

1. ตรวจระบบเดิม
2. ระบุไฟล์ที่เกี่ยวข้อง
3. วิเคราะห์ผลกระทบ
4. เสนอแผน
5. แก้แบบ incremental
6. ทดสอบ
7. รายงานสิ่งที่เปลี่ยน

## Testing

หลังการเปลี่ยนแปลงสำคัญ ต้องตรวจ:

- Student View
- Teacher View
- Teacher Preview
- Mobile
- Desktop
- Progress
- Resume
- Navigation
- Lock
- Assessment
- Game
- Reward