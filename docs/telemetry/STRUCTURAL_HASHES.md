# Structural Hashes for Workflow Mutations

## Overview

As of version 2.22.17, workflow mutations now track **two types of hashes** for each workflow state (before and after):

1. **Full Hash** (`workflow_hash_before/after`): SHA-256 hash of the complete workflow JSON
   - Includes: nodes, connections, parameters, positions, IDs, names, etc.
   - Purpose: Precise change detection and deduplication

2. **Structural Hash** (`workflow_structure_hash_before/after`): SHA-256 hash of workflow structure only
   - Includes: Node types (sorted) and connection structure
   - Excludes: Parameters, positions, IDs, names
   - Purpose: Cross-referencing with `telemetry_workflows` table

## Why Both Hashes?

### Problem

Before this change, `workflow_mutations` and `telemetry_workflows` used different hashing algorithms:
- **Mutations**: Hashed full workflow JSON
- **Workflows**: Hashed only node types + connections

This meant **0% of mutations could be cross-referenced** with workflow quality data, blocking analytics like:
- "Did this mutation improve the workflow's validation score?"
- "What's the quality delta after this mutation?"
- "Which mutations work best on which complexity levels?"

### Solution

We now generate **both** hash types for mutations:
- **Full hash**: For mutation deduplication (existing behavior)
- **Structural hash**: For cross-referencing with workflow records (new capability)

## Database Schema

### New Columns (Added in Migration 20251114)

```sql
ALTER TABLE workflow_mutations
ADD COLUMN workflow_structure_hash_before TEXT,
ADD COLUMN workflow_structure_hash_after TEXT,
ADD COLUMN is_truly_successful BOOLEAN GENERATED ALWAYS AS (...) STORED;
```

### New Views

#### 1. `successful_mutations`
Filters only mutations where:
- Execution succeeded
- Validation improved OR no new errors introduced
- Intent classification is known

```sql
SELECT * FROM successful_mutations;
```

#### 2. `mutation_training_data`
Adds training labels for AI model training:
- `positive_example`: Truly successful mutations
- `execution_failure`: Mutation failed to execute
- `validation_failure`: Mutation worsened validation
- `intent_unknown`: Intent classification failed
- `partial_success`: Other cases

```sql
SELECT * FROM mutation_training_data
WHERE training_label = 'positive_example'
  AND example_quality = 'excellent';
```

#### 3. `mutations_with_workflow_quality`
Cross-references mutations with workflow quality scores:

```sql
SELECT
  user_intent,
  quality_before,
  quality_after,
  quality_delta,
  grade_before,
  grade_after
FROM mutations_with_workflow_quality
WHERE is_truly_successful = true
ORDER BY quality_delta DESC
LIMIT 10;
```

## Analytics Functions

### Success Rate by Intent

```sql
SELECT * FROM get_mutation_success_rate_by_intent();
```

Returns:
```
 intent_classification | total_mutations | successful_mutations | success_rate | avg_errors_resolved | avg_errors_introduced
-----------------------+-----------------+----------------------+--------------+---------------------+-----------------------
 cleanup               | 168             | 49                   | 29.17        | 0.87                | 0.42
 fix_validation        | 420             | 56                   | 13.33        | 1.23                | 2.15
 add_functionality     | 574             | 41                   | 7.14         | 0.45                | 2.31
 modify_configuration  | 164             | 10                   | 6.10         | 0.31                | 1.87
 rewire_logic          | 113             | 4                    | 3.54         | 0.18                | 1.92
 unknown               | 15              | 0                    | 0.00         | 0.00                | 1.20
```

### Cross-Reference Match Rate

```sql
SELECT * FROM get_mutation_crossref_stats();
```

Returns:
```
 total_mutations | before_matches | after_matches | both_matches | before_match_rate | after_match_rate
-----------------+----------------+---------------+--------------+-------------------+------------------
 1499            | 1023           | 1045          | 982          | 68.25             | 69.71
```

## Backfilling Existing Data

To populate structural hashes for existing mutations:

```bash
# Ensure environment variables are set
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run backfill script
npx tsx scripts/backfill-mutation-hashes.ts
```

### What the Backfill Does

