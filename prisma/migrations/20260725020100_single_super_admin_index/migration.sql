-- SUPER_ADMIN platform-operator role (DES-24), part 2 of 2.
--
-- "There is exactly one SUPER_ADMIN" (plans/ADMIN_DASHBOARD.md §3.3) is a real
-- guarantee rather than a convention the seed happens to honour: this partial
-- unique index makes a second one impossible, so no future code path can mint
-- one by accident.
--
-- It lives in raw SQL because Prisma has no syntax for partial indexes.
-- Verified that `prisma migrate diff` does not report it as drift — Prisma
-- neither declares nor notices it.
--
-- Separate from the enum migration because the value must be committed before
-- it can be referenced; see part 1.
--
-- Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "User_single_super_admin"
  ON "User" ((role))
  WHERE role = 'SUPER_ADMIN';
