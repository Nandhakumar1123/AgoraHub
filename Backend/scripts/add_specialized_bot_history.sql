-- =====================================================
-- SPECIALIZED BOT HISTORY TABLES
-- =====================================================

-- Table for Complaint AI Chat History
CREATE TABLE IF NOT EXISTS complaint_bot_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    community_id BIGINT NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    session_hash VARCHAR(64),
    confidence INTEGER,
    source_count INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_bot_history_community_created
ON complaint_bot_history(community_id, created_at DESC);

-- Table for Petition AI Chat History
CREATE TABLE IF NOT EXISTS petition_bot_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    community_id BIGINT NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    session_hash VARCHAR(64),
    confidence INTEGER,
    source_count INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petition_bot_history_community_created
ON petition_bot_history(community_id, created_at DESC);
