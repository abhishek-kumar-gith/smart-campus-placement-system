'use strict';
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads/logos')));
app.use('/uploads/profile-photos', express.static(path.join(__dirname, '../uploads/profile-photos')));
app.use('/api/', apiLimiter);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok', service: 'Campus Placement API', version: '1.0.0', environment: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// Routes
const authRoutes        = require('./routes/auth.routes');
const studentRoutes     = require('./routes/student.routes');
const companyRoutes     = require('./routes/company.routes');
const recruiterRoutes   = require('./routes/recruiter.routes');
const jobRoutes         = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const resumeRoutes      = require('./routes/resume.routes');
const interviewRoutes   = require('./routes/interview.routes');
const placementRoutes   = require('./routes/placement.routes');
const notificationRoutes= require('./routes/notification.routes');
const adminRoutes       = require('./routes/admin.routes');
const offerLetterRoutes = require('./routes/offerLetter.routes');

app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/students',      studentRoutes);
app.use('/api/v1/companies',     companyRoutes);
app.use('/api/v1/recruiters',    recruiterRoutes);
app.use('/api/v1/jobs',          jobRoutes);
app.use('/api/v1/applications',  applicationRoutes);
app.use('/api/v1/resumes',       resumeRoutes);
app.use('/api/v1/interviews',    interviewRoutes);
app.use('/api/v1/placements',    placementRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/offers',       offerLetterRoutes);
app.use('/api/v1/admin',         adminRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` }));
app.use(errorHandler);

module.exports = app;
