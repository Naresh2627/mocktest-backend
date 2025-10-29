-- Create labels table for user-defined labels
CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#667eea', -- Hex color code
  icon VARCHAR(50) DEFAULT '🏷️', -- Emoji or icon identifier
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate label names per user
);

-- Create categories table for broader organization
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#28a745',
  icon VARCHAR(50) DEFAULT '📁',
  description TEXT,
  parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, -- For nested categories
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate category names per user
);

-- Create junction table for note-label relationships (many-to-many)
CREATE TABLE IF NOT EXISTS note_labels (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(note_id, label_id) -- Prevent duplicate label assignments
);

-- Create junction table for note-category relationships (many-to-many)
CREATE TABLE IF NOT EXISTS note_categories (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(note_id, category_id) -- Prevent duplicate category assignments
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id);
CREATE INDEX IF NOT EXISTS idx_labels_name ON labels(name);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_note_labels_note_id ON note_labels(note_id);
CREATE INDEX IF NOT EXISTS idx_note_labels_label_id ON note_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_note_id ON note_categories(note_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_category_id ON note_categories(category_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_labels_updated_at 
    BEFORE UPDATE ON labels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some default labels for new users (optional)
-- These will be created when a user first accesses the labels feature