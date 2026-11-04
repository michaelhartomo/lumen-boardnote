-- ============================================================================
-- Lumen PostgreSQL Schema & Data Migration Script (lm_* Tables)
-- ============================================================================
-- Rules enforced:
-- 1. Every table has a *_uuid column (DEFAULT uuidv7()) for time-ordered increments
-- 2. Every table has vendor_code, master_code, project_code, and user_account
-- 3. Every table *_code column uses varchar(190) and the app generates UUIDv4
-- 4. Singular naming and present tense (lm_board, lm_board_card, lm_board_activity,
--    lm_card_comment, lm_file_storage, lm_ai_usage, lm_bandwidth_usage, lm_user_setting)
-- 5. Timestamp column naming: time_create, time_modify, time_access
-- 6. lm_file_storage removes storage_type (S3 only)
-- 7. Combines user_setting, user_settings, and user_storage_limits into lm_user_setting
-- ============================================================================

-- RFC 9562 UUIDv7 Generator Function for Time-Ordered Globally Unique Identifiers
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
    unix_ts_ms bytea;
    uuid_bytes bytea;
BEGIN
    unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6);
    uuid_bytes = unix_ts_ms || substring(uuid_send(gen_random_uuid()) from 7 for 10);
    uuid_bytes = set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112); -- version 7 (0x70)
    uuid_bytes = set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128); -- variant RFC 4122 (0x80)
    return encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- ----------------------------
-- 1. Table structure for lm_board
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_board" (
  "board_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "board_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "board_name" varchar(190) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'Untitled Board'::character varying,
  "board_description" text COLLATE "pg_catalog"."default" DEFAULT ''::text,
  "board_viewport" jsonb DEFAULT '{"panX": 0, "panY": 0, "zoom": 1}'::jsonb,
  "board_connection" jsonb DEFAULT '[]'::jsonb,
  "board_drawing" jsonb DEFAULT '[]'::jsonb,
  "board_setting" jsonb DEFAULT '{}'::jsonb,

  "time_modify" timestamptz(6) DEFAULT now(),
  "time_create" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("board_code")
);

-- ----------------------------
-- 2. Table structure for lm_board_card
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_board_card" (
  "card_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "card_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "board_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "card_type" varchar(64) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'note'::character varying,
  "card_name" varchar(256) COLLATE "pg_catalog"."default" DEFAULT ''::character varying,
  "pos_x" numeric NOT NULL DEFAULT 0,
  "pos_y" numeric NOT NULL DEFAULT 0,
  "width" numeric NOT NULL DEFAULT 280,
  "height" numeric NOT NULL DEFAULT 200,
  "z_index" int4 DEFAULT 1,
  "is_locked" bool DEFAULT false,
  "card_data" jsonb DEFAULT '{}'::jsonb,
  "card_style" jsonb DEFAULT '{}'::jsonb,
  "card_raw" jsonb DEFAULT '{}'::jsonb,
  "card_encryption" jsonb,
  "time_modify" timestamptz(6) DEFAULT now(),
  "time_create" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("card_code")
);

-- ----------------------------
-- 2b. Table structure for lm_card_tombstone
-- Durable deleted-card tombstones: without these, card deletions were
-- only remembered in server memory and deleted cards resurrected from
-- stale board copies after a server restart.
CREATE TABLE IF NOT EXISTS "public"."lm_card_tombstone" (
  "card_code" varchar(190) NOT NULL,
  "board_code" varchar(190),
  "time_create" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("card_code")
);

-- ----------------------------
-- 3. Table structure for lm_board_activity
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_board_activity" (
  "board_activity_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "board_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "user_name" varchar(190) COLLATE "pg_catalog"."default",
  "user_avatar" varchar(190) COLLATE "pg_catalog"."default",
  "user_color" varchar(190) COLLATE "pg_catalog"."default",
  "action_type" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "card_code" varchar(190) COLLATE "pg_catalog"."default",
  "card_title" varchar(256) COLLATE "pg_catalog"."default",
  "card_detail" jsonb DEFAULT '{}'::jsonb,
  "time_create" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("board_activity_uuid")
);

-- ----------------------------
-- 4. Table structure for lm_card_comment
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_card_comment" (
  "card_comment_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "card_comment_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "card_comment_code_parent" varchar(190) COLLATE "pg_catalog"."default",

  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "card_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "board_code" varchar(190) COLLATE "pg_catalog"."default",
  "card_comment_text" text COLLATE "pg_catalog"."default" NOT NULL,
  "card_comment_reaction" jsonb DEFAULT '{}'::jsonb,
  "time_create" timestamptz(6) DEFAULT now(),
  "time_modify" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("card_comment_code")
);