1. Fetches all mutations where `workflow_structure_hash_before IS NULL`
2. For each mutation:
   - Parses `workflow_before` and `workflow_after` JSON
   - Generates structural hash using `WorkflowSanitizer.generateWorkflowHash()`
   - Updates database with new hashes
3. Reports progress every 100 mutations
4. Verifies cross-reference match rate at completion

### Expected Output

```
Starting backfill process...

Found 1499 mutations to backfill

Progress: 100/1499 (6.7%) | Success: 100 | Errors: 0 | Rate: 12.3/s | Elapsed: 8.1s
Progress: 200/1499 (13.3%) | Success: 200 | Errors: 0 | Rate: 11.8/s | Elapsed: 16.9s
...

================================================================================================
BACKFILL COMPLETE
================================================================================================
Total mutations processed: 1499
Successfully updated: 1499
Errors: 0
Duration: 121.4s
Average rate: 12.3 mutations/s

================================================================================================
VERIFYING CROSS-REFERENCE MATCHES
================================================================================================
Total mutations: 1499
Before matches: 1023 (68.25%)
After matches: 1045 (69.71%)
Both matches: 982

Backfill process completed successfully! ✓
```

## Code Implementation

### Hash Generation (mutation-tracker.ts)

```typescript
// Generate both types of hashes
const hashBefore = mutationValidator.hashWorkflow(workflowBefore);
const hashAfter = mutationValidator.hashWorkflow(workflowAfter);

// Generate structural hashes for cross-referencing
const structureHashBefore = WorkflowSanitizer.generateWorkflowHash(workflowBefore);
const structureHashAfter = WorkflowSanitizer.generateWorkflowHash(workflowAfter);

const record: WorkflowMutationRecord = {
  // ... other fields
  workflowHashBefore: hashBefore,
  workflowHashAfter: hashAfter,
  workflowStructureHashBefore: structureHashBefore,  // NEW
  workflowStructureHashAfter: structureHashAfter,    // NEW
};
```

### Auto-Snake-Case Conversion (batch-processor.ts)

The `toSnakeCase()` function automatically converts:
- `workflowStructureHashBefore` → `workflow_structure_hash_before`
- `workflowStructureHashAfter` → `workflow_structure_hash_after`
- `isTrulySuccessful` → `is_truly_successful`

No additional code needed!

## Use Cases

### 1. Track Quality Impact of Mutations

```sql
SELECT
  intent_classification,
  AVG(quality_delta) as avg_quality_improvement,
  COUNT(*) as mutations_count
FROM mutations_with_workflow_quality
WHERE is_truly_successful = true
  AND quality_before IS NOT NULL
  AND quality_after IS NOT NULL
GROUP BY intent_classification
ORDER BY avg_quality_improvement DESC;
```

### 2. Find Best Mutations for Training

```sql
SELECT
  user_intent,
  operations,
  errors_resolved,
  errors_introduced,
  quality_delta
FROM mutation_training_data
WHERE training_label = 'positive_example'
  AND example_quality = 'excellent'
  AND errors_resolved >= 3
ORDER BY quality_delta DESC
LIMIT 50;
```

### 3. Analyze Mutation Patterns by Complexity

```sql
SELECT
  tw.complexity,
  wm.intent_classification,
  COUNT(*) as total_mutations,
  COUNT(*) FILTER (WHERE wm.is_truly_successful) as successful_mutations,
  ROUND(
    COUNT(*) FILTER (WHERE wm.is_truly_successful)::NUMERIC /
    COUNT(*) * 100,
    2
  ) as success_rate
FROM workflow_mutations wm
JOIN telemetry_workflows tw
  ON wm.workflow_structure_hash_before = tw.workflow_hash
WHERE tw.complexity IS NOT NULL
GROUP BY tw.complexity, wm.intent_classification
ORDER BY tw.complexity, success_rate DESC;
```

## Migration History

| Version | Date | Changes |
|---------|------|---------|
| 2.22.17 | 2025-11-14 | Added structural hashes, success tracking, analytics views |

## Conceived By

Romuald Członkowski - [www.aiadvisors.pl/en](https://www.aiadvisors.pl/en)
