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

CREATE TABLE polls (
    poll_id         SERIAL PRIMARY KEY,
    community_id    INTEGER NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    created_by      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Core content
    title           TEXT NOT NULL,
    description     TEXT,

    -- Voting behaviour
    allow_multiple_answers  BOOLEAN DEFAULT FALSE,
    allow_change_vote       BOOLEAN DEFAULT TRUE,
    allow_suggestions       BOOLEAN DEFAULT FALSE,
    require_comment         BOOLEAN DEFAULT FALSE,

    -- Visibility & access
    visibility          VARCHAR(10)  NOT NULL DEFAULT 'public'
                            CHECK (visibility IN ('public', 'private')),
    result_visibility   VARCHAR(20)  NOT NULL DEFAULT 'after_vote'
                            CHECK (result_visibility IN ('immediate', 'after_vote', 'after_close')),
    voting_requirement  VARCHAR(20)  NOT NULL DEFAULT 'everyone'
                            CHECK (voting_requirement IN ('everyone', 'heads_only', 'tenure')),

    -- Display options
    show_voter_count    BOOLEAN DEFAULT TRUE,
    anonymous_voting    BOOLEAN DEFAULT FALSE,
    min_votes_to_show   INTEGER DEFAULT 0 CHECK (min_votes_to_show >= 0),

    -- Duration
    duration_code   VARCHAR(10) DEFAULT '7d'
                        CHECK (duration_code IN ('1h','6h','1d','3d','7d','30d','unlimited')),
    closes_at       TIMESTAMPTZ,   -- NULL when duration_code = 'unlimited'

    -- Status
    is_active       BOOLEAN DEFAULT TRUE,
    closed_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,  -- manual close
    closed_at       TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_polls_community_id  ON polls(community_id);
CREATE INDEX idx_polls_created_by    ON polls(created_by);
CREATE INDEX idx_polls_created_at    ON polls(created_at DESC);
CREATE INDEX idx_polls_closes_at     ON polls(closes_at)
    WHERE closes_at IS NOT NULL;
CREATE INDEX idx_polls_is_active     ON polls(community_id, is_active);

-- =====================================================
-- POLL OPTIONS TABLE
-- =====================================================
CREATE TABLE poll_options (
    option_id   SERIAL PRIMARY KEY,
    poll_id     INTEGER NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
    label       TEXT    NOT NULL,
    position    INTEGER NOT NULL,          -- display order (1-based)

    -- For allow_suggestions: track who suggested it
    suggested_by    INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    is_suggestion   BOOLEAN DEFAULT FALSE,
    approved        BOOLEAN DEFAULT TRUE,  -- HEAD/ADMIN must approve suggestions

    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (poll_id, position),
    CONSTRAINT max_label_length CHECK (char_length(label) <= 100)
);

-- Indexes
CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX idx_poll_options_suggestions ON poll_options(poll_id, is_suggestion)
    WHERE is_suggestion = TRUE;

-- =====================================================
-- POLL VOTES TABLE
-- =====================================================
CREATE TABLE poll_votes (
    vote_id     SERIAL PRIMARY KEY,
    poll_id     INTEGER NOT NULL REFERENCES polls(poll_id)    ON DELETE CASCADE,
    option_id   INTEGER NOT NULL REFERENCES poll_options(option_id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(user_id)    ON DELETE CASCADE,

    -- Optional comment (required when polls.require_comment = TRUE)
    comment     TEXT,

    locked      BOOLEAN     DEFAULT FALSE,  -- TRUE after poll closes / vote locked in
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    -- One row per (poll, option, user) — supports multiple-answer polls naturally
    UNIQUE (poll_id, option_id, user_id)
);

-- Indexes
CREATE INDEX idx_poll_votes_poll_id   ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_option_id ON poll_votes(option_id);
CREATE INDEX idx_poll_votes_user_id   ON poll_votes(user_id);
CREATE INDEX idx_poll_votes_locked    ON poll_votes(poll_id, user_id, locked);

-- =====================================================
-- POLL SUGGESTIONS TABLE
-- (when allow_suggestions = TRUE, members propose new options)
-- =====================================================
CREATE TABLE poll_suggestions (
    suggestion_id   SERIAL PRIMARY KEY,
    poll_id         INTEGER NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
    suggested_by    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    label           TEXT    NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    -- Once approved, a poll_option row is created and linked here
    option_id       INTEGER REFERENCES poll_options(option_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT max_suggestion_length CHECK (char_length(label) <= 100)
);

CREATE INDEX idx_poll_suggestions_poll_id ON poll_suggestions(poll_id);
CREATE INDEX idx_poll_suggestions_status  ON poll_suggestions(poll_id, status);

-- =====================================================
-- POLL COMMENTS TABLE
-- (stores require_comment responses separately for query flexibility)
-- =====================================================
CREATE TABLE poll_comments (
    comment_id  SERIAL PRIMARY KEY,
    poll_id     INTEGER NOT NULL REFERENCES polls(poll_id)  ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(user_id)  ON DELETE CASCADE,
    comment     TEXT    NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (poll_id, user_id)   -- one comment per voter per poll
);

CREATE INDEX idx_poll_comments_poll_id ON poll_comments(poll_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at on polls
CREATE OR REPLACE FUNCTION update_polls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_polls_updated_at
    BEFORE UPDATE ON polls
    FOR EACH ROW EXECUTE FUNCTION update_polls_updated_at();

-- Auto-update updated_at on poll_votes
CREATE OR REPLACE FUNCTION update_poll_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_poll_votes_timestamp
    BEFORE UPDATE ON poll_votes
    FOR EACH ROW EXECUTE FUNCTION update_poll_votes_updated_at();

-- Auto-close poll when closes_at is reached (used by a scheduled job or checked on read)
-- This function is called by your backend cron / on-read check, not a DB trigger,
-- because PostgreSQL doesn't natively support time-based triggers.

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- Live vote counts per option (respects min_votes_to_show via app layer)
CREATE OR REPLACE VIEW poll_option_counts AS
SELECT
    po.poll_id,
    po.option_id,
    po.label,
    po.position,
    COUNT(pv.vote_id)               AS vote_count,
    COUNT(pv.vote_id) * 100.0 /
        NULLIF(
            COUNT(pv.vote_id) OVER (PARTITION BY po.poll_id),
        0)                          AS vote_percentage
FROM poll_options po
LEFT JOIN poll_votes pv
    ON pv.option_id = po.option_id
   AND pv.poll_id   = po.poll_id
WHERE po.approved = TRUE
GROUP BY po.poll_id, po.option_id, po.label, po.position;

-- Total unique voters per poll
CREATE OR REPLACE VIEW poll_voter_totals AS
SELECT
    poll_id,
    COUNT(DISTINCT user_id) AS total_voters
FROM poll_votes
GROUP BY poll_id;

-- Full poll summary (join with communities and users)
CREATE OR REPLACE VIEW poll_summary AS
SELECT
    p.poll_id,
    p.title,
    p.description,
    p.duration_code,
    p.closes_at,
    p.is_active,
    p.result_visibility,
    p.voting_requirement,
    p.anonymous_voting,
    p.allow_multiple_answers,
    p.allow_change_vote,
    p.allow_suggestions,
    p.require_comment,
    p.show_voter_count,
    p.min_votes_to_show,
    p.created_at,
    -- Community info
    c.community_id,
    c.name          AS community_name,
    c.community_type,
    -- Creator info
    u.user_id       AS creator_id,
    u.full_name     AS creator_name,
    -- Vote stats
    COALESCE(pvt.total_voters, 0) AS total_voters,
    -- Auto-close status derived from closes_at
    CASE
        WHEN p.closes_at IS NOT NULL AND p.closes_at < NOW() THEN FALSE
        ELSE p.is_active
    END AS effectively_active
FROM polls p
JOIN communities c ON c.community_id = p.community_id
JOIN users       u ON u.user_id       = p.created_by
LEFT JOIN poll_voter_totals pvt ON pvt.poll_id = p.poll_id;
