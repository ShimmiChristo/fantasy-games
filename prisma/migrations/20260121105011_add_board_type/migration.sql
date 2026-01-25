-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SQUARES',
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "editableUntil" DATETIME,
    "maxSquaresPerEmail" INTEGER,
    CONSTRAINT "Board_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Board" ("createdAt", "createdByUserId", "editableUntil", "id", "isEditable", "maxSquaresPerEmail", "name", "updatedAt") SELECT "createdAt", "createdByUserId", "editableUntil", "id", "isEditable", "maxSquaresPerEmail", "name", "updatedAt" FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE INDEX "Board_createdByUserId_idx" ON "Board"("createdByUserId");
CREATE INDEX "Board_type_idx" ON "Board"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
