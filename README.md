# Mini School ERP

A lightweight school management system for administrators, teachers, and students. Admins manage the school directory and class assignments; teachers record attendance for their assigned class; optional student accounts can view their own profile and attendance.

## What it does

- **Authentication and roles:** email/password sign-in, bcrypt password hashing, JWT sessions, and role-protected API routes.
- **Teacher management:** admins add, edit, list, and delete teacher accounts, including phone, subject, and assigned class.
- **Student management:** admins create, edit, search, filter, and deactivate student records with roll number, class/section, and guardian contact.
- **Class management:** admins create classes and sections, assign one class in-charge, and maintain student membership.
- **Attendance:** admins and assigned teachers can mark each active student present, absent, or late for today. Admins and assigned teachers can view class attendance history; student accounts can view only their own history.
- **Dashboard:** school totals and today's attendance totals, including per-class marked/pending status.
- **Convenience features:** optional student read-only accounts, student search/filter, and attendance CSV export.

## Roles and permissions

| Role | Can do |
|---|---|
| **Admin** | Manage teachers, students, and classes; assign class teachers; view the dashboard and attendance; mark or update attendance. |
| **Teacher** | View their assigned class and its students; mark today's attendance for that class; view attendance history for their class. |
| **Student (optional)** | View only their linked profile and attendance history. No management or attendance-editing access. |

### Accounts, IDs, and passwords

## Demo Login Credentials

Use the following accounts to explore the application:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.com` | `Admin@12345` |
| Teacher | `rahul.teacher@school.com` | `Teacher@123` |
| Student | `aarav@school.com` | `Student@123` |

Additional teacher and student accounts have also been created during development.

**Note:** These credentials are for project evaluation only. Do not use them for real school data..

- **First Admin:** create one with the one-time `npm run create-admin` bootstrap command below. Choose the Admin name, email, and password yourself.
- **Teacher:** sign in as Admin, create a class first, then open **Teachers → Add Teacher**. Enter the teacher's name, email, initial password (at least 6 characters), phone, and subject. Assign a class there or later from **Classes**. Share that initial password with the teacher privately; they can sign in using the email and password.
- **Student:** in **Students → Add Student**, enter the student details and select an existing class/section. Student login is optional: also enter the student's email and a login password to create a read-only account. Without a login password, only the student record is created.

Passwords are stored as bcrypt hashes and cannot be retrieved from the database or app. A password reset/change flow is not included yet; never publish real passwords in this repository or README.

## Technology choices

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, Vite 8, CSS | A responsive single-page interface with a quick development and production build. |
| API | Node.js 22, Express 5 | A small JSON API that fits the app's CRUD workflows and is easy to run locally. |
| Database | MongoDB Atlas/local MongoDB, Mongoose 8 | Flexible school records with explicit models, validation, references, and indexes. |
| Authentication | JSON Web Tokens, bcryptjs | Stateless API authentication and salted password hashing rather than plaintext storage. |
| Deployment | Render web service, MongoDB Atlas | A straightforward hosted Node service that serves both the API and built frontend. |

The code keeps API routes, controllers, models, and middleware in separate folders so each part has a clear responsibility without adding a larger framework for this small project.

## Project structure

```text
.
├── client/
│   ├── src/
│   │   ├── App.jsx              # Screens, forms, role-based navigation, API calls
│   │   ├── App.css              # Application styles
│   │   └── main.jsx             # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js           # Local /api proxy
├── server/
│   ├── src/
│   │   ├── config/database.js   # MongoDB connection
│   │   ├── controllers/         # Auth, teachers, students, classes, attendance, dashboard
│   │   ├── middleware/          # JWT authentication and role checks
│   │   ├── models/              # User, Student, Class, Attendance
│   │   ├── routes/              # Express API route definitions
│   │   ├── createAdmin.js       # One-time first-admin bootstrap
│   │   └── server.js            # Express app and production frontend hosting
│   ├── .env.example
│   └── package.json
├── render.yaml                  # Render Blueprint configuration
└── README.md
```

### Main API routes

All management and attendance endpoints require a valid `Authorization: Bearer <token>` unless noted.

| Route | Purpose | Access |
|---|---|---|
| `POST /api/auth/login` | Sign in with email, password, and selected role | Public |
| `/api/teachers` | Create/list/update/delete teacher accounts | Admin |
| `/api/students` | Create/list/update/deactivate students; supports search and class/section filters | Admin; teachers can list students in their assigned class |
| `GET /api/students/me` | Read the signed-in student's own profile | Student |
| `/api/classes` | Create/list/update/delete classes and assign a class teacher | Admin manages; Admin/Teacher can list permitted classes |
| `/api/attendance` | Mark/update attendance and list history | Admin/assigned Teacher; Student can read only their own history |
| `GET /api/dashboard` | School totals and today's class attendance summary | Admin |
| `GET /api/health` | Service health check | Public |

## Run locally

### Prerequisites

- Node.js 22 or later and npm
- MongoDB running locally, or a MongoDB Atlas database and connection string

### 1. Configure the API

From the repository root, open PowerShell:

```powershell
cd server
Copy-Item .env.example .env
notepad .env
```

Set `MONGODB_URI` to your database connection string and replace `JWT_SECRET` with a private random value. To generate a secret with Node:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The example URI is for local MongoDB: `mongodb://127.0.0.1:27017/mini_school_erp`.

### 2. Install dependencies and create the first Admin

Still in `server`:

```powershell
npm ci
$env:ADMIN_NAME = "School Admin"
$env:ADMIN_EMAIL = "admin@example.com"
$securePassword = Read-Host "Choose an Admin password" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run create-admin
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

The bootstrap command requires `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `MONGODB_URI`; it refuses to overwrite an existing account. It creates a normal Admin record, and the User model hashes its password before saving.

### 3. Start the API

In the `server` directory:

```powershell
npm run dev
```

The API listens on `http://localhost:5000`.

### 4. Start the frontend

Open a second terminal at the repository root:

```powershell
cd client
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the local API. To use a separately hosted API in a frontend build, set `VITE_API_URL` to its base URL.

## Deploy to Render

The root `render.yaml` describes a **Free** Render web service that builds the React app and serves its files from the Express server. Select this repository and the `deeva2601-school-erp-requirements` branch when creating/updating the Blueprint.

1. Create a MongoDB Atlas database and database user.
2. Set `MONGODB_URI` in Render's environment settings to the Atlas connection string. Atlas Network Access must allow the Render service's outbound IP ranges. Avoid leaving `0.0.0.0/0` open.
3. Keep `NODE_ENV=production` and set `JWT_SECRET` to a private generated secret. The Blueprint generates the JWT secret when applied.
4. Deploy and check `https://<your-service>.onrender.com/api/health`.
5. The Free Render plan has no Shell or one-off jobs. To create the first Admin, run the bootstrap command from your own computer using the same Atlas `MONGODB_URI`; temporarily allow your computer's IP in Atlas Network Access, then remove that IP rule after setup. Do not commit the local `.env` file.

Free Render services can spin down while idle, so the first request after inactivity may take longer. The server and client are built/deployed together; no separate Vite static site is needed.

## Improvements with more time

- Add automated API and UI tests, especially for role boundaries and attendance.
- Add teacher-list search, pagination, and larger-school performance improvements.
- Add attendance charts, bulk student import, and richer reports.
- Add an audited password reset/change flow, administrative audit log, and production backup/monitoring setup.

The mini version prioritizes the requested workflows and intentionally skips parent accounts, bulk import, a reporting/charting suite, and an audit log.
