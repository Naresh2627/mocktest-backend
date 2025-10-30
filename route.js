import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import { z } from "zod";
import { supabase } from "./database.js";
import { authenticationtoken } from "./authmiddleware.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "./emailService.js";
import { 
  generateJWTToken, 
  generateVerificationToken, 
  generatePasswordResetToken, 
  verifyToken 
} from "./utils.js";

const router = express.Router();

const signupSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});


router.get("/google", (req, res, next) => {
  console.log("Google OAuth initiated");
  passport.authenticate("google", { 
    scope: ["profile", "email"]
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  console.log("=== Google OAuth callback received ===");
  console.log("Query params:", req.query);
  console.log("Environment:", process.env.NODE_ENV);
  console.log("Frontend URL:", process.env.FRONTEND_URL);
  
  passport.authenticate("google", (err, user, info) => {
    console.log("=== Passport authenticate result ===");
    console.log("Error:", err);
    console.log("User:", user ? { id: user.id, email: user.email } : null);
    console.log("Info:", info);
    
    if (err) {
      console.error("Google OAuth error:", err);
      const errorUrl = `${process.env.FRONTEND_URL}/login?error=oauth_error&message=${encodeURIComponent(err.message)}`;
      return res.redirect(errorUrl);
    }
    
    if (!user) {
      console.error("Google OAuth failed - no user:", info);
      const errorUrl = `${process.env.FRONTEND_URL}/login?error=auth_failed&message=${encodeURIComponent('Authentication failed')}`;
      return res.redirect(errorUrl);
    }

    console.log("User authenticated successfully:", { id: user.id, email: user.email });

    // Generate token and return success response
    try {
      const token = generateJWTToken({ id: user.id, email: user.email });
      console.log("Token generated successfully");
      
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}`;
      console.log("Redirecting to:", redirectUrl);
      
      // Redirect to frontend with token
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Token generation error:", error);
      const errorUrl = `${process.env.FRONTEND_URL}/login?error=token_error&message=${encodeURIComponent('Token generation failed')}`;
      return res.redirect(errorUrl);
    }
  })(req, res, next);
});


router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = signupSchema.parse(req.body); 
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Check if using dummy email for testing
    const isDummyEmail = email.includes('dummy') || email.includes('test') || email.includes('@test.') || email.includes('@example.');

    const { data, error } = await supabase
      .from("users")
      .insert([{ 
        name, 
        email, 
        password: hashed, 
        email_verified: isDummyEmail, // Auto-verify dummy emails
        email_verified_at: isDummyEmail ? new Date().toISOString() : null,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    // Generate verification token and send email
    try {
      const verificationToken = generateVerificationToken(data[0].id, email);
      await sendVerificationEmail(email, verificationToken);
      
      const isDummyEmail = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com' || process.env.EMAIL_USER.includes('dummy') || process.env.EMAIL_USER.includes('test');
      
      if (isDummyEmail) {
        res.json({ 
          message: "Signup successful! Check server console for verification link. You can also login directly.",
          userId: data[0].id,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}` // Only for testing
        });
      } else {
        res.json({ 
          message: "Signup successful! Please check your email to verify your account.",
          userId: data[0].id
        });
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      res.json({ 
        message: "Signup successful! However, verification email could not be sent. You can still login.",
        userId: data[0].id
      });
    }
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user)
      return res.status(401).json({ error: "Invalid credentials" });

    // Check if user has a password (not a Google OAuth user)
    if (!user.password) {
      return res.status(401).json({ 
        error: "This account was created with Google. Please use 'Continue with Google' to login." 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Invalid credentials" });

    // Check if email is verified (optional - you can remove this check if needed)
    // if (!user.email_verified) {
    //   return res.status(401).json({ 
    //     error: "Please verify your email before logging in",
    //     needsVerification: true,
    //     userId: user.id
    //   });
    // }

    const token = generateJWTToken({ id: user.id, email: user.email });

    // Update last login
    await supabase
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.email_verified,
      },
    });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Email verification route
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const decoded = verifyToken(token);
    
    if (decoded.type !== 'verification') {
      return res.status(400).json({ error: "Invalid token type" });
    }

    // Update user's email verification status
    const { error } = await supabase
      .from("users")
      .update({ 
        email_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .eq("id", decoded.userId);

    if (error) {
      return res.status(400).json({ error: "Failed to verify email" });
    }

    res.json({ message: "Email verified successfully! You can now log in." });
  } catch (err) {
    res.status(400).json({ error: "Invalid or expired verification token" });
  }
});

// Resend verification email
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, email_verified")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    const verificationToken = generateVerificationToken(user.id, user.email);
    await sendVerificationEmail(user.email, verificationToken);

    res.json({ message: "Verification email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// Password reset request
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = passwordResetRequestSchema.parse(req.body);

    const { data: user } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    try {
      const resetToken = generatePasswordResetToken(user.id, user.email);
      await sendPasswordResetEmail(user.email, resetToken);
      
      // For testing with dummy emails, also return the token in development
      const isDummyEmail = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com' || process.env.EMAIL_USER.includes('dummy') || process.env.EMAIL_USER.includes('test');
      
      if (isDummyEmail) {
        res.json({ 
          message: "Password reset email sent! (Check server console for reset link)",
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}` // Only for testing
        });
      } else {
        res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      return res.status(500).json({ 
        error: "Failed to send password reset email. Please try again later or contact support." 
      });
    }
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = passwordResetSchema.parse(req.body);

    const decoded = verifyToken(token);
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: "Invalid token type" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from("users")
      .update({ 
        password: hashedPassword,
        password_reset_at: new Date().toISOString()
      })
      .eq("id", decoded.userId);

    if (error) {
      return res.status(400).json({ error: "Failed to reset password" });
    }

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(400).json({ error: "Invalid or expired reset token" });
  }
});

router.get("/profile", authenticationtoken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id,name,email,email_verified,created_at,last_login")
      .eq("id", req.user.id)
      .single();

    res.json({ message: "Welcome to your profile!", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test route to check Google OAuth configuration
router.get("/test-google", (req, res) => {
  const callbackURL = process.env.NODE_ENV === 'production' 
    ? `${process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://your-backend-app.onrender.com'}/oauth/google/callback`
    : "http://localhost:3000/oauth/google/callback";
    
  res.json({
    message: "Google OAuth test route",
    environment: process.env.NODE_ENV,
    clientId: process.env.GOOGLE_CLIENT_ID ? "✅ Set" : "❌ Missing",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? "✅ Set" : "❌ Missing",
    callbackUrl: callbackURL,
    frontendUrl: process.env.FRONTEND_URL,
    backendUrl: process.env.BACKEND_URL,
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL
  });
});

// Test route to check email configuration
router.get("/test-email", (req, res) => {
  const isDummyEmail = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com' || process.env.EMAIL_USER.includes('dummy') || process.env.EMAIL_USER.includes('test');
  
  res.json({
    message: "Email configuration test route",
    emailUser: process.env.EMAIL_USER,
    isDummyEmail: isDummyEmail,
    status: isDummyEmail ? "Using mock email service (links will appear in console)" : "Real email service configured"
  });
});

// Debug route to generate test reset link (for testing only)
router.post("/debug/generate-reset-link", async (req, res) => {
  try {
    const { email } = req.body;
    
    const { data: user } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resetToken = generatePasswordResetToken(user.id, user.email);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    res.json({
      message: "Debug reset link generated",
      email: user.email,
      resetUrl: resetUrl,
      note: "This is for testing only. In production, this link would be sent via email."
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate reset link" });
  }
});

export default router;
