# RealOne Backend

> **Enterprise-grade backend API** for **RealSmart Products** — a complete rewrite of the legacy Node.js/Express codebase in **NestJS**, designed for scalability, maintainability, and type safety.

[NestJS](https://nestjs.com/)
[TypeScript](https://www.typescriptlang.org/)
[MongoDB](https://www.mongodb.com/)
[License]()

---

## 🎯 Overview

**RealOne** is the unified backend platform powering multiple RealSmart products including:

- **Real Listening** – Social media monitoring & analytics
- **Real Media** – Media intelligence & PR tracking
- **Real Engagement** – Audience engagement analytics

Built with a **Modular Monolith** architecture, each product module is isolated and independently testable, while sharing common infrastructure—ready to scale into microservices when needed.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              API Gateway (NestJS)               │
├─────────────────────────────────────────────────┤
│  Auth Layer  │  Rate Limit  │  Global Filters  │
├──────────────┴───────────────┴──────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ Real         │  │ Real         │           │
│  │ Listening    │  │ Media        │  ...      │
│  │              │  │              │           │
│  │ • Messages   │  │ • Publishers │           │
│  │ • Analytics  │  │ • Monitoring │           │
│  │ • Sentiment  │  └──────────────┘           │
│  │ • Influencer │                              │
│  │ • Trend      │                              │
│  │ • Time       │                              │
│  │ • Location   │                              │
│  └──────────────┘                              │
│                                                 │
├─────────────────────────────────────────────────┤
│          Core Infrastructure                    │
│  • MongoDB (Mongoose)                          │
│  • Cache (cache-manager)                       │
│  • Queue (planned)                             │
└─────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
realone/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   │
│   ├── auth/                      # Authentication (JWT)
│   │   ├── guards/
│   │   ├── strategies/
│   │   └── decorators/
│   │
│   ├── config/                    # Environment configuration
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── auth.config.ts
│   │   └── env.schema.ts          # Joi validation for .env
│   │
│   ├── core/                      # Shared infrastructure
│   │   ├── database/              # MongoDB setup, BaseRepository
│   │   ├── filters/               # Global exception filters
│   │   ├── interceptors/          # Response transformation, logging
│   │   ├── middleware/            # Request ID, etc.
│   │   └── rate-limit/            # Rate limiting
│   │
│   └── modules/                   # Business logic modules
│       ├── real-listening/        # Social Listening platform
│       │   ├── domain/            # Core business logic
│       │   │   ├── filter-query.dto.ts
│       │   │   ├── social-enum.ts
│       │   │   └── services/
│       │   │       └── social-query-builder.service.ts  # ⭐ Central query builder
│       │   ├── features/          # Feature modules
│       │   │   ├── messages/      # Message search & count
│       │   │   ├── analytics/     # Overview + comparison charts
│       │   │   ├── sentiment/     # Sentiment analysis
│       │   │   ├── influencer/    # Top influencers
│       │   │   ├── trend/         # Trending topics
│       │   │   ├── time/          # Time-based analysis
│       │   │   └── location/      # Geographic analysis
│       │   ├── infrastructure/    # Data access layer
│       │   │   ├── repositories/
│       │   │   └── schemas/
│       │   └── common/            # Shared utilities
│       │
│       ├── real-media/            # Media monitoring (coming soon)
│       └── ...
│
├── docs/                          # Documentation
│   ├── INFISICAL.md               # Secret management guide
│   └── REAL-LISTENING-SOCIAL-QUERY-BUILDER-TESTS.md
│
├── examples/                      # Legacy JS reference code
└── test/                          # E2E tests
```

---

## 🛠️ Tech Stack


| Category           | Technology                              |
| ------------------ | --------------------------------------- |
| **Framework**      | NestJS 10                               |
| **Language**       | TypeScript 5.1                          |
| **Database**       | MongoDB 9 (Mongoose ODM)                |
| **Validation**     | class-validator, class-transformer      |
| **Authentication** | JWT (Passport)                          |
| **Documentation**  | Swagger / OpenAPI                       |
| **Cache**          | cache-manager (in-memory / Redis-ready) |
| **Date/Time**      | Day.js                                  |
| **Testing**        | Jest (unit + integration + e2e)         |
| **Code Quality**   | ESLint, Prettier                        |
| **Secrets**        | Infisical (optional)                    |


---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **MongoDB** 5.0+ (running locally or remote)
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd realone

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file at the root:

```env
# App
NODE_ENV=development
APP_PORT=8082
APP_TZ=Asia/Bangkok

# Auth
AUTH_JWT_SECRET=your-secret-key-here
AUTH_JWT_EXPIRES_IN=1d

# MongoDB
MONGO_HOST=127.0.0.1
MONGO_PORT=27017
MONGO_DB=realone_dev
MONGO_USER=
MONGO_PASSWORD=
```

> **Tip:** Use [Infisical](./docs/INFISICAL.md) for centralized secret management across environments.

### Running the Application

```bash
# Development (hot-reload)
npm run start:dev

# Production
npm run build
npm run start:prod

# With Infisical secrets
npm run start:dev:infisical
```

The API will be available at: **[http://localhost:8082/api](http://localhost:8082/api)**

---

## 📚 API Documentation

Once the server is running, access interactive API docs (Swagger UI) at:

**👉 [http://localhost:8082/docs](http://localhost:8082/docs)**

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

**Example test suites:**

- ✅ `social-query-builder.service.spec.ts` – 45 test cases covering all FilterQueryDTO fields, hint logic, and MongoDB query generation (see [docs](./docs/REAL-LISTENING-SOCIAL-QUERY-BUILDER-TESTS.md))

---

## 🎨 Development Guidelines

### 1. DTO-First Approach

Every request payload must have a corresponding DTO with validation decorators:

```typescript
export class MessageFilterDTO extends PartialType(FilterQueryDTO) {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pagePer?: number = 100;
}
```

### 2. Layered Architecture

```
Controller → Service → Repository → Database
```

- **Controller:** Routing, validation, HTTP concerns
- **Service:** Business logic, orchestration
- **Repository:** Data access, query building

### 3. Dependency Injection

❌ **Never** instantiate services manually:

```typescript
const service = new MyService(); // ❌ BAD
```

✅ **Always** inject via constructor:

```typescript
constructor(private readonly myService: MyService) {} // ✅ GOOD
```

### 4. Module Isolation

- Each feature module should be self-contained
- Avoid cross-feature imports; use shared modules or services
- Export only what's needed for other modules

### 5. Testing Requirements

- **Unit tests** for services and utilities (aim for >80% coverage)
- **Integration tests** for repositories
- **E2E tests** for critical API flows

### 6. Code Style

```bash
# Format code
npm run format

# Lint
npm run lint
```

---

## 🔑 Key Features & Highlights

### Real Listening Module

- **Unified Query Builder:** `SocialQueryBuilderService` transforms DTOs into optimized MongoDB aggregation pipelines with intelligent index hinting
- **Feature-based Organization:** Messages, Analytics, Sentiment, Influencer, Trend, Time, Location—each with dedicated controller/service/repository
- **Comparison Support:** Analytics and Sentiment endpoints support date-range comparison (`compareEnabled` flag) in a single request
- **Flexible Filtering:** 20+ filter fields including keywords, channels, sentiment, tags, date ranges, advanced search, and more
- **Type Safety:** Strict TypeScript enums and DTOs prevent runtime errors and improve DX

### Core Infrastructure

- **Global Rate Limiting:** Configurable per-route protection against abuse
- **Structured Logging:** Request ID tracking across the entire request lifecycle
- **Typed Configuration:** Joi validation ensures all required env vars are present on startup
- **BaseRepository Pattern:** DRY MongoDB operations with built-in `maxTimeMS`, `allowDiskUse`, hints

---

## 📖 Documentation


| Doc                                                                                                 | Description                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [INFISICAL.md](./docs/INFISICAL.md)                                                                 | Setting up Infisical for secrets management |
| [REAL-LISTENING-SOCIAL-QUERY-BUILDER-TESTS.md](./docs/REAL-LISTENING-SOCIAL-QUERY-BUILDER-TESTS.md) | Comprehensive test coverage guide           |
| [REAL-LISTENING-INFLUENCER-TESTS.md](./docs/REAL-LISTENING-INFLUENCER-TESTS.md)                     | Influencer test coverage guide           |


---

## 🗺️ Roadmap

- Real Listening: Messages, Analytics, Sentiment, Influencer, Trend, Time, Location
- Comprehensive unit tests (45+ for query builder)
- Swagger documentation
- Rate limiting & request logging
- Real Media module migration
- E2E test suite expansion
- Redis caching integration
- Queue-based background jobs
- GraphQL gateway (future)

---

## 👥 Contributing

This is a private project. For questions or access, contact the maintainer.

---

## 📄 License

Proprietary. All rights reserved.

---

## 🙋 Support

For issues or questions:

- **Author:** Anan Samphan
- **Project:** RealSmart Products
- **Email:** [anan.s@realsmart.co.th](mailto:anan.s@realsmart.co.th)

---

**Built with ❤️ using NestJS**