-- ----------------------------
-- 5. Table structure for lm_file_storage (S3 only, storage_type deleted)
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_file_storage" (
  "file_storage_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "file_storage_code" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "file_name" varchar(512) COLLATE "pg_catalog"."default" NOT NULL,
  "file_type" varchar(190) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'application/octet-stream'::character varying,
  "file_size" int8 NOT NULL DEFAULT 0,
  "s3_key" text COLLATE "pg_catalog"."default",
  "s3_bucket" varchar(256) COLLATE "pg_catalog"."default",
  "s3_endpoint" text COLLATE "pg_catalog"."default",
  "view_url" text COLLATE "pg_catalog"."default",
  "download_url" text COLLATE "pg_catalog"."default",
  "board_code" varchar(190) COLLATE "pg_catalog"."default",

  "auto_load_count" int8 NOT NULL DEFAULT 0,
  "download_count" int8 NOT NULL DEFAULT 0,
  "auto_load_byte" int8 NOT NULL DEFAULT 0,
  "download_byte" int8 NOT NULL DEFAULT 0,
  "cdn_cached_byte" int8 NOT NULL DEFAULT 0,
  "blocked_hotlink_count" int8 NOT NULL DEFAULT 0,

  "time_create" timestamptz(6) DEFAULT now(),
  "time_modify" timestamptz(6) DEFAULT now(),
  "time_access" timestamptz(6),
  PRIMARY KEY ("file_storage_code")
);

-- Ensure storage_type is dropped if lm_file_storage previously had it
ALTER TABLE "public"."lm_file_storage" DROP COLUMN IF EXISTS "storage_type";

-- ----------------------------
-- 6. Table structure for lm_ai_usage
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_ai_usage" (
  "ai_usage_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "usage_date" date NOT NULL DEFAULT CURRENT_DATE,
  "total_token" int8 NOT NULL DEFAULT 0,
  "prompt_token" int8 NOT NULL DEFAULT 0,
  "completion_token" int8 NOT NULL DEFAULT 0,
  "total_request" int8 NOT NULL DEFAULT 0,
  "chat_token" int8 NOT NULL DEFAULT 0,
  "chat_request" int8 NOT NULL DEFAULT 0,
  "card_modify_token" int8 NOT NULL DEFAULT 0,
  "card_modify_request" int8 NOT NULL DEFAULT 0,
  "card_create_token" int8 NOT NULL DEFAULT 0,
  "card_create_request" int8 NOT NULL DEFAULT 0,
  "image_gen_count" int8 NOT NULL DEFAULT 0,
  "blocked_quota_count" int8 NOT NULL DEFAULT 0,
  "time_modify" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("ai_usage_uuid")
);

-- ----------------------------
-- 7. Table structure for lm_bandwidth_usage
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_bandwidth_usage" (
  "bandwidth_usage_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default",
  "master_code" varchar(50) COLLATE "pg_catalog"."default",
  "project_code" varchar(50) COLLATE "pg_catalog"."default",
  "user_account" varchar(190) COLLATE "pg_catalog"."default",

  "usage_date" date NOT NULL DEFAULT CURRENT_DATE,
  "auto_load_byte" int8 NOT NULL DEFAULT 0,
  "download_byte" int8 NOT NULL DEFAULT 0,
  "upload_byte" int8 NOT NULL DEFAULT 0,
  "cdn_cached_byte" int8 NOT NULL DEFAULT 0,
  "auto_load_count" int8 NOT NULL DEFAULT 0,
  "download_count" int8 NOT NULL DEFAULT 0,
  "blocked_hotlink_count" int8 NOT NULL DEFAULT 0,
  "time_modify" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("bandwidth_usage_uuid")
);

