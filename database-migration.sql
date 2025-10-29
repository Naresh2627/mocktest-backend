-- Add new columns to existing users table for enhanced authentication
-- Your existing table has: id, name, email, password

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Make password column nullable to support Google OAuth users
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Update existing users to have creation timestamp
UPDATE users 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Update existing Google OAuth users (users without password) to be verified
UPDATE users 
SET email_verified = TRUE, 
    email_verified_at = NOW() 
WHERE password IS NULL AND email_verified = FALSE;

-- Update existing dummy email users to be verified
UPDATE users 
SET email_verified = TRUE, 
    email_verified_at = NOW() 
WHERE (email LIKE '%dummy%' OR email LIKE '%test%' OR email LIKE '%@test.%' OR email LIKE '%@example.%') 
AND email_verified = FALSE;