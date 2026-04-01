CREATE TABLE "CustomerTag" (
  "customerId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("customerId","value")
);

CREATE INDEX "CustomerTag_value_idx" ON "CustomerTag"("value");

ALTER TABLE "CustomerTag"
ADD CONSTRAINT "CustomerTag_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CustomerTag" ("customerId", "value")
SELECT c.id, LOWER(TRIM(tag))
FROM "Customer" c
CROSS JOIN LATERAL UNNEST(COALESCE(c.tags, ARRAY[]::TEXT[])) AS tag
WHERE TRIM(tag) <> '';

ALTER TABLE "Customer" DROP COLUMN "tags";
