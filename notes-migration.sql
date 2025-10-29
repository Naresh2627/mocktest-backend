-- Create notes table with all required features
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  encrypted_content TEXT, -- For encrypted notes
  is_encrypted BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  public_share_id VARCHAR(50) UNIQUE, -- For public sharing
  tags TEXT[], -- Array of tags
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  auto_saved_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_public ON notes(is_public);
CREATE INDEX IF NOT EXISTS idx_notes_public_share_id ON notes(public_share_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_draft ON notes(is_draft);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_notes_updated_at 
    BEFORE UPDATE ON notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create table for note sharing permissions (for future use)
CREATE TABLE IF NOT EXISTS note_shares (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) DEFAULT 'read', -- 'read', 'write', 'admin'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_user_id ON note_shares(shared_with_user_id);