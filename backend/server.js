/**
 * Main Express Application Server for SIH26186
 * AI-Based Predictive Personnel Stress & Welfare Monitoring System
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');

const { connectDB } = require('./config/db');
const db = require('./models/dbAdapter');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const checkinRoutes = require('./routes/checkin.routes');
const predictionRoutes = require('./routes/prediction.routes');
const officerRoutes = require('./routes/officer.routes');
const followupRoutes = require('./routes/followup.routes');
const supportRoutes = require('./routes/support.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const systemRoutes = require('./routes/system.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Utility Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Enable inline assets for vanilla SPA/charts
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Static Frontend Serving
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/checkin', checkinRoutes);
app.use('/api/v1/prediction', predictionRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/officer', officerRoutes);
app.use('/api/v1/followups', followupRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/system', systemRoutes);

// Health check alias
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Seed Initial Demo Accounts if empty
const seedInitialData = async () => {
  try {
    const existingUsers = await db.Users.find();
    if (existingUsers.length === 0) {
      console.log('[Seed] Seeding initial verified demo accounts...');
      const defaultHash = await bcrypt.hash('Password@123', 10);

      // 1. Demo Personnel
      const personnelUser = await db.Users.create({
        personnelId: 'CRPF-9042',
        email: 'vijay.kumar@crpf.gov.in',
        password: defaultHash,
        fullName: 'Havildar Vijay Kumar',
        role: 'PERSONNEL',
        unit: 'CRPF Battalion 104',
        rank: 'Havildar',
        isActive: true,
        lastLogin: new Date().toISOString()
      });

      await db.Personnel.create({
        userId: personnelUser._id,
        personnelId: 'CRPF-9042',
        fullName: 'Havildar Vijay Kumar',
        rank: 'Havildar',
        unit: 'CRPF Battalion 104',
        deploymentZone: 'Sector North - High Altitude Deployment',
        yearsOfService: 8,
        dutyType: 'Field Operations',
        preferredSupportLanguage: 'Hindi / English',
        isEnrolledInWelfare: true,
        emergencyContact: {
          name: 'Sunita Kumar',
          relation: 'Spouse',
          phone: '+91-98765-43210'
        }
      });

      // 2. Demo Welfare Officer
      await db.Users.create({
        personnelId: 'WO-101',
        email: 'officer.welfare@crpf.gov.in',
        password: defaultHash,
        fullName: 'Assistant Commandant Priya Sharma',
        role: 'WELFARE_OFFICER',
        unit: 'CRPF Sector HQ Welfare Wing',
        rank: 'Assistant Commandant',
        isActive: true,
        lastLogin: new Date().toISOString()
      });

      // 3. Demo Admin
      await db.Users.create({
        personnelId: 'ADM-001',
        email: 'admin.welfare@mha.gov.in',
        password: defaultHash,
        fullName: 'Col. Vikramaditya Singh (Retd.)',
        role: 'ADMIN',
        unit: 'MHA Police II Division Directorate',
        rank: 'Director Welfare',
        isActive: true,
        lastLogin: new Date().toISOString()
      });

      // Seed standard welfare resources
      const resources = [
        {
          title: 'CRPF 24/7 National Psychological Tele-Counseling',
          category: 'Psychological Support',
          description: 'Toll-free confidential telephonic counseling and stress decompression helpline staffed by qualified clinical counselors.',
          contactNumber: '1800-180-4024',
          helplineHours: '24 Hours / 7 Days a Week',
          isConfidential: true,
          isActive: true
        },
        {
          title: 'Battalion Peer Support & Mentorship Desk',
          category: 'Peer Support',
          description: 'On-base peer listening and unit buddy support network for operational stress and family balance.',
          contactNumber: '+91-11-2610-8800 (Ext. 304)',
          helplineHours: '08:00 - 20:00 Daily',
          isConfidential: true,
          isActive: true
        },
        {
          title: 'Forces Family Assistance & Welfare Board',
          category: 'Family Assistance',
          description: 'Liaison office providing assistance for dependents, schooling queries, and emergency family leave coordination.',
          contactNumber: '1800-112-9900',
          helplineHours: '09:00 - 18:00 Mon-Sat',
          isConfidential: true,
          isActive: true
        }
      ];

      for (const res of resources) {
        await db.WelfareResources.create(res);
      }

      console.log('[Seed] Verified Demo Accounts seeded successfully.');
      console.log('   - Personnel: CRPF-9042 / Password@123');
      console.log('   - Welfare Officer: WO-101 / Password@123');
      console.log('   - Admin: ADM-001 / Password@123');
    }
  } catch (seedErr) {
    console.warn('[Seed Warning]:', seedErr.message);
  }
};

// Fallback to index.html for SPA page routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const filePath = path.join(frontendDir, req.path.endsWith('.html') ? req.path : `${req.path}.html`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(frontendDir, 'index.html'));
    }
  });
});

// Centralized error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await seedInitialData();
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`==================================================================`);
        console.log(`WelfareAI Personnel Welfare Backend Server active on Port ${PORT}`);
        console.log(`Web UI: http://localhost:${PORT}`);
        console.log(`==================================================================`);
      });
    }
  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

startServer();

module.exports = app;

