# Infisical – การใช้ secrets กับโปรเจกต์ realone

## สถานะตอนนี้

- มีการเชื่อมต่อ Infisical แล้ว (login / connect แล้ว)
- โปรเจกต์ใช้ `@nestjs/config` โหลด env จาก `process.env` และ `.env` อยู่แล้ว

## ขั้นตอนที่ต้องทำต่อ

### 1. เติม `workspaceId` ใน `.infisical.json`

ไฟล์ `.infisical.json` ต้องมี `workspaceId` ของ project ใน Infisical จึงจะดึง secrets ได้

**วิธีที่ 1 (แนะนำ):** รันในโฟลเดอร์โปรเจกต์

```bash
cd /Users/anan_s/realone
infisical init
```

คำสั่งนี้จะถามให้เลือก project + environment แล้วจะเขียน `workspaceId` และ `defaultEnvironment` ลงใน `.infisical.json` ให้เอง

**วิธีที่ 2:** คัดลอกจาก Infisical Dashboard

- เปิด [Infisical](https://app.infisical.com) → เลือก Project
- ไปที่ **Project Settings** → คัดลอก **Project ID** (หรือ Workspace ID)
- เปิด `.infisical.json` แล้วใส่ในฟิลด์ `"workspaceId": "ใส่-id-ตรงนี้"`

ตัวอย่างหลังเติมแล้ว:

```json
{
  "workspaceId": "63ee5410a45f7a1ed39ba118",
  "defaultEnvironment": "dev",
  "gitBranchToEnvironmentMapping": null
}
```

- `defaultEnvironment`: ใช้ environment ไหนเป็นค่าเริ่มต้น (เช่น `dev`, `staging`, `prod`)
- `gitBranchToEnvironmentMapping`: ถ้าต้องการให้ branch ตรงกับ environment อัตโนมัติ (ถ้าไม่ใช้ให้เป็น `null`)

### 2. ใส่ secrets ใน Infisical

ใน Infisical Dashboard ของ project นี้ ให้สร้าง environment (เช่น `dev`) แล้วเพิ่ม key ที่แอปใช้ (ให้ตรงกับที่อยู่ใน `.env` / `env.schema.ts`) เช่น:

- `NODE_ENV`, `APP_PORT`, `APP_TZ`, `APP_SERVER_TIMEOUT`
- `AUTH_JWT_SECRET`, `AUTH_JWT_EXPIRES_IN`
- `MONGO_*`, `MYSQL_*`
- และตัวแปรอื่นๆ ที่แอปอ่านจาก `process.env`

ถ้าค่าบางตัวยังอยากใช้จาก `.env` ในเครื่อง ก็ใส่แค่ใน Infisical เฉพาะตัวที่อยากให้มาจาก Infisical (เช่น secrets, DB password) ได้

### 3. รันแอปด้วย Infisical

เมื่อ `.infisical.json` มี `workspaceId` แล้ว ให้รันแอปผ่าน Infisical เพื่อให้ secrets ถูก inject เป็น env:

```bash
npm run start:dev:infisical
```

หรือตรงๆ:

```bash
infisical run -- nest start --watch
```

ถ้าต้องการระบุ environment ชัดเจน:

```bash
infisical run --env=staging -- nest start --watch
```

แอปจะได้ env จาก Infisical ผ่าน `process.env` และ NestJS ConfigModule จะอ่านได้ตามเดิม

### 4. เกี่ยวกับไฟล์ `.env`

- **ไม่ต้องลบ `.env`** – ใช้เป็น fallback หรือค่าที่รันเฉพาะเครื่องได้
- ตอนรันด้วย `infisical run` ค่าจาก Infisical จะถูก inject เข้า `process.env` ก่อน แล้ว NestJS ค่อยโหลด `.env` (โดยปกติจะไม่ override ค่าที่มีอยู่แล้ว)
- แนะนำ: อย่า commit ค่า secret จริงใน `.env` ลง git ใช้ Infisical เป็นแหล่งหลักสำหรับ secret

## สรุปสั้นๆ

| ขั้นตอน | สิ่งที่ทำ |
|--------|-----------|
| 1 | เติม `workspaceId` ใน `.infisical.json` (รัน `infisical init` หรือ copy จาก Dashboard) |
| 2 | ใส่ secrets ใน Infisical ให้ตรงกับ key ที่แอปใช้ |
| 3 | รันแอปด้วย `npm run start:dev:infisical` (หรือ `infisical run -- nest start --watch`) |

ถ้าต้องการใช้หลาย environment (dev/staging/prod) ให้สร้างหลาย environment ใน Infisical แล้วใช้ `--env=...` ตอนรัน หรือตั้ง `gitBranchToEnvironmentMapping` ใน `.infisical.json`
