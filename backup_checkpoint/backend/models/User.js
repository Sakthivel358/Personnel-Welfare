const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    personnelId: {
      type: String,
      required: [true, 'Personnel ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    role: {
      type: String,
      enum: ['PERSONNEL', 'WELFARE_OFFICER', 'ADMIN'],
      default: 'PERSONNEL'
    },
    unit: {
      type: String,
      default: 'CRPF Battalion 104'
    },
    rank: {
      type: String,
      default: 'Head Constable'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Safe profile view without password
userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    personnelId: this.personnelId,
    email: this.email,
    fullName: this.fullName,
    role: this.role,
    unit: this.unit,
    rank: this.rank,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