-- ----------------------------
-- 8. Table structure for lm_user_setting
--    (Combines user_setting, user_settings, and user_storage_limits)
-- ----------------------------
CREATE TABLE IF NOT EXISTS "public"."lm_user_setting" (
  "user_setting_uuid" uuid NOT NULL DEFAULT uuidv7(),
  "vendor_code" varchar(50) COLLATE "pg_catalog"."default" DEFAULT ''::character varying,
  "master_code" varchar(50) COLLATE "pg_catalog"."default" DEFAULT ''::character varying,
  "project_code" varchar(50) COLLATE "pg_catalog"."default" DEFAULT ''::character varying,
  "user_account" varchar(190) COLLATE "pg_catalog"."default" NOT NULL,
  "setting_type" varchar(50) COLLATE "pg_catalog"."default" NOT NULL DEFAULT 'user'::character varying,
  "setting_key" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "setting_value" text COLLATE "pg_catalog"."default" NOT NULL,
  "time_create" timestamptz(6) DEFAULT now(),
  "time_modify" timestamptz(6) DEFAULT now(),
  PRIMARY KEY ("user_setting_uuid")
);

-- Unique & performance indexes for upserts and spatial/temporal queries
CREATE UNIQUE INDEX IF NOT EXISTS "idx_lm_ai_usage_user_date"
  ON "public"."lm_ai_usage" ("user_account", "usage_date");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_lm_bandwidth_usage_user_date"
  ON "public"."lm_bandwidth_usage" ("user_account", "usage_date");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_lm_user_setting_unique_key"
  ON "public"."lm_user_setting" ("vendor_code", "master_code", "project_code", "user_account", "setting_type", "setting_key");

CREATE INDEX IF NOT EXISTS "idx_lm_board_uuid" ON "public"."lm_board" ("board_uuid");
CREATE INDEX IF NOT EXISTS "idx_lm_board_user_account" ON "public"."lm_board" ("user_account");
CREATE INDEX IF NOT EXISTS "idx_lm_board_time_modify" ON "public"."lm_board" ("time_modify");
CREATE INDEX IF NOT EXISTS "idx_lm_board_time_create" ON "public"."lm_board" ("time_create");

CREATE INDEX IF NOT EXISTS "idx_lm_board_card_board_code" ON "public"."lm_board_card" ("board_code");
CREATE INDEX IF NOT EXISTS "idx_lm_board_card_spatial" ON "public"."lm_board_card" ("board_code", "pos_x", "pos_y");
CREATE INDEX IF NOT EXISTS "idx_lm_board_card_bbox" ON "public"."lm_board_card" ("board_code", "pos_x", "pos_y", "width", "height");
CREATE INDEX IF NOT EXISTS "idx_lm_board_card_time_modify" ON "public"."lm_board_card" ("time_modify");

CREATE INDEX IF NOT EXISTS "idx_lm_board_activity_board_code" ON "public"."lm_board_activity" ("board_code", "time_create" DESC);
CREATE INDEX IF NOT EXISTS "idx_lm_card_comment_card_code" ON "public"."lm_card_comment" ("card_code");
CREATE INDEX IF NOT EXISTS "idx_lm_card_comment_board_code" ON "public"."lm_card_comment" ("board_code");

CREATE INDEX IF NOT EXISTS "idx_lm_file_storage_user" ON "public"."lm_file_storage" ("user_account");
CREATE INDEX IF NOT EXISTS "idx_lm_file_storage_board" ON "public"."lm_file_storage" ("board_code");
CREATE INDEX IF NOT EXISTS "idx_lm_file_storage_time" ON "public"."lm_file_storage" ("time_create" DESC);

CREATE INDEX IF NOT EXISTS "idx_lm_user_setting_acc_type" ON "public"."lm_user_setting" ("user_account", "setting_type");
CREATE INDEX IF NOT EXISTS "idx_lm_user_setting_key" ON "public"."lm_user_setting" ("setting_key");

