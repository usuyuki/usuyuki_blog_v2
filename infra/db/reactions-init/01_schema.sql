CREATE DATABASE IF NOT EXISTS usuyuki_blog
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_bin;

USE usuyuki_blog;

CREATE TABLE IF NOT EXISTS emoji_reactions (
  id         BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  slug       VARCHAR(255)     NOT NULL,
  emoji      VARCHAR(10)      NOT NULL,
  client_id  VARCHAR(36)      NOT NULL,
  created_at DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reaction (slug, emoji, client_id),
  INDEX      idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
