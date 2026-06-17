-- ─────────────────────────────────────────────────────────────────────────────
-- School Management System — Database Init Script
-- This is a REFERENCE script only. Prisma migrations handle actual schema.
-- Run with: psql $DATABASE_URL -f database/init.sql (for initial setup notes)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- For gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- For fuzzy text search (ILIKE optimization)
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- For exclusion constraints (timetable conflicts)

-- ─── Performance indexes (supplements Prisma-generated ones) ─────────────────

-- Full-text search on student names (used in search queries)
-- Note: Prisma migrations won't create these; apply them manually after migration

-- Composite index for attendance by class + date (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_class_date
    ON attendances (class_id, date DESC);

-- Index for student attendance lookups with status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student_status
    ON attendances (student_id, status, date DESC);

-- Partial index for active refresh tokens only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens (user_id, expires_at)
    WHERE revoked_at IS NULL;

-- Index for grade analytics (class + exam grouping)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grades_exam_student
    ON grades (exam_id, student_id);

-- Index for fee status reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fees_status_due
    ON fees (status, due_date)
    WHERE status IN ('PENDING', 'OVERDUE');

-- Index for unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id, created_at DESC)
    WHERE is_read = false;

-- Index for unread messages per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_recipients_unread
    ON message_recipients (user_id, created_at DESC)
    WHERE is_read = false AND deleted_at IS NULL;

-- Index for library overdue books
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_issues_overdue
    ON book_issues (due_date)
    WHERE returned_at IS NULL;

-- Trigram index for name searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm
    ON users USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- ─── Row Level Security (enable for Supabase deployments) ────────────────────
-- Note: Only needed if using Supabase RLS. Prisma bypasses RLS by default
-- using the service role key. These are examples only.

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

-- ─── Database maintenance functions ──────────────────────────────────────────

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updatedAt (Prisma @updatedAt handles this, but manual backup)
-- CREATE TRIGGER set_updated_at_users
--     BEFORE UPDATE ON users
--     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Views for reporting ──────────────────────────────────────────────────────

-- Student attendance summary view
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT
    s.id                                                                AS student_id,
    s.student_id                                                        AS student_code,
    u.first_name || ' ' || u.last_name                                  AS student_name,
    c.name                                                              AS class_name,
    COUNT(a.id)                                                         AS total_days,
    COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')                     AS present_days,
    COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')                      AS absent_days,
    COUNT(a.id) FILTER (WHERE a.status = 'LATE')                        AS late_days,
    COUNT(a.id) FILTER (WHERE a.status = 'EXCUSED')                     AS excused_days,
    ROUND(
        (COUNT(a.id) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::NUMERIC
         / NULLIF(COUNT(a.id), 0)) * 100, 2
    )                                                                   AS attendance_rate
FROM students s
JOIN users u ON u.id = s.user_id
LEFT JOIN classes c ON c.id = s.class_id
LEFT JOIN attendances a ON a.student_id = s.id
GROUP BY s.id, s.student_id, u.first_name, u.last_name, c.name;

-- Fee collection summary view
CREATE OR REPLACE VIEW fee_collection_summary AS
SELECT
    DATE_TRUNC('month', p.paid_at)  AS month,
    COUNT(DISTINCT p.id)            AS transaction_count,
    SUM(p.amount)                   AS total_collected,
    p.method                        AS payment_method
FROM payments p
WHERE p.paid_at IS NOT NULL
GROUP BY DATE_TRUNC('month', p.paid_at), p.method
ORDER BY month DESC;

-- Class grade averages view
CREATE OR REPLACE VIEW class_grade_averages AS
SELECT
    c.id                                    AS class_id,
    c.name                                  AS class_name,
    sub.name                                AS subject_name,
    e.name                                  AS exam_name,
    COUNT(g.id)                             AS student_count,
    ROUND(AVG(g.marks_obtained::NUMERIC / e.total_marks::NUMERIC * 100), 2) AS avg_percentage,
    MAX(g.marks_obtained::NUMERIC / e.total_marks::NUMERIC * 100)            AS highest_pct,
    MIN(g.marks_obtained::NUMERIC / e.total_marks::NUMERIC * 100)            AS lowest_pct,
    ROUND(
        COUNT(g.id) FILTER (WHERE g.marks_obtained >= e.passing_marks)::NUMERIC
        / NULLIF(COUNT(g.id), 0) * 100, 2
    )                                                                         AS pass_rate
FROM grades g
JOIN students s ON s.id = g.student_id
JOIN classes c ON c.id = s.class_id
JOIN exams e ON e.id = g.exam_id
JOIN subjects sub ON sub.id = g.subject_id
GROUP BY c.id, c.name, sub.name, e.name;

-- ─── Cleanup helper (for test environments) ───────────────────────────────────
-- WARNING: Only run in test/dev! Drops all data.
-- CALL truncate_all_tables();
CREATE OR REPLACE PROCEDURE truncate_all_tables()
LANGUAGE plpgsql AS $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
    END LOOP;
END;
$$;
