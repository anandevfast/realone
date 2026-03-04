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
3. เรียกใช้ `messages.service.ts` เพื่อจัดการ Business Logic
4. ใน Service ต้อง Inject `SocialQueryBuilderService` เข้ามาเพื่อช่วย build `$match` และ `$sort` pipeline
5. คืนค่ากลับไปเป็น Standard API Response format พร้อมข้อมูล Pagination


**Requirement:**
 - อยากให้ทำ API ตามนี้
    - 1.`POST /api/real-listening/messages/query`
        - 1.1`POST /api/real-listening/messages/update`
    - 1.`POST /api/real-listening/analytics/query`
    - 2.`POST /api/real-listening/sentiment/query`
    - 3.`POST /api/real-listening/influencer/query`
    - 4.`POST /api/real-listening/trend/query`
    - 5.`POST /api/real-listening/time/query`
    - 6.`POST /api/real-listening/location/query`
    - 7.`POST /api/real-listening/account-monitoring/query`
    - 8.`GET /api/real-listening/dashborad/:email`
        - 8.1 `POST /api/real-listening/dashborad/update`
        - 8.2 `DELETE /api/real-listening/dashborad/:id`
    - 9.`POST /api/real-listening/dashborad/widget/query`
        - 9.1 `POST /api/real-listening/dashborad/widget/update`
        - 9.2 `DELETE /api/real-listening/dashborad/widget/:id`
    - 10.`POST /api/real-listening/dashborad/widget/query`


- **Query Builder Service:** ดูตัวอย่างการทำงานของ Logic การแปลง DTO เป็น MongoDB Query ได้ที่ `src/modules/real-listening/common/services/social-query-builder.service.ts`
- **Controller/Service Pattern:** โปรเจกต์นี้ใช้โครงสร้างแบบ "Fat Service, Skinny Controller" Controller มีหน้าที่แค่รับ Request, Validate DTO, และ Return Response เท่านั้น (ดูตัวอย่างโครงสร้างได้ใน `src/auth/auth.controller.ts` ถ้ามี)
- **Mongoose Schema:** ดูโครงสร้าง Database ที่เราจะ query ได้ที่ `src/modules/real-listening/features/messages/schema/social-message.schema.ts`

