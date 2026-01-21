-- Clear Test Data Script
-- This script removes all test data while preserving the schema
-- Run with: docker exec -i contract-precheck-db psql -U postgres -d contract_precheck < server/src/db/migrations/999_clear_test_data.sql

-- Start a transaction
BEGIN;

-- Display warning
DO $$
BEGIN
    RAISE NOTICE 'Clearing all test data from database...';
END $$;

-- Clear data in order of dependencies (child tables first)
-- 1. Clear report-related data
DELETE FROM audit_logs;
DELETE FROM reports;
DELETE FROM reviews;
DELETE FROM suggestions;

-- 2. Clear analysis results
DELETE FROM evidences;
DELETE FROM risks;
DELETE FROM rule_hits;
DELETE FROM clauses;

-- 3. Clear task-related data
DELETE FROM task_events;
DELETE FROM task_kb_snapshots;
DELETE FROM precheck_tasks;

-- 4. Clear knowledge base data
DELETE FROM kb_citations;
DELETE FROM kb_embeddings;
DELETE FROM kb_chunks;
DELETE FROM kb_documents;
DELETE FROM kb_collections;

-- 5. Clear contract data
DELETE FROM contract_versions;
DELETE FROM contracts;

-- 6. Clear config snapshots
DELETE FROM config_snapshots;

-- 7. Clear temporary data
DELETE FROM kb_hits_temp;

-- Confirm completion
DO $$
BEGIN
    RAISE NOTICE 'All test data has been cleared successfully!';
END $$;

-- Commit the transaction
COMMIT;

-- Display summary of remaining data
SELECT
    'contracts' as table_name, COUNT(*) as count FROM contracts
UNION ALL SELECT 'contract_versions', COUNT(*) FROM contract_versions
UNION ALL SELECT 'precheck_tasks', COUNT(*) FROM precheck_tasks
UNION ALL SELECT 'task_events', COUNT(*) FROM task_events
UNION ALL SELECT 'clauses', COUNT(*) FROM clauses
UNION ALL SELECT 'risks', COUNT(*) FROM risks
UNION ALL SELECT 'kb_collections', COUNT(*) FROM kb_collections
UNION ALL SELECT 'kb_documents', COUNT(*) FROM kb_documents
UNION ALL SELECT 'kb_chunks', COUNT(*) FROM kb_chunks
UNION ALL SELECT 'kb_embeddings', COUNT(*) FROM kb_embeddings;
