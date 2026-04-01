-- Database optimization pass: indexes justified by actual query patterns
-- See docs/operations/db-optimization-notes.md for rationale

-- CustomerVisit: composite index for returning-customers report subquery.
-- The daily report runs: EXISTS (SELECT 1 FROM CustomerVisit cv2
--   WHERE cv2.customerId = cv.customerId AND cv2.branchId = cv.branchId
--   AND cv2.visitedAt < cv.visitedAt)
-- Current index (customerId) alone forces a filter scan on branchId + visitedAt.
-- This composite turns the EXISTS into an index-range scan.
CREATE INDEX "CustomerVisit_customerId_branchId_visitedAt_idx"
  ON "CustomerVisit"("customerId", "branchId", "visitedAt");
