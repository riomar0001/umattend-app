-- Makes students.student_id nullable and clears the placeholder 0s.
--
-- student_id is parsed out of the umindanao.edu.ph address at signup, but not
-- every address carries a number: `s.nolasco.576804@` does, `tan.jessiejames@`
-- does not. extractStudentID returned null for the second form and the caller
-- ran it through Number(), which turns null into 0 — so the column, declared
-- NOT NULL, was silently filled with 0.
--
-- That broke two things. The first such signup stored 0 and could never get a
-- QR code, because the attendance-token guard rejects a falsy student_id. Every
-- signup after it collided on students_student_id_key and failed the OAuth
-- callback outright, with no way to recover.
--
-- NULL is the honest representation of "this address did not carry an ID", and
-- SQLite treats NULLs as distinct in a unique index, so any number of accounts
-- can sit in that state at once. Onboarding collects the real number later.
--
-- SQLite cannot drop NOT NULL in place, hence the table rebuild. NULLIF folds
-- the backfill into the same copy. Verified before writing this: production
-- held exactly one student_id = 0 row and zero attendances referencing it, so
-- the rebuild orphans nothing.
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "student_id" INTEGER,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "program" TEXT,
    "profile_picture" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_students" ("created_at", "department", "id", "name", "profile_picture", "program", "student_id", "updated_at", "user_id")
SELECT "created_at", "department", "id", "name", "profile_picture", "program", NULLIF("student_id", 0), "updated_at", "user_id" FROM "students";

DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";

CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");
CREATE UNIQUE INDEX "students_student_id_key" ON "students"("student_id");
CREATE INDEX "students_department_idx" ON "students"("department");
CREATE INDEX "students_program_idx" ON "students"("program");
CREATE INDEX "students_student_id_idx" ON "students"("student_id");

PRAGMA defer_foreign_keys=OFF;
