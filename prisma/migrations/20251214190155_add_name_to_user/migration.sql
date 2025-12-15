/*
  Warnings:

  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT;

-- Update existing users to have name "Bob"
UPDATE "User" SET "name" = 'Bob' WHERE "name" IS NULL;

-- Make the column NOT NULL
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
