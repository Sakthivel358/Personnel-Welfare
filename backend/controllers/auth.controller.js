const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/dbAdapter');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const auditService = require('../services/audit.service');

const generateToken = (user, rememberMe = false) => {
  return jwt.sign(
    {
      id: user._id,
      personnelId: user.personnelId,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: rememberMe ? '30d' : '3h' }
  );
};

const setAuthCookie = (res, token, rememberMe = false) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000 // 30 days or 3 hours default
  });
};

const register = async (req, res, next) => {
  try {
    const { personnelId, email, password, confirmPassword, fullName, role } = req.body;

    // Simplified Registration: ONLY validate core fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }
    if (!personnelId || !personnelId.trim()) {
      return res.status(400).json({ success: false, message: 'Personnel ID is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Official Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters in length.' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const cleanPersonnelId = personnelId.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate account
    const existingId = await db.Users.findOne({ personnelId: cleanPersonnelId });
    if (existingId) {
      return res.status(409).json({
        success: false,
        message: `An account with Personnel ID "${cleanPersonnelId}" is already registered. Please sign in.`
      });
    }

    const existingEmail = await db.Users.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: `An account with Email "${cleanEmail}" already exists. Please sign in.`
      });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Default role & metadata (additional organizational details can be added later in profile)
    const assignedRole = ['PERSONNEL', 'WELFARE_OFFICER', 'ADMIN'].includes(role) ? role : 'PERSONNEL';

    const newUser = await db.Users.create({
      personnelId: cleanPersonnelId,
      email: cleanEmail,
      password: hashedPassword,
      fullName: fullName.trim(),
      unit: 'Operational Unit (Editable in Profile)',
      rank: 'Personnel Member',
      role: assignedRole,
      isActive: true,
      lastLogin: new Date().toISOString()
    });

    // Create corresponding structured profile
    await db.Personnel.create({
      userId: newUser._id,
      personnelId: cleanPersonnelId,
      fullName: fullName.trim(),
      rank: 'Personnel Member',
      unit: 'Operational Unit (Editable in Profile)',
      deploymentZone: 'Standard Field Deployment',
      yearsOfService: 5,
      dutyType: 'Field Operations',
      workSchedule: 'Standard Rotation',
      preferredSupportLanguage: 'English / Hindi',
      isEnrolledInWelfare: true,
      emergencyContact: {
        name: 'Designated Welfare Liaison',
        relation: 'Official Contact',
        phone: '1800-000-0000 (Demo)'
      },
      privacyPreferences: {
        shareWithWelfareOfficer: true,
        anonymousAggregatedStats: true,
        notificationChannel: 'IN_APP'
      }
    });

    // Welcome notification
    await db.Notifications.create({
      userId: newUser._id,
      title: 'Welcome to WelfareAI Platform',
      message: 'Your account is registered. You can now perform routine welfare check-ins and access support.',
      type: 'SYSTEM',
      link: '/dashboard.html',
      isRead: false
    });

    // Log audit event
    await auditService.log({
      action: 'USER_REGISTER',
      userId: newUser._id,
      personnelId: cleanPersonnelId,
      targetResource: 'Users',
      ipAddress: req.ip,
      details: { role: assignedRole, email: cleanEmail }
    });

    const token = generateToken(newUser);
    setAuthCookie(res, token);

    const { password: _, ...safeUser } = newUser;

    return res.status(201).json({
      success: true,
      message: 'Registration completed successfully.',
      token,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { identifier, password, rememberMe } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both your Personnel ID/Email and Password.'
      });
    }

    const cleanIdentifier = identifier.trim();

    // Query user by personnelId OR email (case insensitive)
    const user = await db.Users.findOne({
      $or: [
        { personnelId: cleanIdentifier.toUpperCase() },
        { email: cleanIdentifier.toLowerCase() }
      ]
    }) || await db.Users.findOne({ personnelId: cleanIdentifier.toUpperCase() })
       || await db.Users.findOne({ email: cleanIdentifier.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Personnel ID / Email or password.'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the welfare administrator.'
      });
    }

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Personnel ID / Email or password.'
      });
    }

    // Update last login
    await db.Users.findByIdAndUpdate(user._id, {
      lastLogin: new Date().toISOString()
    });

    // Log audit event
    await auditService.log({
      action: 'USER_LOGIN',
      userId: user._id,
      personnelId: user.personnelId,
      targetResource: 'Auth',
      ipAddress: req.ip,
      details: { role: user.role, rememberMe: Boolean(rememberMe) }
    });

    const token = generateToken(user, Boolean(rememberMe));
    setAuthCookie(res, token, Boolean(rememberMe));

    const { password: _, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      expiresIn: rememberMe ? '30d' : '3h',
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await auditService.log({
        action: 'USER_LOGOUT',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'Auth',
        ipAddress: req.ip
      });
    }

    // Clear authentication cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return res.status(200).json({
      success: true,
      message: 'Signed out successfully. Your session has ended securely.'
    });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await db.Users.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }
    const { password, ...safeUser } = user;
    return res.status(200).json({ success: true, user: safeUser });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await db.Users.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password does not match records.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHashed = await bcrypt.hash(newPassword, salt);

    await db.Users.findByIdAndUpdate(user._id, { password: newHashed });

    await auditService.log({
      action: 'PASSWORD_CHANGE',
      userId: user._id,
      personnelId: user.personnelId,
      targetResource: 'Users',
      ipAddress: req.ip
    });

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe, changePassword };
