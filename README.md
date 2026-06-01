# GraduateTracer API

REST API for the **GraduateTracer** which is the system for managing form.

Built with **Node.js**, **ExpressJS**, **TypeScript**, and **MongoDB**.

---

## Tech Stack

<div align="center">

<!-- Runtime -->

<a href="https://nodejs.org/" target="_blank">
  <img src="https://img.shields.io/badge/Node.js_24-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
</a>

<!-- Language -->

<a href="https://www.typescriptlang.org/" target="_blank">
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</a>

<!-- Framework -->

<a href="https://expressjs.com/" target="_blank">
  <img src="https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
</a>

<!-- Database -->

<a href="https://www.mongodb.com/" target="_blank">
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
</a>

<!-- ODM -->

<a href="https://mongoosejs.com/" target="_blank">
  <img src="https://img.shields.io/badge/Mongoose_8-880000?style=for-the-badge&logo=mongoose&logoColor=white" alt="Mongoose" />
</a>

<!-- Auth -->

<a href="https://jwt.io/" target="_blank">
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</a>

<!-- PDF Export -->

<a href="https://pptr.dev/" target="_blank">
  <img src="https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white" alt="Puppeteer" />
</a>

<!-- Validation -->

<a href="https://zod.dev/" target="_blank">
  <img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
</a>

<!-- Security: Helmet -->

<a href="https://helmetjs.github.io/" target="_blank">
  <img src="https://img.shields.io/badge/Helmet-FF6C37?style=for-the-badge&logo=helmet&logoColor=white" alt="Helmet" />
</a>

<!-- Security: bcrypt -->

<a href="https://github.com/kelektiv/node.bcrypt.js" target="_blank">
  <img src="https://img.shields.io/badge/bcrypt-4A90D9?style=for-the-badge&logo=lock&logoColor=white" alt="bcrypt" />
</a>

<!-- reCAPTCHA -->

<a href="https://developers.google.com/recaptcha" target="_blank">
  <img src="https://img.shields.io/badge/reCAPTCHA_v2-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="reCAPTCHA" />
</a>

<!-- Containerization -->

<a href="https://www.docker.com/" target="_blank">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</a>

</div>

---

## Project Structure

```
src/
├── app.ts                  # Express app setup (middlewares, routes,
                            DB Connection)
├── server.ts               # HTTP server entry point
├── database/               # MongoDB connection
├── router/                 # Route definitions
│   ├── user.route.ts       # Auth, users, forms, content
│   ├── response.route.ts   # Respondent sessions & form responses
│   ├── notification.route.ts # Notifications Service
│   ├── export.route.ts     # PDF/data export
├── controller/
│   ├── auth/               # Login, registration, token management
│   ├── form/               # Form CRUD, content, collaborators, sessions
│   ├── response/           # Response submission and retrieval
│   ├── analytics/          # Choice & response analytics
│   └── utils/              # reCAPTCHA, misc helpers
├── middleware/             # Auth verification, validators, rate control
├── model/                  # Mongoose models
├── services/               # Business logic services
├── types/                  # TypeScript type declarations
├── utilities/              # Shared utility functions
└── scripts/                # Seed Data Methods
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 24
- MongoDB instance (local or Atlas)
- (Optional) Docker

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd GraduateTracerBackend_V2

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values
```

### Run in Development

```bash
npm run dev
```

Uses `nodemon` for hot-reloading.

### Build & Run in Production

```bash
npm run build
npm start
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values. Key variables:

| Variable                                    | Description                                       |
| ------------------------------------------- | ------------------------------------------------- |
| `PORT`                                      | Server port (default:`4000`)                      |
| `DATABASE_URL`                              | MongoDB connection string                         |
| `JWT_SECRET`                                | Secret for signing access/refresh tokens          |
| `RESPONDENT_TOKEN_JWT_SECRET`               | Secret for respondent session tokens              |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Email (SMTP) credentials                          |
| `FRONTEND_URL`                              | Allowed CORS origin (e.g.`http://localhost:5173`) |
| `RECAPCHA_SECRETKEY`                        | Google reCAPTCHA v2 secret                        |
| `INVITE_LINK_SECRET`                        | Secret for signing invitation links               |
| `FORM_LINK_EXPIRATION`                      | Invite link TTL in hours                          |

See [.env.example](.env.example) for the full list.

---

## API Routes

All routes are prefixed with `/v0/api`.

### Auth & Users — `/v0/api`

| Method | Path            | Description                    |
| ------ | --------------- | ------------------------------ |
| GET    | `/user/profile` | Get authenticated user profile |
| POST   | `/register`     | Register a new user            |
| POST   | `/login`        | Login                          |
| POST   | `/logout`       | Logout                         |
| PATCH  | `/edituser`     | Edit user profile              |
| DELETE | `/deleteuser`   | Delete account                 |

### Forms — `/v0/api`

| Method | Path                     | Description                  |
| ------ | ------------------------ | ---------------------------- |
| GET    | `/forms`                 | Get all forms for user       |
| POST   | `/createform`            | Create a new form            |
| PATCH  | `/editform/:id`          | Edit form                    |
| DELETE | `/deleteform/:id`        | Delete form                  |
| GET    | `/formdetails/:id`       | Get form details             |
| GET    | `/formcollaborators/:id` | Get collaborators            |
| POST   | `/managecollaborator`    | Add/remove collaborator      |
| POST   | `/confirmcollaborator`   | Confirm collaboration invite |
| POST   | `/transferownership`     | Transfer form ownership      |

### Responses — `/v0/api/response`

| Method | Path                            | Description                       |
| ------ | ------------------------------- | --------------------------------- |
| POST   | `/respondentlogin`              | Respondent login / session start  |
| GET    | `/verifyformsession/:formId`    | Verify active form session        |
| PATCH  | `/sessionremoval/:code`         | Replace/refresh session           |
| DELETE | `/sessionlogout/:formId`        | End respondent session            |
| POST   | `/submitresponse`               | Submit form response              |
| GET    | `/getrespondents/:formId`       | List respondents                  |
| GET    | `/getuserresponses/:formId/...` | Get specific respondent's answers |

### Notifications — `/v0/api/notifications`

Handles real-time notification delivery and management.

### Exports — `/v0/api/exports`

PDF and data export endpoints powered by Puppeteer.

---

## Docker

```bash
# Build image
docker build -t graduatetracer-backend .

# Run container
docker run -p 4000:8000 --env-file .env graduatetracer-backend
```

> The container runs on port `8000` internally (mapped to `4000` in the example above). Adjust as needed.

### Health Check

The container includes a built-in health check:

```bash
curl http://localhost:4000/
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests use **Jest** with **ts-jest**.

---

## Security Notes

- Passwords are hashed with **bcrypt**.
- All routes use **Helmet** headers.
- Rate limiting: 100 requests per 15 minutes per IP.
- Respondent sessions use short-lived JWTs with RSA signing.
- reCAPTCHA validation on sensitive endpoints.
- Non-root Docker user for container hardening.

---

## License

ISC
