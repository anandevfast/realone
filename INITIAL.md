# INITIAL.md

## Role:

คุญคือผู้เชี่ยวชาญด้าน Software Engineering ที่จะมาช่วยฉันทำงานให้มีประสิทธิภาพขึ้น เป็นผู้ที่รอบรู้ และใช้ tools ที่สมัยอยู่เสมอ

## Tech Stack:

**Framework:** NestJS (Node.js) `https://docs.nestjs.com/`
**Language:** TypeScript
**Database:** MongoDB (via Mongoose)
**Validation:** class-validator & class-transformer (Strict Payload Checking)
**Documentation:** Swagger / Postman

## Introduction:

- โปรเจกต์นี้คือระบบ Backend สำหรับแพลตฟอร์ม Real Smart Product (Revamped version) ซึ่งถูกยกระดับสถาปัตยกรรมจาก Node.js/Express เดิม มาเป็น NestJS เพื่อรองรับการขยายตัวของระบบ (Scalability), บังคับใช้โครงสร้างที่เป็นมาตรฐานระดับองค์กร (Enterprise-grade Architecture), และเพิ่มความปลอดภัยในการเขียนโค้ดด้วย Type-Safety (TypeScript)
- ระบบถูกออกแบบด้วยแนวคิด Modular Monolith โดยแบ่งแยก Business Logic ของแต่ละ Product (เช่น Real Listening, Real Media, Real Engagement) ออกจากกันอย่างชัดเจน เพื่อให้ง่ายต่อการดูแลรักษา ป้องกันโค้ดพันกัน (Spaghetti Code) และเตรียมพร้อมสำหรับการแยกย้ายเป็น Microservices ในอนาคต

## FEATURE:

- Focus ในส่วนของ /src/modules/real-listening เป็นหลักก่อน  
อยากให้ช่วย revamp หรือ refactor จาก logic เก่ามาเป็น version Nest.JS โดยยึดตามนี้

**Case Example:**

1. pattern ของ API-> `POST /api/real-listening/messages/query` ใน `messages.controller.ts`
2. รับข้อมูลผ่าน `MessageFilterDTO` ที่ extend มาจาก `FilterQueryDTO`
3. เรียกใช้ `messages.service.ts` เพื่อจัดการ Business Logic และ เรียกใช้ `messages.repository.ts` เพื่อจัดการกับ query ข้อมูล เพื่อ เข้ามาเพื่อช่วย build `$match` และ `$sort` เพื่อปั้น pipeline ให้ถูกต้องก่อน query ไป mongoose (ในส่วนนี้ถ้าหลายๆ feature ควรจะเป็นแบบไหนดี ไม่ให้ code รกจนเกินไป)

**Requirement:**

- อยากให้ทำ API ตามนี้ โดยสามารถสร้าง ภายใต้ modules/real-listening/features ได้เลย โดยจะต้อง migrate จาก file ต่างๆตาม context ภายใต้ folder `examples/real-listening`
  - 1.`POST /api/real-listening/messages/query` Ref. messages.js
    - 1.1`POST /api/real-listening/messages/count` Ref. messages-count.js
  - 2.`POST /api/real-listening/analytics/query`  Ref. analytics.js
    - API ถ้าดูจากของเดิม มันจะต้องยิง ทั้ง /overview และ /overviewCompare ทั้ง 2 API ถ้าเป็น version nestjs ช่วยรวมให้เป็น 1 เส้นเลย พร้อม optimize ให้ดีขึ้นด้วย
  - 3.`POST /api/real-listening/sentiment/query` Ref. sentiment.js
    - API ถ้าดูจากของเดิม มันจะต้องยิง ทั้ง /sentiment และ /sentimentCompare ทั้ง 2 API ถ้าเป็น version nestjs ช่วยรวมให้เป็น 1 เส้นเลย พร้อม optimize ให้ดีขึ้นด้วย
  - 4.`POST /api/real-listening/influencer/query` Ref. influencer.js
    - API ถ้าดูจากของเดิม มันจะต้องยิง ทั้ง /influencer, topInfluencer และ /topInfluencerPrevious ทั้ง 3 API เสมอ ถ้าเป็น version nestjs ช่วยรวมให้เป็น 1 เส้นเลย พร้อม optimize ให้ดีขึ้นด้วย
  - 5.`POST /api/real-listening/trend/query` Ref. trend.js
  - 6.`POST /api/real-listening/time/query` Ref. time.js
  - 7.`POST /api/real-listening/location/query` Ref. locatoion.js
- ฉันมี file /examples/raw.json ที่เป็นตัวอย่าง data จริงๆของแต่ละ channel มาไว้เพื่อเป็นข้อมูลประกอบ
- **Important** หากส่วนไหนที่คิดว่าควร optimize สามารถออกแบบและทำได้เลยเช่นปรับ pipeline ในแต่ละ aggregate ให้ดูง่ายขึ้น performance ดีขึ้น code ส่วนไหนทีซ้ำๆสามารถทำเป็น function หรือตัวแปลไว้ใช้ร่วมกันได้เลย และช่วยเขียนให้สามารถทำ test ได้ด้วย เพราะทุกๆที่ จะมีทั้งการทำ unit test , integration text , e2e เป็นต้น

