# Next.js Authentication App

A production-ready Next.js application with manual email/password authentication, Prisma ORM, SQLite database, and cookie-based sessions.

## Features

- ✅ Manual authentication (email + password)
- ✅ Prisma ORM with SQLite
- ✅ Cookie-based sessions with JWT
- ✅ Password hashing with bcrypt
- ✅ Protected routes
- ✅ CSS Modules styling (no frameworks)
- ✅ TypeScript
- ✅ Secure, production-ready code

## Prerequisites

- Node.js 20.9.0 or higher
- npm or yarn

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and update the `SESSION_SECRET` with a secure random string (at least 32 characters):

```bash
cp .env.example .env
```

3. **Initialize the database:**

```bash
npm run db:push
```

This will create the SQLite database and apply the schema.

4. **Generate Prisma Client:**

```bash
npm run db:generate
```

5. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/          # Authentication API routes
│   │   ├── dashboard/         # Protected dashboard page
│   │   ├── login/             # Login page
│   │   ├── register/          # Registration page
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   └── lib/
│       ├── auth.ts            # Authentication utilities
│       ├── auth-helpers.ts    # Route protection helpers
│       └── prisma.ts          # Prisma client instance
└── .env                       # Environment variables
```

## API Routes

### POST `/api/auth/register`
Register a new user.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST `/api/auth/login`
Login with email and password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST `/api/auth/logout`
Logout the current user.

### GET `/api/auth/me`
Get the current authenticated user.

## Security Features

- Passwords are hashed using bcrypt with 12 rounds
- Sessions are stored in the database and validated on each request
- JWT tokens are signed with a secret key
- HTTP-only cookies prevent XSS attacks
- Secure cookies in production (HTTPS required)
- Password minimum length validation (8 characters)
- Email normalization (lowercase, trimmed)

## Database Management

- **View database:** `npm run db:studio`
- **Create migration:** `npm run db:migrate`
- **Push schema changes:** `npm run db:push`
- **Generate Prisma Client:** `npm run db:generate`

## Production Deployment

1. Update `SESSION_SECRET` in `.env` with a strong random string
2. Set `NODE_ENV=production` in your environment
3. Run `npm run build` to build the application
4. Run `npm start` to start the production server

**Important:** Make sure to:
- Use a strong `SESSION_SECRET` (at least 32 characters)
- Use HTTPS in production
- Keep your `.env` file secure and never commit it to version control
- Consider using a more robust database (PostgreSQL, MySQL) for production

## License

MIT
