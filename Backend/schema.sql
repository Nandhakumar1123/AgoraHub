-- =====================================================
-- DATABASE SCHEMA FOR MINI COMMUNITY APP
-- =====================================================

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS communities CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS petitions CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS anonymous_messages CASCADE;
DROP TABLE IF EXISTS anonymous_message_attachments CASCADE;
DROP TABLE IF EXISTS embeddings CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile_number VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',
    voice_support BOOLEAN DEFAULT FALSE,
    accept_terms BOOLEAN DEFAULT FALSE,
    profile_type VARCHAR(50) DEFAULT 'transparent',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- =====================================================
-- COMMUNITIES TABLE
-- =====================================================
CREATE TABLE communities (
    community_id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    community_type VARCHAR(50) NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MEMBERSHIPS TABLE
-- =====================================================
CREATE TABLE memberships (
    membership_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('HEAD', 'ADMIN', 'MEMBER')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BANNED', 'LEFT')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

-- =====================================================
-- PETITIONS TABLE
-- =====================================================
CREATE TABLE petitions (
    petition_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    problem_statement TEXT NOT NULL,
    proposed_action TEXT NOT NULL,
    goal_type VARCHAR(100) NOT NULL,
    other_goal_type VARCHAR(255),
    impact_area VARCHAR(100) NOT NULL,
    other_impact_area VARCHAR(255),
    affected_groups TEXT[],
    priority_level VARCHAR(20) DEFAULT 'normal' CHECK (priority_level IN ('normal', 'important', 'critical')),
    reference_context TEXT,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    author_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Review',
    reviewed_by INTEGER REFERENCES users(user_id),
    remarks TEXT,
    nlp_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- COMPLAINTS TABLE
-- =====================================================
CREATE TABLE complaints (
    complaint_id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('infrastructure', 'cleanliness', 'safety', 'food', 'noise', 'finance', 'behavior', 'other')),
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_urgent BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(10) DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    allow_follow_up BOOLEAN DEFAULT FALSE,
    preferred_contact_channel VARCHAR(10) DEFAULT 'chat' CHECK (preferred_contact_channel IN ('chat', 'email', 'phone')),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    tags TEXT[],
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    nlp_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(user_id)
);

-- =====================================================
-- EVENTS TABLE (Replaced from ANNOUNCEMENTS)
-- =====================================================
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    community_id INTEGER REFERENCES communities(community_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    effective_from DATE,
    valid_until DATE,
    applicable_to VARCHAR(100),
    attachment_url TEXT,
    attachment_type VARCHAR(50),
    posted_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--============================================
--ANONYMOUS MESSAGES TABLE
--============================================
CREATE TABLE anonymous_messages (
  message_id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  head_ids INTEGER[] NOT NULL DEFAULT '{}',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Attachments (fixed)
CREATE TABLE anonymous_message_attachments (
  attachment_id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES anonymous_messages(message_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image','video','document','audio')),
  file_url TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_anon_messages_community ON anonymous_messages(community_id, created_at DESC);
CREATE INDEX idx_anon_messages_head ON anonymous_messages USING GIN(head_ids);
CREATE INDEX idx_anon_attach_message ON anonymous_message_attachments(message_id);
-- =====================================================
-- EMBEDDINGS TABLE (for AI/NLP service)
-- =====================================================
CREATE TABLE embeddings (
    embedding_id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- COMMUNITY FEATURES TABLE
-- =====================================================
ALTER TABLE communities ADD COLUMN complaints_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE communities ADD COLUMN petitions_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE communities ADD COLUMN voting_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE communities ADD COLUMN group_chat_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE communities ADD COLUMN anonymous_enabled BOOLEAN DEFAULT FALSE;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_community_id ON memberships(community_id);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_communities_code ON communities(code);
CREATE INDEX idx_communities_created_by ON communities(created_by);
CREATE INDEX idx_petitions_community_id ON petitions(community_id);
CREATE INDEX idx_petitions_author_id ON petitions(author_id);
CREATE INDEX idx_petitions_created_at ON petitions(created_at);
CREATE INDEX idx_petitions_status ON petitions(status);
CREATE INDEX idx_complaints_community_id ON complaints(community_id);
CREATE INDEX idx_complaints_created_by ON complaints(created_by);
CREATE INDEX idx_events_community_id ON events(community_id);
CREATE INDEX idx_embeddings_community_id ON embeddings(community_id);
CREATE INDEX idx_embeddings_source_type ON embeddings(source_type);
CREATE INDEX idx_anonymous_messages_community_id ON anonymous_messages(community_id);
CREATE INDEX idx_anonymous_messages_sender_id ON anonymous_messages(sender_id);
CREATE INDEX idx_anonymous_messages_status ON anonymous_messages(status);
CREATE INDEX idx_anonymous_messages_created_at ON anonymous_messages(created_at);
CREATE INDEX idx_anonymous_message_attachments_message_id ON anonymous_message_attachments(message_id);

-- =====================================================
-- ANONYMOUS MESSAGES TABLE
-- =====================================================
CREATE TABLE anonymous_messages (
    message_id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE, -- Nullable for truly anonymous messages
    text TEXT NOT NULL,
    head_ids INTEGER[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    replied_at TIMESTAMP,
    replied_by INTEGER REFERENCES users(user_id)
);

-- =====================================================
-- ANONYMOUS MESSAGE ATTACHMENTS TABLE
-- =====================================================
CREATE TABLE anonymous_message_attachments (
    attachment_id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES anonymous_messages(message_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NLP Audit Table
CREATE TABLE IF NOT EXISTS nlp_audit (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  community_id INT NOT NULL,
  text_hash TEXT NOT NULL,
  raw_text TEXT,
  sentiment JSONB,
  toxicity JSONB,
  action VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable pgvector (run once)
CREATE EXTENSION IF NOT EXISTS vector;


-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_petitions_updated_at BEFORE UPDATE ON petitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Community chat messages table
CREATE TABLE chat_messages (
    message_id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'sos', 'poll', 'event')),
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::JSONB,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    parent_message_id INTEGER REFERENCES chat_messages(message_id),
    reaction_count JSONB DEFAULT '{}'::JSONB,
    viewed_by INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_community ON chat_messages(community_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_parent ON chat_messages(parent_message_id);
CREATE INDEX idx_chat_messages_gin_reactions ON chat_messages USING GIN(reaction_count);

CREATE TABLE documents (
  id serial PRIMARY KEY,
  title text,
  content text
);

CREATE TABLE nlp_analyses (
  id serial PRIMARY KEY,
  community_id integer,
  text text,
  sentiment_label text,
  sentiment_score numeric,
  toxicity boolean,
  toxicity_score numeric,
  model_response text,
  created_at timestamptz DEFAULT now()
);


CREATE TABLE bot_chat_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    community_id BIGINT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    session_hash VARCHAR(64),
    confidence INTEGER,
    source_count INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bot_chat_history_community_created
    ON bot_chat_history (community_id, created_at DESC);

CREATE INDEX idx_bot_chat_history_user_created
    ON bot_chat_history (user_id, created_at DESC);
