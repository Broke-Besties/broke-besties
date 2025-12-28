-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "role" "GroupRole" NOT NULL DEFAULT 'MEMBER';
