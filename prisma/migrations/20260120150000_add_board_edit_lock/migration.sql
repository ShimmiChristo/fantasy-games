-- Add edit-lock fields to Board
ALTER TABLE "Board" ADD COLUMN "isEditable" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "Board" ADD COLUMN "editableUntil" DATETIME;