-- ============================================================================
-- DATA MIGRATION FROM LEGACY TABLES TO NEW lm_* TABLES
-- ============================================================================
DO $$
BEGIN
  -- 1. Migrate legacy "boards" -> "lm_board"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'boards') THEN
    INSERT INTO "public"."lm_board" (
      "board_uuid",
      "board_code",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "board_name",
      "board_description",
      "board_viewport",
      "board_connection",
      "board_drawing",
      "board_setting",
      "time_modify",
      "time_create"
    )
    SELECT
      COALESCE(b.board_uuid, uuidv7()),
      b.board_code,
      b.vendor_code,
      b.master_code,
      b.project_code,
      b.user_account,
      COALESCE(b.board_name, 'Untitled Board'),
      COALESCE(b.board_description, ''),
      COALESCE(b.board_viewport, '{"panX": 0, "panY": 0, "zoom": 1}'::jsonb),
      COALESCE(b.board_conenctions, '[]'::jsonb),
      COALESCE(b.board_drawing, '[]'::jsonb),
      COALESCE(b.board_setting, '{}'::jsonb),
      COALESCE(b.time_modified, now()),
      COALESCE(b.time_created, now())
    FROM "public"."boards" b
    ON CONFLICT ("board_code") DO UPDATE SET
      "board_name" = EXCLUDED."board_name",
      "board_description" = EXCLUDED."board_description",
      "board_viewport" = EXCLUDED."board_viewport",
      "board_connection" = EXCLUDED."board_connection",
      "board_drawing" = EXCLUDED."board_drawing",
      "board_setting" = EXCLUDED."board_setting",
      "vendor_code" = COALESCE(EXCLUDED."vendor_code", "public"."lm_board"."vendor_code"),
      "master_code" = COALESCE(EXCLUDED."master_code", "public"."lm_board"."master_code"),
      "project_code" = COALESCE(EXCLUDED."project_code", "public"."lm_board"."project_code"),
      "user_account" = COALESCE(EXCLUDED."user_account", "public"."lm_board"."user_account"),
      "time_modify" = EXCLUDED."time_modify";
  END IF;

  -- 2. Migrate legacy "board_cards" -> "lm_board_card"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'board_cards') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'board_cards' AND column_name = 'user_account') THEN
      EXECUTE '
        INSERT INTO "public"."lm_board_card" (
          "card_uuid",
          "card_code",
          "board_code",
          "vendor_code",
          "master_code",
          "project_code",
          "user_account",
          "card_type",
          "card_name",
          "pos_x",
          "pos_y",
          "width",
          "height",
          "z_index",
          "is_locked",
          "card_data",
          "card_style",
          "card_raw",
          "card_encryption",
          "time_modify",
          "time_create"
        )
        SELECT
          CASE
            WHEN c.card_id::text ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN c.card_id::uuid
            ELSE uuidv7()
          END,
          c.card_id::text,
          c.board_code,
          c.vendor_code,
          c.master_code,
          c.project_code,
          c.user_account,
          COALESCE(c.card_type, ''note''),
          COALESCE(c.card_title, ''''),
          COALESCE(c.pos_x, 0),
          COALESCE(c.pos_y, 0),
          COALESCE(c.width, 280),
          COALESCE(c.height, 200),
          COALESCE(c.z_index, 1),
          COALESCE(c.is_locked, false),
          COALESCE(c.card_data, ''{}''::jsonb),
          COALESCE(c.card_style, ''{}''::jsonb),
          COALESCE(c.raw_card, ''{}''::jsonb),
          c.card_encryption,
          COALESCE(c.time_modified, now()),
          COALESCE(c.time_created, now())
        FROM "public"."board_cards" c
        ON CONFLICT ("card_code") DO UPDATE SET
          "board_code" = EXCLUDED."board_code",
          "card_type" = EXCLUDED."card_type",
          "card_name" = EXCLUDED."card_name",
          "pos_x" = EXCLUDED."pos_x",
          "pos_y" = EXCLUDED."pos_y",
          "width" = EXCLUDED."width",
          "height" = EXCLUDED."height",
          "z_index" = EXCLUDED."z_index",
          "is_locked" = EXCLUDED."is_locked",
          "card_data" = EXCLUDED."card_data",
          "card_style" = EXCLUDED."card_style",
          "card_raw" = EXCLUDED."card_raw",
          "card_encryption" = EXCLUDED."card_encryption",
          "time_modify" = EXCLUDED."time_modify"
      ';
    ELSE
      EXECUTE '
        INSERT INTO "public"."lm_board_card" (
          "card_uuid",
          "card_code",
          "board_code",
          "vendor_code",
          "master_code",
          "project_code",
          "card_type",
          "card_name",
          "pos_x",
          "pos_y",
          "width",
          "height",
          "z_index",
          "is_locked",
          "card_data",
          "card_style",
          "card_raw",
          "card_encryption",
          "time_modify",
          "time_create"
        )
        SELECT
          CASE
            WHEN c.card_id::text ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN c.card_id::uuid
            ELSE uuidv7()
          END,
          c.card_id::text,
          c.board_code,
          c.vendor_code,
          c.master_code,
          c.project_code,
          COALESCE(c.card_type, ''note''),
          COALESCE(c.card_title, ''''),
          COALESCE(c.pos_x, 0),
          COALESCE(c.pos_y, 0),
          COALESCE(c.width, 280),
          COALESCE(c.height, 200),
          COALESCE(c.z_index, 1),
          COALESCE(c.is_locked, false),
          COALESCE(c.card_data, ''{}''::jsonb),
          COALESCE(c.card_style, ''{}''::jsonb),
          COALESCE(c.raw_card, ''{}''::jsonb),
          c.card_encryption,
          COALESCE(c.time_modified, now()),
          COALESCE(c.time_created, now())
        FROM "public"."board_cards" c
        ON CONFLICT ("card_code") DO NOTHING
      ';
    END IF;
  END IF;

  -- 3. Migrate legacy "board_activities" -> "lm_board_activity"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'board_activities') THEN
    INSERT INTO "public"."lm_board_activity" (
      "board_activity_uuid",
      "board_code",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "user_name",
      "user_avatar",
      "user_color",
      "action_type",
      "card_code",
      "card_title",
      "card_detail",
      "time_create"
    )
    SELECT
      CASE
        WHEN a.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN a.id::uuid
        ELSE uuidv7()
      END,
      a.board_id,
      a.vendor_code,
      a.master_code,
      a.project_code,
      a.user_account,
      a.user_name,
      a.user_avatar,
      a.user_color,
      COALESCE(a.action_type, 'board_updated'),
      a.card_id,
      a.card_title,
      COALESCE(a.details, '{}'::jsonb) || jsonb_build_object('legacy_id', a.id, 'timestamp', a.timestamp),
      COALESCE(a.time_created, CASE WHEN a.timestamp IS NOT NULL AND a.timestamp > 0 THEN to_timestamp(a.timestamp / 1000.0) ELSE now() END)
    FROM "public"."board_activities" a
    WHERE NOT EXISTS (
      SELECT 1 FROM "public"."lm_board_activity" la
      WHERE la.board_code = a.board_id
        AND la.card_detail->>'legacy_id' = a.id
    )
    ON CONFLICT ("board_activity_uuid") DO NOTHING;
  END IF;

  -- 4. Migrate legacy "card_comments" -> "lm_card_comment"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'card_comments') THEN
    INSERT INTO "public"."lm_card_comment" (
      "card_comment_uuid",
      "card_comment_code",
      "card_comment_code_parent",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "card_code",
      "board_code",
      "card_comment_text",
      "card_comment_reaction",
      "time_create",
      "time_modify"
    )
    SELECT
      uuidv7(),
      cm.id,
      cm.parent_id,
      cm.vendor_code,
      cm.master_code,
      cm.project_code,
      cm.user_account,
      cm.card_id,
      cm.board_id,
      COALESCE(cm.text, ''),
      CASE
        WHEN jsonb_typeof(COALESCE(cm.reactions, '{}'::jsonb)) = 'object' THEN
          COALESCE(cm.reactions, '{}'::jsonb) || jsonb_build_object(
            'user_name', COALESCE(cm.user_name, 'Anonymous'),
            'user_avatar', COALESCE(cm.user_avatar, 'U'),
            'user_color', COALESCE(cm.user_color, '#2563eb')
          )
        ELSE
          jsonb_build_object(
            'items', COALESCE(cm.reactions, '[]'::jsonb),
            'user_name', COALESCE(cm.user_name, 'Anonymous'),
            'user_avatar', COALESCE(cm.user_avatar, 'U'),
            'user_color', COALESCE(cm.user_color, '#2563eb')
          )
      END,
      COALESCE(cm.time_created, CASE WHEN cm.created_at IS NOT NULL AND cm.created_at > 0 THEN to_timestamp(cm.created_at / 1000.0) ELSE now() END),
      CASE
        WHEN cm.updated_at IS NOT NULL AND cm.updated_at > 0 THEN to_timestamp(cm.updated_at / 1000.0)
        ELSE COALESCE(cm.time_created, now())
      END
    FROM "public"."card_comments" cm
    ON CONFLICT ("card_comment_code") DO UPDATE SET
      "card_comment_text" = EXCLUDED."card_comment_text",
      "card_comment_reaction" = EXCLUDED."card_comment_reaction",
      "time_modify" = EXCLUDED."time_modify";
  END IF;

  -- 5. Migrate legacy "uploaded_files" -> "lm_file_storage"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'uploaded_files') THEN
    INSERT INTO "public"."lm_file_storage" (
      "file_storage_uuid",
      "file_storage_code",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "file_name",
      "file_type",
      "file_size",
      "s3_key",
      "s3_bucket",
      "s3_endpoint",
      "view_url",
      "download_url",
      "board_code",
      "auto_load_count",
      "download_count",
      "auto_load_byte",
      "download_byte",
      "cdn_cached_byte",
      "blocked_hotlink_count",
      "time_create",
      "time_modify",
      "time_access"
    )
    SELECT
      uuidv7(),
      uf.file_id,
      uf.vendor_code,
      uf.master_code,
      uf.project_code,
      COALESCE(uf.owner_account, uf.uploader_account),
      uf.file_name,
      COALESCE(uf.file_type, 'application/octet-stream'),
      COALESCE(uf.file_size, 0),
      uf.s3_key,
      uf.s3_bucket,
      uf.s3_endpoint,
      uf.view_url,
      uf.download_url,
      uf.board_id,
      COALESCE(uf.auto_load_count, 0),
      COALESCE(uf.download_count, 0),
      COALESCE(uf.auto_load_bytes, 0),
      COALESCE(uf.download_bytes, 0),
      COALESCE(uf.cdn_cached_bytes, 0),
      COALESCE(uf.blocked_hotlink_count, 0),
      COALESCE(uf.time_created, now()),
      COALESCE(uf.time_modified, now()),
      uf.last_accessed
    FROM "public"."uploaded_files" uf
    ON CONFLICT ("file_storage_code") DO UPDATE SET
      "file_name" = EXCLUDED."file_name",
      "file_size" = EXCLUDED."file_size",
      "s3_key" = COALESCE(EXCLUDED."s3_key", "public"."lm_file_storage"."s3_key"),
      "auto_load_count" = GREATEST("public"."lm_file_storage"."auto_load_count", EXCLUDED."auto_load_count"),
      "download_count" = GREATEST("public"."lm_file_storage"."download_count", EXCLUDED."download_count"),
      "auto_load_byte" = GREATEST("public"."lm_file_storage"."auto_load_byte", EXCLUDED."auto_load_byte"),
      "download_byte" = GREATEST("public"."lm_file_storage"."download_byte", EXCLUDED."download_byte"),
      "cdn_cached_byte" = GREATEST("public"."lm_file_storage"."cdn_cached_byte", EXCLUDED."cdn_cached_byte"),
      "blocked_hotlink_count" = GREATEST("public"."lm_file_storage"."blocked_hotlink_count", EXCLUDED."blocked_hotlink_count"),
      "time_modify" = EXCLUDED."time_modify",
      "time_access" = COALESCE(EXCLUDED."time_access", "public"."lm_file_storage"."time_access");
  END IF;

  -- 6. Migrate legacy "user_ai_usage" -> "lm_ai_usage"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ai_usage') THEN
    INSERT INTO "public"."lm_ai_usage" (
      "ai_usage_uuid",
      "user_account",
      "usage_date",
      "total_token",
      "prompt_token",
      "completion_token",
      "total_request",
      "chat_token",
      "chat_request",
      "card_modify_token",
      "card_modify_request",
      "card_create_token",
      "card_create_request",
      "image_gen_count",
      "blocked_quota_count",
      "time_modify"
    )
    SELECT
      uuidv7(),
      ua.owner_account,
      ua.usage_date,
      COALESCE(ua.total_tokens, 0),
      COALESCE(ua.prompt_tokens, 0),
      COALESCE(ua.completion_tokens, 0),
      COALESCE(ua.total_requests, 0),
      COALESCE(ua.chat_tokens, 0),
      COALESCE(ua.chat_requests, 0),
      COALESCE(ua.card_modify_tokens, 0),
      COALESCE(ua.card_modify_requests, 0),
      COALESCE(ua.card_create_tokens, 0),
      COALESCE(ua.card_create_requests, 0),
      COALESCE(ua.image_gen_count, 0),
      COALESCE(ua.blocked_quota_count, 0),
      COALESCE(ua.time_modified, now())
    FROM "public"."user_ai_usage" ua
    ON CONFLICT ("user_account", "usage_date") DO UPDATE SET
      "total_token" = GREATEST("public"."lm_ai_usage"."total_token", EXCLUDED."total_token"),
      "prompt_token" = GREATEST("public"."lm_ai_usage"."prompt_token", EXCLUDED."prompt_token"),
      "completion_token" = GREATEST("public"."lm_ai_usage"."completion_token", EXCLUDED."completion_token"),
      "total_request" = GREATEST("public"."lm_ai_usage"."total_request", EXCLUDED."total_request"),
      "chat_token" = GREATEST("public"."lm_ai_usage"."chat_token", EXCLUDED."chat_token"),
      "chat_request" = GREATEST("public"."lm_ai_usage"."chat_request", EXCLUDED."chat_request"),
      "card_modify_token" = GREATEST("public"."lm_ai_usage"."card_modify_token", EXCLUDED."card_modify_token"),
      "card_modify_request" = GREATEST("public"."lm_ai_usage"."card_modify_request", EXCLUDED."card_modify_request"),
      "card_create_token" = GREATEST("public"."lm_ai_usage"."card_create_token", EXCLUDED."card_create_token"),
      "card_create_request" = GREATEST("public"."lm_ai_usage"."card_create_request", EXCLUDED."card_create_request"),
      "image_gen_count" = GREATEST("public"."lm_ai_usage"."image_gen_count", EXCLUDED."image_gen_count"),
      "blocked_quota_count" = GREATEST("public"."lm_ai_usage"."blocked_quota_count", EXCLUDED."blocked_quota_count"),
      "time_modify" = EXCLUDED."time_modify";
  END IF;

  -- 7. Migrate legacy "user_bandwidth_usage" -> "lm_bandwidth_usage"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_bandwidth_usage') THEN
    INSERT INTO "public"."lm_bandwidth_usage" (
      "bandwidth_usage_uuid",
      "user_account",
      "usage_date",
      "auto_load_byte",
      "download_byte",
      "upload_byte",
      "cdn_cached_byte",
      "auto_load_count",
      "download_count",
      "blocked_hotlink_count",
      "time_modify"
    )
    SELECT
      uuidv7(),
      ub.owner_account,
      ub.usage_date,
      COALESCE(ub.auto_load_bytes, 0),
      COALESCE(ub.download_bytes, 0),
      COALESCE(ub.upload_bytes, 0),
      COALESCE(ub.cdn_cached_bytes, 0),
      COALESCE(ub.auto_load_count, 0),
      COALESCE(ub.download_count, 0),
      COALESCE(ub.blocked_hotlink_count, 0),
      COALESCE(ub.time_modified, now())
    FROM "public"."user_bandwidth_usage" ub
    ON CONFLICT ("user_account", "usage_date") DO UPDATE SET
      "auto_load_byte" = GREATEST("public"."lm_bandwidth_usage"."auto_load_byte", EXCLUDED."auto_load_byte"),
      "download_byte" = GREATEST("public"."lm_bandwidth_usage"."download_byte", EXCLUDED."download_byte"),
      "upload_byte" = GREATEST("public"."lm_bandwidth_usage"."upload_byte", EXCLUDED."upload_byte"),
      "cdn_cached_byte" = GREATEST("public"."lm_bandwidth_usage"."cdn_cached_byte", EXCLUDED."cdn_cached_byte"),
      "auto_load_count" = GREATEST("public"."lm_bandwidth_usage"."auto_load_count", EXCLUDED."auto_load_count"),
      "download_count" = GREATEST("public"."lm_bandwidth_usage"."download_count", EXCLUDED."download_count"),
      "blocked_hotlink_count" = GREATEST("public"."lm_bandwidth_usage"."blocked_hotlink_count", EXCLUDED."blocked_hotlink_count"),
      "time_modify" = EXCLUDED."time_modify";
  END IF;

  -- 8a. Combine legacy "user_settings" -> "lm_user_setting"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings') THEN
    INSERT INTO "public"."lm_user_setting" (
      "user_setting_uuid",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "setting_type",
      "setting_key",
      "setting_value",
      "time_create",
      "time_modify"
    )
    SELECT
      uuidv7(),
      '',
      '',
      '',
      us.user_account,
      COALESCE(us.setting_type, 'user'),
      us.setting_key,
      us.setting_value,
      COALESCE(us.time_created, now()),
      COALESCE(us.time_modified, now())
    FROM "public"."user_settings" us
    ON CONFLICT ("vendor_code", "master_code", "project_code", "user_account", "setting_type", "setting_key") DO UPDATE SET
      "setting_value" = EXCLUDED."setting_value",
      "time_modify" = EXCLUDED."time_modify";
  END IF;

  -- 8b. Combine legacy "user_setting" -> "lm_user_setting"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_setting') THEN
    INSERT INTO "public"."lm_user_setting" (
      "user_setting_uuid",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "setting_type",
      "setting_key",
      "setting_value",
      "time_create",
      "time_modify"
    )
    SELECT
      COALESCE(u.user_setting_uuid, uuidv7()),
      COALESCE(u.vendor_code, ''),
      COALESCE(u.master_code, ''),
      COALESCE(u.project_code, ''),
      u.user_account,
      COALESCE(u.setting_type, 'user'),
      u.setting_key,
      u.setting_value,
      COALESCE(u.time_created, now()),
      COALESCE(u.time_modified, now())
    FROM "public"."user_setting" u
    ON CONFLICT ("vendor_code", "master_code", "project_code", "user_account", "setting_type", "setting_key") DO UPDATE SET
      "setting_value" = EXCLUDED."setting_value",
      "time_modify" = EXCLUDED."time_modify";
  END IF;

  -- 8c. Combine legacy "user_storage_limits" -> "lm_user_setting"
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_storage_limits') THEN
    INSERT INTO "public"."lm_user_setting" (
      "user_setting_uuid",
      "vendor_code",
      "master_code",
      "project_code",
      "user_account",
      "setting_type",
      "setting_key",
      "setting_value",
      "time_create",
      "time_modify"
    )
    SELECT
      uuidv7(),
      '',
      '',
      '',
      ul.user_account,
      'system',
      'storage_limit',
      CASE
        WHEN ul.storage_limit_bytes IS NOT NULL AND ul.storage_limit_bytes > 0 THEN ROUND(ul.storage_limit_bytes / 1048576.0)::text
        WHEN ul.custom_limit_gb IS NOT NULL AND ul.custom_limit_gb > 0 THEN ROUND(ul.custom_limit_gb * 1024.0)::text
        ELSE '5000'
      END,
      COALESCE(ul.time_modified, now()),
      COALESCE(ul.time_modified, now())
    FROM "public"."user_storage_limits" ul
    ON CONFLICT ("vendor_code", "master_code", "project_code", "user_account", "setting_type", "setting_key") DO NOTHING;
  END IF;

  -- 8d. Seed sample user AI usage limitation settings in "lm_user_setting" for "user007"
  --     (setting_type = 'system': readable by user, writable only by admin/system)
  INSERT INTO "public"."lm_user_setting" (
    "user_setting_uuid",
    "vendor_code",
    "master_code",
    "project_code",
    "user_account",
    "setting_type",
    "setting_key",
    "setting_value",
    "time_create",
    "time_modify"
  )
  VALUES
    (uuidv7(), 'lumen', 'mysuperid', 'mysuperid', 'user007', 'system', 'monthly_ai_token_limit', '1000000', now(), now()),
    (uuidv7(), 'lumen', 'mysuperid', 'mysuperid', 'user007', 'system', 'daily_ai_token_limit', '100000', now(), now()),
    (uuidv7(), 'lumen', 'mysuperid', 'mysuperid', 'user007', 'system', 'ai_burst_protection_enabled', 'true', now(), now())
  ON CONFLICT ("vendor_code", "master_code", "project_code", "user_account", "setting_type", "setting_key") DO NOTHING;

  -- 9. Drop legacy tables after data migration completes (guarded for managed DB role permissions)
  BEGIN
    DROP TABLE IF EXISTS "public"."board_cards" CASCADE;
    DROP TABLE IF EXISTS "public"."board_activities" CASCADE;
    DROP TABLE IF EXISTS "public"."card_comments" CASCADE;
    DROP TABLE IF EXISTS "public"."boards" CASCADE;
    DROP TABLE IF EXISTS "public"."uploaded_files" CASCADE;
    DROP TABLE IF EXISTS "public"."user_ai_usage" CASCADE;
    DROP TABLE IF EXISTS "public"."user_bandwidth_usage" CASCADE;
    DROP TABLE IF EXISTS "public"."user_storage_limits" CASCADE;
    DROP TABLE IF EXISTS "public"."user_settings" CASCADE;
    DROP TABLE IF EXISTS "public"."user_setting" CASCADE;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 10. Assign table ownership to dev_user if that role exists and current user has permission
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dev_user') THEN
      ALTER TABLE "public"."lm_board_activity" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_board_card" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_board" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_card_comment" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_file_storage" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_ai_usage" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_bandwidth_usage" OWNER TO "dev_user";
      ALTER TABLE "public"."lm_user_setting" OWNER TO "dev_user";
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Verify migrated lm_* tables
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'lm_board',
    'lm_board_card',
    'lm_board_activity',
    'lm_card_comment',
    'lm_file_storage',
    'lm_ai_usage',
    'lm_bandwidth_usage',
    'lm_user_setting'
  )
ORDER BY table_name, ordinal_position;
