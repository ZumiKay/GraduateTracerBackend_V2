# GraduateTracer Backend V2

REST API backend for the **GraduateTracer** system — a platform for managing graduate tracer survey forms, respondent sessions, form responses, analytics, and notifications.

Built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**.

---

## Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Runtime          | Node.js 20                                    |
| Language         | TypeScript 5                                  |
| Framework        | Express 4                                     |
| Database         | MongoDB (Mongoose 8)                          |
| Auth             | JWT (jsonwebtoken) + RSA keys                 |
| Email            | Nodemailer (SMTP)                             |
| PDF Export       | Puppeteer                                     |
| Validation       | Zod                                           |
| Security         | Helmet, express-rate-limit, bcrypt, reCAPTCHA |
| Containerization | Docker                                        |

---

## Project Structure

```
src/
├── app.ts                  # Express app setup (middleware, routes)
├── server.ts               # HTTP server entry point
├── database/               # MongoDB connection
├── router/                 # Route definitions
│   ├── user.route.ts       # Auth, users, forms, content
│   ├── response.route.ts   # Respondent sessions & form responses
│   ├── notification.route.ts
│   ├── export.route.ts     # PDF/data export
│   └── encrypt.route.ts    # RSA encryption utilities
├── controller/
│   ├── auth/               # Login, registration, token management
│   ├── form/               # Form CRUD, content, collaborators, sessions
│   ├── response/           # Response submission and retrieval
│   ├── analytics/          # Choice & response analytics
│   └── utils/              # reCAPTCHA, misc helpers
├── middleware/             # Auth guards, validators, rate control
├── model/                  # Mongoose models
├── services/               # Business logic services
├── types/                  # TypeScript type declarations (env.d.ts)
├── utilities/              # Shared utility functions
└── scripts/                # One-off admin/migration scripts
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
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

### Generate RSA Keys

The backend uses RSA key pairs for token encryption:

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Extract public key
openssl rsa -in private.key -pubout -out public.key
```

Set the key contents (base64 or path) in `RSA_PUBLIC_KEY` and `RSA_PRIVATE_KEY` in your `.env`.

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

| Variable                                    | Description                                        |
| ------------------------------------------- | -------------------------------------------------- |
| `PORT`                                      | Server port (default: `4000`)                      |
| `DATABASE_URL`                              | MongoDB connection string                          |
| `JWT_SECRET`                                | Secret for signing access/refresh tokens           |
| `RESPONDENT_TOKEN_JWT_SECRET`               | Secret for respondent session tokens               |
| `RSA_PUBLIC_KEY`                            | RSA public key for encryption                      |
| `RSA_PRIVATE_KEY`                           | RSA private key for decryption                     |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Email (SMTP) credentials                           |
| `FRONTEND_URL`                              | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `RECAPCHA_SECRETKEY`                        | Google reCAPTCHA v2 secret                         |
| `INVITE_LINK_SECRET`                        | Secret for signing invitation links                |
| `FORM_LINK_EXPIRATION`                      | Invite link TTL in hours                           |

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

### Encryption — `/v0/api/de`

RSA-based payload encryption/decryption utilities for the frontend.

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
