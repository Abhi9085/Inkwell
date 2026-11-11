
-- Add profile privacy setting.
-- Existing accounts remain public by default.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;


-- Store pending follow requests separately from confirmed follows.

CREATE TABLE IF NOT EXISTS follow_requests (
    id SERIAL PRIMARY KEY,

    requester_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    recipient_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (requester_id, recipient_id),

    CHECK (requester_id <> recipient_id)
);


-- Indexes for retrieving requests efficiently.

CREATE INDEX IF NOT EXISTS idx_follow_requests_recipient
ON follow_requests(recipient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_requests_requester
ON follow_requests(requester_id, status);
