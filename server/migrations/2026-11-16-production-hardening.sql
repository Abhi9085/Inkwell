-- Inkwell production hardening migration (PostgreSQL).
-- Run once against a backup/staging database first.
BEGIN;

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_active
  ON refresh_sessions(user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expiry
  ON refresh_sessions(expires_at);

-- Feed/profile/follow/notification access paths.
CREATE INDEX IF NOT EXISTS idx_posts_published_created_id
  ON posts(created_at DESC, id DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_user_published_created
  ON posts(user_id, created_at DESC, id DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_category_published_created
  ON posts(category, created_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_follower_following
  ON follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_follower
  ON follows(following_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair_a
  ON blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair_b
  ON blocks(blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_recipient
  ON notifications(recipient_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user
  ON post_likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_post_views_post_user
  ON post_views(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_post_view_events_user_viewed
  ON post_view_events(user_id, viewed_at DESC);

-- Search indexes. pg_trgm enables indexed ILIKE/similarity searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_excerpt_trgm ON posts USING GIN (excerpt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_handle_trgm ON users USING GIN (handle gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_handle_lower ON users (LOWER(handle));

COMMIT;
