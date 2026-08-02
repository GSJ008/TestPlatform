const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      // Only required for local (email/password) accounts. Google accounts
      // never get a password on our side - Google is the source of truth
      // for that credential, we just trust their verified id_token.
      required: function () {
        return this.authProvider === "local";
      }
      // This stores a bcrypt HASH, never the plaintext password.
      // Hashing happens in the /register route, not here, so that
      // re-saving a user document for unrelated fields doesn't
      // accidentally re-hash an already-hashed password.
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local"
    },
    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true // allows many docs with googleId: null while still being unique for real values
    },
    // Local accounts must verify their email before they can log in.
    // Google accounts are considered verified immediately, since Google
    // already verified the email address on their end.
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
      default: null
    },
    verificationTokenExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true // adds createdAt / updatedAt automatically
  }
);

module.exports = mongoose.model("User", userSchema);