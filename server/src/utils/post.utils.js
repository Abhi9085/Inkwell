const slugify = (text = "") => text.toString().trim().toLowerCase()
  .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

const generateExcerpt = (content = "") => {
  const plainText = content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return plainText.length <= 150 ? plainText : `${plainText.substring(0, 150)}...`;
};

const POST_SELECT = `
  SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.cover,
    COALESCE(p.category, 'General') AS category,
    COALESCE(p.tags, ARRAY[]::text[]) AS tags,
    COALESCE(p.reading_time, 0) AS "readingTime",
    COALESCE(p.likes, 0) AS likes, COALESCE(p.views, 0) AS views,
    COALESCE(p.is_featured, false) AS featured,
    COALESCE(p.is_trending, false) AS trending,
    CASE WHEN p.published_at IS NULL THEN 'Draft' ELSE 'Public' END AS status,
    p.published_at AS "publishedAt", p.created_at AS "createdAt",
    json_build_object('id', u.id, 'name', u.name, 'handle', u.handle,
      'avatar', u.avatar, 'bio', COALESCE(u.bio, ''),
      'role', COALESCE(u.role, 'Writer')) AS author
  FROM posts p JOIN users u ON p.user_id = u.id
`;

module.exports = { slugify, generateExcerpt, POST_SELECT };
