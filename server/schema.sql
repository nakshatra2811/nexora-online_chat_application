-- Nexora App Schema (Supabase PostgreSQL)
-- Goal: Privacy-first structure.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. USERS TABLE
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'Normal' CHECK (role IN ('Normal', 'SpecialAtithi', 'Admin')),
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Pending', 'Active', 'Suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 2. CHATS & MESSAGES (End-to-End Encrypted)
-- ==========================================
-- Note: Messages are encrypted client-side. The server only sees the ciphertext and the IV.
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    is_group BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_participants (
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    user_a TEXT NOT NULL,
    user_b TEXT NOT NULL,
    wallpaper TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_a, user_b)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    encrypted_payload TEXT NOT NULL, -- Encrypted message or media URI (Cloudinary)
    iv TEXT NOT NULL, -- Initialization vector for E2EE decryption
    cloudinary_public_id TEXT, -- If media, store the Cloudinary ID to auto-delete it later
    is_media BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE, -- For auto-deletion features
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. VAULT AUDIT LOG (Blind Admin visibility)
-- ==========================================
-- Admins can trigger remote-deletion of vaults, but cannot see the encrypted contents.
CREATE TABLE vault_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for fast lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_expires_at ON messages(expires_at);

-- ==========================================
-- AUTO-DELETION SQL TRIGGER
-- ==========================================
-- (Optional: Instead of cron, we can use a Supabase pg_cron extension to delete expired messages) 
ALTER TABLE users ADD COLUMN wallpaper_url TEXT;
