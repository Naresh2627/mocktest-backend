import dotenv from 'dotenv';

dotenv.config();

// Mock email service for testing with dummy emails
const isDummyEmail = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com' || process.env.EMAIL_USER.includes('dummy') || process.env.EMAIL_USER.includes('test');

// Send verification email
export const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  if (isDummyEmail) {
    // Mock email sending for testing
    console.log('📧 MOCK EMAIL - Verification Email');
    console.log('To:', email);
    console.log('Subject: Verify Your Email Address');
    console.log('Verification URL:', verificationUrl);
    console.log('Token:', token);
    console.log('✅ Mock verification email "sent" successfully');
    return;
  }

  // Real email sending code would go here
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Thank you for signing up! Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully');
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  if (isDummyEmail) {
    // Mock email sending for testing
    console.log('📧 MOCK EMAIL - Password Reset Email');
    console.log('To:', email);
    console.log('Subject: Password Reset Request');
    console.log('Reset URL:', resetUrl);
    console.log('Token:', token);
    console.log('✅ Mock password reset email "sent" successfully');
    return;
  }

  // Real email sending code would go here
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the button below to reset your password:</p>
        <a href="${resetUrl}" 
           style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully');
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};