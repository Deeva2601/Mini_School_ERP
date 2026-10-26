# Mini School ERP

A small role-based school management app for administrators, teachers, and (optionally) students.

## Tech stack

- **React + Vite** for a fast, simple single-page interface.
- **Node.js + Express** for a JSON API with role-based access control.
- **MongoDB + Mongoose** for document storage and the app's linked records.
- **bcryptjs + JWT** for password hashing and authenticated API requests.

This stack keeps the CRUD-heavy app straightforward to run locally while preserving clear model, route, and controller boundaries.

## Requirements

- Node.js 22 or later and npm
- MongoDB running locally, or a MongoDB connection string

## Run locally

1. Configure the API:

   ```powershell
   cd server
   Copy-Item .env.example .env
   ```

   Set `JWT_SECRET` in `server/.env` to a private random value. To generate one with Node:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   The example database URL uses a local MongoDB instance at `mongodb://127.0.0.1:27017/mini_school_erp`.

2. Install dependencies and create the first administrator:

   ```powershell
   npm install
   $env:ADMIN_NAME = "School Admin"
   $env:ADMIN_EMAIL = "admin@school.com"
   $env:ADMIN_PASSWORD = "choose-a-private-password"
   npm run create-admin
   Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
   ```

   Admin passwords are hashed before they are stored. The bootstrap command refuses to overwrite an existing account.

3. Start the API in the `server` directory:

   ```powershell
   npm run dev
   ```

4. In a second terminal, start the frontend:

   ```powershell
   cd client
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:5000`. For a separately hosted API, set `VITE_API_URL` to its base URL before building the frontend.

## Features

- Email/password login for Admin, Teacher, and optional Student roles.
- Admin-managed teacher accounts and class/section assignments.
- Admin-managed student records, with class membership checked against existing classes.
- Class creation, section management, and class in-charge assignment.
- Attendance marking for all students in a class and attendance history for admins and the assigned teacher.
- Admin dashboard totals and today's present, absent, and late counts by class.
- Optional student login for reading only that student's profile and attendance.
- Student search/filter and attendance CSV export.

## Scope and next improvements

For this mini version, attendance is marked per student, and the dashboard summarizes today's records across the school rather than showing charts. Student and attendance history are retained as simple records; there is no audit log, parent account, bulk import, or deployment configuration. With more time, add API tests, pagination, a per-class attendance chart, audit history, and a managed deployment with production secrets and database backups.
