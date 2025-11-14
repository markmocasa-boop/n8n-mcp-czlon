-- Migration: Add Structural Hash Columns and Success Tracking
-- Date: 2025-11-14
-- Purpose: Enable cross-referencing workflow_mutations with telemetry_workflows
--          and add computed column for successful mutation tracking
--
-- Conceived by Romuald Członkowski - https://www.aiadvisors.pl/en

-- ============================================================================
-- Phase 1: Add Structural Hash Columns
-- ============================================================================
-- These columns store hashes compatible with telemetry_workflows.workflow_hash
-- allowing cross-reference queries to link mutations with workflow quality data

ALTER TABLE workflow_mutations
ADD COLUMN workflow_structure_hash_before TEXT,
ADD COLUMN workflow_structure_hash_after TEXT;

COMMENT ON COLUMN workflow_mutations.workflow_structure_hash_before IS
  'Structural hash (nodeTypes + connections) matching telemetry_workflows format - enables cross-referencing before state';

COMMENT ON COLUMN workflow_mutations.workflow_structure_hash_after IS
  'Structural hash (nodeTypes + connections) matching telemetry_workflows format - enables cross-referencing after state';

-- Add indexes for performance on cross-reference queries
CREATE INDEX IF NOT EXISTS idx_workflow_mutations_structure_hash_before
ON workflow_mutations(workflow_structure_hash_before);

CREATE INDEX IF NOT EXISTS idx_workflow_mutations_structure_hash_after
ON workflow_mutations(workflow_structure_hash_after);

-- ============================================================================
-- Phase 2: Add Success Tracking Computed Column
-- ============================================================================
-- Computed column that determines if a mutation was "truly successful"
-- Definition: Executes without errors AND improves/maintains validation AND has known intent

ALTER TABLE workflow_mutations
ADD COLUMN is_truly_successful BOOLEAN GENERATED ALWAYS AS (
  mutation_success = true
  AND (
    -- Either validation improved, or no new errors introduced
    validation_improved = true
    OR (
      COALESCE(errors_introduced, 0) = 0
      AND COALESCE(errors_resolved, 0) >= 0
    )
  )
  AND COALESCE(intent_classification, 'unknown') != 'unknown'
) STORED;

COMMENT ON COLUMN workflow_mutations.is_truly_successful IS
  'Computed: TRUE if mutation executed successfully, improved/maintained validation, and has classified intent';

-- Add index for filtering successful mutations
CREATE INDEX IF NOT EXISTS idx_workflow_mutations_success
ON workflow_mutations(is_truly_successful)
WHERE is_truly_successful = true;

-- ============================================================================
-- Phase 3: Create Analytics Views
-- ============================================================================

-- View 1: Successful Mutations Only
-- Use case: Analyze only mutations that successfully improved workflows
CREATE OR REPLACE VIEW successful_mutations AS
SELECT *
FROM workflow_mutations
WHERE is_truly_successful = true;

COMMENT ON VIEW successful_mutations IS
  'Filtered view of workflow_mutations containing only truly successful mutations (executed successfully, improved validation, known intent)';

-- View 2: Mutation Training Data
-- Use case: Create labeled dataset for AI model training
CREATE OR REPLACE VIEW mutation_training_data AS
SELECT
  *,
  CASE
    WHEN is_truly_successful THEN 'positive_example'
    WHEN mutation_success = false THEN 'execution_failure'
    WHEN COALESCE(validation_improved, false) = false THEN 'validation_failure'
    WHEN COALESCE(intent_classification, 'unknown') = 'unknown' THEN 'intent_unknown'
    ELSE 'partial_success'
  END as training_label,
  -- Add quality metrics for ranking examples
  CASE
    WHEN is_truly_successful AND COALESCE(errors_resolved, 0) >= 3 THEN 'excellent'
    WHEN is_truly_successful AND COALESCE(errors_resolved, 0) >= 1 THEN 'good'
    WHEN is_truly_successful THEN 'acceptable'
    ELSE 'poor'
  END as example_quality
FROM workflow_mutations;

COMMENT ON VIEW mutation_training_data IS
  'Workflow mutations with training labels (positive_example, execution_failure, validation_failure, etc.) for AI model training';

-- View 3: Mutations with Workflow Quality Data
-- Use case: Cross-reference mutations with workflow quality scores for impact analysis
CREATE OR REPLACE VIEW mutations_with_workflow_quality AS
SELECT
  wm.id,
  wm.user_id,
  wm.session_id,
  wm.user_intent,
  wm.intent_classification,
  wm.operation_count,
  wm.operation_types,

  -- Mutation metrics
  wm.nodes_added,
  wm.nodes_removed,
  wm.nodes_modified,
  wm.connections_added,
  wm.connections_removed,
  wm.errors_resolved,
  wm.errors_introduced,
  wm.validation_improved,
  wm.is_truly_successful,

  -- Before workflow quality
  tw_before.quality_score as quality_before,
  tw_before.grade as grade_before,
  tw_before.complexity as complexity_before,
  tw_before.node_count as nodes_before,

  -- After workflow quality
  tw_after.quality_score as quality_after,
  tw_after.grade as grade_after,
  tw_after.complexity as complexity_after,
  tw_after.node_count as nodes_after,

  -- Computed deltas
  (tw_after.quality_score - COALESCE(tw_before.quality_score, 0)) as quality_delta,
  (tw_after.node_count - COALESCE(tw_before.node_count, 0)) as node_count_delta,

  -- Timestamps
  wm.created_at,
  wm.duration_ms
