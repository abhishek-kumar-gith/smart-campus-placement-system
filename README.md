# 🎓 DCRUST Placement Portal

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

**A full-stack, role-based campus recruitment platform connecting Students, Companies, and Placement Officers.**

[Features](#-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Docker](#-docker-deployment) • [API](#-api-overview) • [Progress](#-phase-progress)

</div>

---

## 📋 Overview

The **DCRUST Placement Portal** is a university placement management system for Deenbandhu Chhotu Ram University of Science and Technology (DCRUST), Murthal, Sonipat, Haryana. It provides three distinct portals — for **Students**, **Companies**, and **Placement Officers** — each with role-specific dashboards, workflows, and data access.

---

## ✨ Features

### 🧑‍🎓 Student Portal
- Register and build a detailed placement profile (skills, GPA, branch, resume)
- Browse and apply to active job/internship listings
- Track application status in real time
- Upload and manage resume (PDF, max 5 MB)
- Receive email notifications for application updates and interview schedules
- View offer letters and placement history

### 🏢 Company Portal
- Register company account (admin-approved)
- Post job/internship openings with eligibility criteria
- Browse eligible student profiles and shortlist candidates
- Schedule interviews and manage interview rounds
- Issue offer letters to selected students
- View placement analytics dashboard

### 🛡️ Placement Officer (Admin) Portal
- Full system oversight — manage students, companies, and drives
- Approve/reject company registrations
- Configure placement eligibility rules globally
- Monitor placement statistics and generate reports
- Send bulk notifications to students or companies
- Manage interview schedules and venue allocation

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Axios, Zustand |
| **Backend** | Node.js 20, Express 4, Mongoose 8, JWT Auth, Multer, Nodemailer |
| **Database** | MongoDB 7 (Atlas or self-hosted) |
| **Validation** | Zod (backend), React Hook Form (frontend) |
| **Security** | Helmet, express-rate-limit, bcryptjs, CORS |
| **Logging** | Winston, Morgan |
| **DevOps** | Docker, Docker Compose, Nginx (reverse proxy), GitHub Actions CI/CD |

---

## 📁 Project Structure

```
campusPlacementSystem/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               # MongoDB connection
│   │   │   └── env.js              # Environment config
│   │   ├── models/
│   │   │   ├── User.js             # Base user model (all roles)
│   │   │   ├── Student.js          # Student profile model
│   │   │   ├── Company.js          # Company profile model
│   │   │   └── JobDrive.js         # Job/internship drive model
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── student.controller.js
│   │   │   ├── company.controller.js
│   │   │   └── admin.controller.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── student.routes.js
│   │   │   ├── company.routes.js
│   │   │   └── admin.routes.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js  # JWT verification & role guard
│   │   │   ├── upload.middleware.js # Multer file upload
│   │   │   └── validate.middleware.js # Zod request validation
│   │   ├── utils/
│   │   │   ├── logger.js           # Winston logger
│   │   │   ├── mailer.js           # Nodemailer email sender
│   │   │   └── apiResponse.js      # Standardized API response helpers
│   │   ├── app.js                  # Express app setup
│   │   └── server.js               # HTTP server entry point
│   ├── uploads/
│   │   ├── resumes/                # Student resume PDFs
│   │   └── logos/                  # Company logo images
│   ├── logs/                       # Winston log files
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js            # Axios instance with interceptors
│   │   ├── components/
│   │   │   ├── common/             # Shared UI components (Button, Modal, etc.)
│   │   │   ├── student/            # Student-specific components
│   │   │   ├── company/            # Company-specific components
│   │   │   └── admin/              # Admin-specific components
│   │   ├── pages/
│   │   │   ├── auth/               # Login, Register pages
│   │   │   ├── student/            # Student dashboard & sub-pages
│   │   │   ├── company/            # Company dashboard & sub-pages
│   │   │   └── admin/              # Admin dashboard & sub-pages
│   │   ├── store/                  # Zustand state stores
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── utils/                  # Frontend utilities
│   │   ├── App.jsx                 # Routes & providers
│   │   └── main.jsx                # Vite entry point
│   ├── Dockerfile
│   ├── .env.example
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
│
├── nginx/
│   └── nginx.conf                  # Reverse proxy + rate limiting config
├── .github/
│   └── workflows/
│       └── ci-cd.yml               # GitHub Actions CI/CD pipeline
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20.x ([download](https://nodejs.org/))
- **npm** ≥ 10.x (bundled with Node.js)
- **MongoDB** — local install or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/campus-placement-system.git
cd campus-placement-system
```

### 2. Configure Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI, JWT secrets, email credentials

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your API base URL
```

### 3. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Run MongoDB

**Option A — Local MongoDB:**
```bash
mongod --dbpath /data/db
```
The development server uses `mongodb://127.0.0.1:27017/campusPlacement` by default, so `MONGODB_URI` is optional when using this local database.

**Option B — MongoDB Atlas:**
> Set `MONGODB_URI` in `backend/.env` to your Atlas connection string.

### 5. Start Development Servers

Open two terminals:

```bash
# Terminal 1 — Backend (runs on http://localhost:5000)
cd backend
npm run dev

# Terminal 2 — Frontend (runs on http://localhost:5173)
cd frontend
npm run dev
```

Navigate to **http://localhost:5173** in your browser.

---

## 🐳 Docker Deployment

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### One-command launch

```bash
# Copy and configure environment (Docker Compose reads from shell env or .env file at root)
cp backend/.env.example backend/.env
# Edit backend/.env as needed

# Build and start all services (backend, frontend, nginx, mongodb)
docker compose up --build -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

The app will be available at **http://localhost** (port 80 via Nginx).

### Docker Services

| Service | Container | Port |
|---|---|---|
| Nginx (reverse proxy) | `campus_nginx` | `80`, `443` |
| Backend API | `campus_backend` | `5000` (internal) |
| Frontend | `campus_frontend` | `80` (internal) |
| MongoDB | `campus_mongo` | `27017` |

### Production Deployment (AWS EC2)

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) handles CI/CD automatically on push to `main`:

1. Runs backend & frontend tests
2. Builds and pushes Docker images to Docker Hub
3. SSHs into EC2 and runs `docker compose pull && docker compose up -d`

**Required GitHub Secrets:**

| Secret | Description |
|---|---|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password / access token |
| `EC2_HOST` | EC2 public IP or hostname |
| `EC2_USER` | EC2 SSH username (e.g., `ubuntu`) |
| `EC2_SSH_KEY` | EC2 private key (PEM content) |

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `5000` | Backend server port |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_ACCESS_SECRET` | **Yes** | — | Secret for access tokens (≥32 chars) |
| `JWT_REFRESH_SECRET` | **Yes** | — | Secret for refresh tokens (≥32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `EMAIL_HOST` | No | `smtp.gmail.com` | SMTP server host |
| `EMAIL_PORT` | No | `587` | SMTP server port |
| `EMAIL_USER` | No | — | SMTP username / email |
| `EMAIL_PASS` | No | — | SMTP password / app password |
| `EMAIL_FROM` | No | `noreply@...` | From address for emails |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS allowed origin |
| `MAX_FILE_SIZE_MB` | No | `5` | Max resume/logo upload size |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:5000` | Backend API base URL |

---

## 📡 API Overview

All endpoints are prefixed with `/api/v1`.

### Authentication
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/auth/register` | Register new user (student/company/admin) | Public |
| `POST` | `/auth/login` | Login and receive tokens | Public |
| `POST` | `/auth/refresh` | Refresh access token | Public |
| `POST` | `/auth/logout` | Invalidate refresh token | Auth |
| `GET` | `/auth/me` | Get current user profile | Auth |

### Student Routes
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/students/profile` | Get own profile | Student |
| `PUT` | `/students/profile` | Update profile | Student |
| `POST` | `/students/resume` | Upload resume PDF | Student |
| `GET` | `/students/drives` | List eligible job drives | Student |
| `POST` | `/students/drives/:id/apply` | Apply to a drive | Student |
| `GET` | `/students/applications` | List own applications | Student |

### Company Routes
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/companies/profile` | Get company profile | Company |
| `PUT` | `/companies/profile` | Update company profile | Company |
| `POST` | `/companies/drives` | Create a job drive | Company |
| `GET` | `/companies/drives` | List own drives | Company |
| `GET` | `/companies/drives/:id/applicants` | View applicants | Company |
| `PUT` | `/companies/applications/:id/status` | Update application status | Company |

### Admin Routes
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/admin/students` | List all students (paginated) | Admin |
| `GET` | `/admin/companies` | List all companies | Admin |
| `PUT` | `/admin/companies/:id/approve` | Approve company registration | Admin |
| `GET` | `/admin/drives` | List all drives | Admin |
| `GET` | `/admin/stats` | Placement statistics | Admin |
| `POST` | `/admin/notify` | Send bulk email notification | Admin |

### Utility
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |

---

## 📊 Phase Progress

| # | Phase | Description | Status |
|---|---|---|---|
| 1 | 🏗️ Project Scaffold | Repo structure, Docker, Nginx, CI/CD, README | ✅ Complete |
| 2 | 🔧 Backend Core | Express app, DB connection, logging, error handling | ✅ Complete |
| 3 | 👤 Auth System | JWT auth, register/login/refresh, role guards | ✅ Complete |
| 4 | 🎓 Student Module | Profile, resume upload, drive listing & applications | ✅ Complete |
| 5 | 🏢 Company Module | Company profile, drive posting, applicant management | ✅ Complete |
| 6 | 🛡️ Admin Module | Approvals, stats dashboard, bulk notifications | ✅ Complete |
| 7 | ⚛️ Frontend Scaffold | Vite + React + Tailwind setup, routing, Axios | ✅ Complete |
| 8 | 🔐 Frontend Auth | Login/Register pages, token management, protected routes | ✅ Complete |
| 9 | 🎓 Student UI | Student dashboard, profile editor, drive browser | ✅ Complete |
| 10 | 🏢 Company UI | Company dashboard, drive manager, applicant table | ✅ Complete |
| 11 | 🛡️ Admin UI | Admin dashboard, approvals, analytics charts | 🔄 In Progress |
| 12 | 🧪 Testing & Polish | Unit tests, E2E, performance tuning, final review | ⏳ Pending |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a **Pull Request** against `develop`

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    Formatting, no logic change
refactor: Code restructure, no feature/fix
test:     Adding or updating tests
chore:    Build process, dependencies
```

### Code Style

- **Backend**: Follow the ESLint config (Phase 11); use `async/await`, never raw callbacks.
- **Frontend**: Use functional components with hooks; co-locate styles with components.
- **PRs**: Must pass CI (lint + build) before review.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 DCRUST Placement Portal Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

<div align="center">
Made with ❤️ for campus communities everywhere.
</div>
