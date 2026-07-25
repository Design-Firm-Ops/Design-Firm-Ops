-- Tenant isolation: firmId on every remaining tenant-owned model (DES-25).
--
-- DES-23 scoped 16 models. The other 13 had no firmId, so an auto-injecting
-- tenant client couldn't scope them and several routes queried them directly
-- by id with no tenant filter at all. Rather than teach the client a per-model
-- map of relation paths to follow (the thing that must never be wrong), every
-- tenant model now carries the column and the rule is uniform.
--
-- Two of these — ProjectFieldDef and ItemFieldDef — are not child tables at
-- all. They are top-level firm-wide custom field definitions with no parent,
-- which is how they were missed in DES-23: nothing about them looked like a
-- child. Until now every firm shared one set of them.
--
-- Each firmId is added nullable, backfilled from its parent, then set NOT NULL.
-- Idempotent: every step is guarded, so re-running is a no-op.

-- ---------------------------------------------------------------------------
-- 1. Add the columns (nullable for now)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'ClientContact', 'DesignFeeCharge', 'Document', 'ItemFieldDef', 'ItemFieldValue',
    'Lead', 'PipelineStage', 'ProcurementList', 'ProjectDocumentFolder',
    'ProjectFieldDef', 'ProjectFieldValue', 'ProjectRoom', 'UserPermissionOverride'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "firmId" TEXT', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill from each model's owning parent
-- ---------------------------------------------------------------------------

-- Single-parent cases.
UPDATE "ClientContact" c          SET "firmId" = p."firmId" FROM "Client"  p WHERE c."clientId"  = p."id" AND c."firmId" IS NULL;
UPDATE "DesignFeeCharge" c        SET "firmId" = p."firmId" FROM "Project" p WHERE c."projectId" = p."id" AND c."firmId" IS NULL;
UPDATE "ProcurementList" c        SET "firmId" = p."firmId" FROM "Project" p WHERE c."projectId" = p."id" AND c."firmId" IS NULL;
UPDATE "ProjectDocumentFolder" c  SET "firmId" = p."firmId" FROM "Project" p WHERE c."projectId" = p."id" AND c."firmId" IS NULL;
UPDATE "ProjectRoom" c            SET "firmId" = p."firmId" FROM "Project" p WHERE c."projectId" = p."id" AND c."firmId" IS NULL;
UPDATE "ProjectFieldValue" c      SET "firmId" = p."firmId" FROM "Project" p WHERE c."projectId" = p."id" AND c."firmId" IS NULL;
UPDATE "ItemFieldValue" c         SET "firmId" = p."firmId" FROM "Item"    p WHERE c."itemId"    = p."id" AND c."firmId" IS NULL;
UPDATE "UserPermissionOverride" c SET "firmId" = p."firmId" FROM "User"    p WHERE c."userId"    = p."id" AND c."firmId" IS NULL;
UPDATE "PipelineStage" c          SET "firmId" = p."firmId" FROM "LeadBoard" p WHERE c."boardId" = p."id" AND c."firmId" IS NULL;

-- Lead reaches its firm through two hops: pipelineStage -> board.
UPDATE "Lead" l
   SET "firmId" = b."firmId"
  FROM "PipelineStage" s
  JOIN "LeadBoard" b ON b."id" = s."boardId"
 WHERE l."pipelineStageId" = s."id" AND l."firmId" IS NULL;

-- Document hangs off any one of project / lead / item, all nullable — this is
-- exactly why a relation-path filter would have needed a three-way OR.
UPDATE "Document" d
   SET "firmId" = COALESCE(p."firmId", l."firmId", i."firmId")
  FROM "Document" d2
  LEFT JOIN "Project" p ON p."id" = d2."projectId"
  LEFT JOIN "Lead"    l ON l."id" = d2."leadId"
  LEFT JOIN "Item"    i ON i."id" = d2."itemId"
 WHERE d."id" = d2."id" AND d."firmId" IS NULL;

-- ProjectFieldDef and ItemFieldDef have no parent: they are firm-wide
-- definitions that, until now, every firm shared. There is therefore no way to
-- attribute them by inspection — being shared is exactly the bug. On the real
-- upgrade path the database has one firm (the DES-23 backfill created it), so
-- the oldest firm IS the right owner. If this ever ran against a genuinely
-- multi-firm database, these rows would need attributing by hand first.
UPDATE "ProjectFieldDef" SET "firmId" = (SELECT "id" FROM "Firm" ORDER BY "createdAt" ASC LIMIT 1) WHERE "firmId" IS NULL;
UPDATE "ItemFieldDef"    SET "firmId" = (SELECT "id" FROM "Firm" ORDER BY "createdAt" ASC LIMIT 1) WHERE "firmId" IS NULL;

-- Safety net: anything still unattached (an orphaned Document, say) goes to the
-- oldest firm rather than blocking the migration on a NOT NULL violation.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'ClientContact', 'DesignFeeCharge', 'Document', 'ItemFieldDef', 'ItemFieldValue',
    'Lead', 'PipelineStage', 'ProcurementList', 'ProjectDocumentFolder',
    'ProjectFieldDef', 'ProjectFieldValue', 'ProjectRoom', 'UserPermissionOverride'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'UPDATE %I SET "firmId" = (SELECT "id" FROM "Firm" ORDER BY "createdAt" ASC LIMIT 1) WHERE "firmId" IS NULL', t
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "firmId" SET NOT NULL', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Indexes and foreign keys
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'ClientContact', 'DesignFeeCharge', 'Document', 'ItemFieldDef', 'ItemFieldValue',
    'Lead', 'PipelineStage', 'ProcurementList', 'ProjectDocumentFolder',
    'ProjectFieldDef', 'ProjectFieldValue', 'ProjectRoom', 'UserPermissionOverride'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("firmId")', t || '_firmId_idx', t);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = t || '_firmId_fkey' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        t, t || '_firmId_fkey'
      );
    END IF;
  END LOOP;
END $$;
