const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/dbAdapter');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const auditService = require('../services/audit.service');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      personnelId: user.personnelId,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const register = async (req, res, next) => {
  try {
    const { personnelId, email, password, fullName, unit, rank, role } = req.body;

    // Field validations
    if (!personnelId || !personnelId.trim()) {
      return res.status(400).json({ success: false, message: 'Personnel ID is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Official Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters in length.' });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
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

    // Create user in persistent database
    const assignedRole = ['PERSONNEL', 'WELFARE_OFFICER', 'ADMIN'].includes(role) ? role : 'PERSONNEL';

    const newUser = await db.Users.create({
      personnelId: cleanPersonnelId,
      email: cleanEmail,
      password: hashedPassword,
      fullName: fullName.trim(),
      unit: unit ? unit.trim() : 'CRPF Battalion 104',
      rank: rank ? rank.trim() : 'Head Constable',
      role: assignedRole,
      isActive: true,
      lastLogin: new Date().toISOString()
    });

    // Create corresponding Personnel profile
    await db.Personnel.create({
      userId: newUser._id,
      personnelId: cleanPersonnelId,
      fullName: fullName.trim(),
      rank: newUser.rank,
      unit: newUser.unit,
      deploymentZone: 'Sector North - Alpha Division',
      yearsOfService: 6,
      dutyType: 'Field Operations',
      preferredSupportLanguage: 'English',
      isEnrolledInWelfare: true,
      emergencyContact: {
        name: 'Unit Liaison Officer',
        relation: 'Official Contact',
        phone: '+91-98765-43210'
      }
    });

    // Welcome notification
    await db.Notifications.create({
      userId: newUser._id,
      title: 'Welcome to Welfare Monitoring System',
      message: 'Your account has been registered. You can now perform routine welfare check-ins.',
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
    const { identifier, password } = req.body;

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
      details: { role: user.role }
    });

    const token = generateToken(user);
    setAuthCookie(res, token);

    const { password: _, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
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