FROM workflow_mutations wm
LEFT JOIN telemetry_workflows tw_before
  ON wm.workflow_structure_hash_before = tw_before.workflow_hash
LEFT JOIN telemetry_workflows tw_after
  ON wm.workflow_structure_hash_after = tw_after.workflow_hash;

COMMENT ON VIEW mutations_with_workflow_quality IS
  'Workflow mutations enriched with quality scores and grades from telemetry_workflows via structural hash cross-reference';

-- ============================================================================
-- Phase 4: Helper Functions for Analytics
-- ============================================================================

-- Function: Get mutation success rate by intent
CREATE OR REPLACE FUNCTION get_mutation_success_rate_by_intent()
RETURNS TABLE(
  intent_classification TEXT,
  total_mutations BIGINT,
  successful_mutations BIGINT,
  success_rate NUMERIC,
  avg_errors_resolved NUMERIC,
  avg_errors_introduced NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wm.intent_classification,
    COUNT(*) as total_mutations,
    COUNT(*) FILTER (WHERE wm.is_truly_successful) as successful_mutations,
    ROUND(
      COUNT(*) FILTER (WHERE wm.is_truly_successful)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) as success_rate,
    ROUND(AVG(COALESCE(wm.errors_resolved, 0)), 2) as avg_errors_resolved,
    ROUND(AVG(COALESCE(wm.errors_introduced, 0)), 2) as avg_errors_introduced
  FROM workflow_mutations wm
  GROUP BY wm.intent_classification
  ORDER BY success_rate DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_mutation_success_rate_by_intent() IS
  'Calculate success rates and error metrics grouped by intent classification';

-- Function: Get cross-reference match rate
CREATE OR REPLACE FUNCTION get_mutation_crossref_stats()
RETURNS TABLE(
  total_mutations BIGINT,
  before_matches BIGINT,
  after_matches BIGINT,
  both_matches BIGINT,
  before_match_rate NUMERIC,
  after_match_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_mutations,
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM telemetry_workflows tw
        WHERE tw.workflow_hash = wm.workflow_structure_hash_before
      )
    ) as before_matches,
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM telemetry_workflows tw
        WHERE tw.workflow_hash = wm.workflow_structure_hash_after
      )
    ) as after_matches,
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM telemetry_workflows tw
        WHERE tw.workflow_hash = wm.workflow_structure_hash_before
      )
      AND EXISTS (
        SELECT 1 FROM telemetry_workflows tw
        WHERE tw.workflow_hash = wm.workflow_structure_hash_after
      )
    ) as both_matches,
    ROUND(
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM telemetry_workflows tw
          WHERE tw.workflow_hash = wm.workflow_structure_hash_before
        )
      )::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) as before_match_rate,
    ROUND(
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM telemetry_workflows tw
          WHERE tw.workflow_hash = wm.workflow_structure_hash_after
        )
      )::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) as after_match_rate
  FROM workflow_mutations wm;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_mutation_crossref_stats() IS
  'Calculate how many mutations successfully cross-reference with telemetry_workflows via structural hashes';

-- ============================================================================
-- Verification Queries (Run after backfill)
-- ============================================================================

-- Check that new columns exist
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'workflow_mutations'
-- AND column_name IN ('workflow_structure_hash_before', 'workflow_structure_hash_after', 'is_truly_successful');

-- Check success tracking distribution
-- SELECT
--   is_truly_successful,
--   COUNT(*) as count,
--   ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage
-- FROM workflow_mutations
-- GROUP BY is_truly_successful;

-- Check cross-reference match rate (should improve after backfill)
-- SELECT * FROM get_mutation_crossref_stats();

-- Check success rate by intent
-- SELECT * FROM get_mutation_success_rate_by_intent();

-- ============================================================================
-- Rollback Script (if needed)
-- ============================================================================

-- DROP FUNCTION IF EXISTS get_mutation_crossref_stats();
-- DROP FUNCTION IF EXISTS get_mutation_success_rate_by_intent();
-- DROP VIEW IF EXISTS mutations_with_workflow_quality;
-- DROP VIEW IF EXISTS mutation_training_data;
-- DROP VIEW IF EXISTS successful_mutations;
-- DROP INDEX IF EXISTS idx_workflow_mutations_success;
-- DROP INDEX IF EXISTS idx_workflow_mutations_structure_hash_after;
-- DROP INDEX IF EXISTS idx_workflow_mutations_structure_hash_before;
-- ALTER TABLE workflow_mutations DROP COLUMN IF EXISTS is_truly_successful;
-- ALTER TABLE workflow_mutations DROP COLUMN IF EXISTS workflow_structure_hash_after;
-- ALTER TABLE workflow_mutations DROP COLUMN IF EXISTS workflow_structure_hash_before;
