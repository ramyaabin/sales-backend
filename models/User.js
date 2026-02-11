import mongoose from "mongoose";

/**
 * User Schema - User Authentication and Management
 *
 * YOUR ORIGINAL SCHEMA + Enhanced Features:
 * - Admin and Salesman roles
 * - Password reset functionality
 * - Last login tracking
 * - Account status management
 */
const UserSchema = new mongoose.Schema(
  {
    // ==================== YOUR ORIGINAL FIELDS ====================

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      // NOTE: In production, hash this with bcrypt
      // Example: const hashedPassword = await bcrypt.hash(password, 10);
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      enum: ["admin", "salesman"],
      lowercase: true,
    },

    salesmanId: {
      type: String,
      unique: true,
      sparse: true, // Only for salesmen - allows null but must be unique when present
      trim: true,
      index: true,
    },

    // ==================== ENHANCED FIELDS ====================

    // Contact Information (optional)
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },

    // Password Reset (for OTP-based reset)
    resetToken: String,
    resetTokenExpiry: Date,

    // Additional metadata
    notes: String,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// ==================== INDEXES ====================

// Compound index for login queries
UserSchema.index({ username: 1, role: 1 });

// Index for salesman lookups
UserSchema.index({ salesmanId: 1 });

// Index for active users
UserSchema.index({ isActive: 1 });

// ==================== INSTANCE METHODS ====================

// Check if user is admin
UserSchema.methods.isAdmin = function () {
  return this.role === "admin";
};

// Check if user is salesman
UserSchema.methods.isSalesman = function () {
  return this.role === "salesman";
};

// Update last login timestamp
UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

// Generate password reset token (for OTP)
UserSchema.methods.generateResetToken = function () {
  // Generate 6-digit OTP
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetToken = token;
  this.resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  return this.save();
};

// Verify reset token
UserSchema.methods.verifyResetToken = function (token) {
  if (!this.resetToken || !this.resetTokenExpiry) {
    return false;
  }
  if (this.resetToken !== token) {
    return false;
  }
  if (new Date() > this.resetTokenExpiry) {
    return false; // Token expired
  }
  return true;
};

// Clear reset token after successful password reset
UserSchema.methods.clearResetToken = function () {
  this.resetToken = undefined;
  this.resetTokenExpiry = undefined;
  return this.save();
};

// Reset password (for admin resetting salesman password)
UserSchema.methods.resetPassword = function (newPassword) {
  this.password = newPassword;
  this.clearResetToken();
  return this.save();
};

// ==================== STATIC METHODS ====================

// Find user by username
UserSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.toLowerCase() });
};

// Find user by salesmanId
UserSchema.statics.findBySalesmanId = function (salesmanId) {
  return this.findOne({ salesmanId });
};

// Get all salesmen
UserSchema.statics.getAllSalesmen = function () {
  return this.find({ role: "salesman", isActive: true }).sort({ name: 1 });
};

// Get all admins
UserSchema.statics.getAllAdmins = function () {
  return this.find({ role: "admin", isActive: true }).sort({ name: 1 });
};

// Authenticate user (for login)
UserSchema.statics.authenticate = async function (username, password) {
  const user = await this.findOne({
    username: username.toLowerCase(),
    password,
    isActive: true,
  });

  if (user) {
    await user.updateLastLogin();
  }

  return user;
};

// ==================== VALIDATION HOOKS ====================

// Pre-save hook to ensure salesmanId exists for salesmen
UserSchema.pre("save", function (next) {
  if (this.role === "salesman" && !this.salesmanId) {
    return next(new Error("Salesman must have a salesmanId"));
  }
  next();
});

// Pre-save hook to lowercase username
UserSchema.pre("save", function (next) {
  if (this.username) {
    this.username = this.username.toLowerCase().trim();
  }
  next();
});

// ==================== VIRTUAL PROPERTIES ====================

// Virtual for full display name with role
UserSchema.virtual("displayName").get(function () {
  return `${this.name} (${this.role})`;
});

// Virtual for formatted last login
UserSchema.virtual("lastLoginFormatted").get(function () {
  if (!this.lastLogin) return "Never";
  return this.lastLogin.toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

// Virtual for account status display
UserSchema.virtual("statusDisplay").get(function () {
  return this.isActive ? "Active" : "Inactive";
});

// ==================== JSON TRANSFORMATION ====================

// Customize JSON output (remove sensitive fields when needed)
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  // Keep password for now (your frontend displays it in manage page)
  // In production with JWT auth, you would delete it:
  // delete obj.password;
  delete obj.resetToken;
  delete obj.resetTokenExpiry;
  delete obj.__v;
  return obj;
};

// Method to get safe user object (without password)
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetToken;
  delete obj.resetTokenExpiry;
  delete obj.__v;
  return obj;
};

// ==================== PRODUCTION SECURITY NOTES ====================
/*
 * CURRENT IMPLEMENTATION (Development):
 * - Passwords stored in plain text for easy testing
 * - Password visible in admin panel for team management
 * - Simple username/password authentication
 *
 * PRODUCTION RECOMMENDATIONS:
 *
 * 1. PASSWORD HASHING:
 * const bcrypt = require('bcryptjs');
 *
 * UserSchema.pre('save', async function(next) {
 *   if (this.isModified('password')) {
 *     this.password = await bcrypt.hash(this.password, 10);
 *   }
 *   next();
 * });
 *
 * UserSchema.methods.comparePassword = async function(candidatePassword) {
 *   return bcrypt.compare(candidatePassword, this.password);
 * };
 *
 * 2. JWT AUTHENTICATION:
 * - Implement JWT tokens for sessions
 * - Store refresh tokens
 * - Add token expiry
 *
 * 3. PASSWORD POLICIES:
 * - Minimum 8 characters
 * - Require uppercase, lowercase, numbers, symbols
 * - Password history (prevent reuse)
 * - Expiry (force change every 90 days)
 *
 * 4. ACCOUNT SECURITY:
 * - Account lockout after failed login attempts
 * - Two-factor authentication (2FA)
 * - Email verification
 * - Security questions
 * - IP-based access control
 *
 * 5. AUDIT LOGGING:
 * - Track all login attempts
 * - Track password changes
 * - Track permission changes
 * - Track data access
 */

export default mongoose.model("User", UserSchema);
