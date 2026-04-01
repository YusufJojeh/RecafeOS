-- Permission: tenant rollup reports (owner/manager roles per tenant)
INSERT INTO "Permission" ("id", "code")
SELECT gen_random_uuid()::text, 'reports.tenant_rollups'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE code = 'reports.tenant_rollups');

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
INNER JOIN "Permission" p ON p.code = 'reports.tenant_rollups'
WHERE r."tenantId" IS NOT NULL
  AND r.name IN ('owner', 'manager')
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r.id
      AND rp."permissionId" = p.id
  );
