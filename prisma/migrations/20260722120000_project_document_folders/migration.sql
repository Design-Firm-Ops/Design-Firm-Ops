-- CreateTable
CREATE TABLE "ProjectDocumentFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDocumentFolder_projectId_idx" ON "ProjectDocumentFolder"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectDocumentFolder" ADD CONSTRAINT "ProjectDocumentFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the 5 default folders (previously a hardcoded constant, see
-- lib/procurement.ts DEFAULT_DOCUMENT_FOLDERS) for every existing project
-- so they become real, renamable rows instead of an inferred constant.
INSERT INTO "ProjectDocumentFolder" ("id", "projectId", "name", "order")
SELECT 'docfolder-' || p."id" || '-outside-design-documents', p."id", 'Outside Design Documents', 0 FROM "Project" p
UNION ALL
SELECT 'docfolder-' || p."id" || '-notes-and-markups', p."id", 'Notes and Markups', 1 FROM "Project" p
UNION ALL
SELECT 'docfolder-' || p."id" || '-precedent-images', p."id", 'Precedent Images', 2 FROM "Project" p
UNION ALL
SELECT 'docfolder-' || p."id" || '-presentations', p."id", 'Presentations', 3 FROM "Project" p
UNION ALL
SELECT 'docfolder-' || p."id" || '-drawings', p."id", 'Drawings', 4 FROM "Project" p;

-- Preserve any custom folder name already in use on a project's
-- documents (created via the old ad-hoc "+ New Folder" flow, which
-- only ever set Document.folder — there was no persisted folder list
-- before this migration) as its own real folder row.
INSERT INTO "ProjectDocumentFolder" ("id", "projectId", "name", "order")
SELECT
  'docfolder-' || md5(random()::text || clock_timestamp()::text || d."projectId" || d."folder"),
  d."projectId",
  d."folder",
  4 + ROW_NUMBER() OVER (PARTITION BY d."projectId" ORDER BY d."folder")
FROM (
  SELECT DISTINCT "projectId", "folder"
  FROM "Document"
  WHERE "projectId" IS NOT NULL
    AND "folder" IS NOT NULL
    AND "folder" NOT IN ('Outside Design Documents', 'Notes and Markups', 'Precedent Images', 'Presentations', 'Drawings')
) d;
