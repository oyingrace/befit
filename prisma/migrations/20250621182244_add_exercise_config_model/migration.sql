-- AlterTable
ALTER TABLE "workout_exercise" ADD COLUMN     "exerciseConfigId" TEXT;

-- CreateTable
CREATE TABLE "exercise_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "exerciseType" TEXT NOT NULL,
    "primaryMuscles" TEXT[],
    "movementPattern" TEXT NOT NULL,
    "keyJoints" TEXT[],
    "movementDirection" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercise_config_name_key" ON "exercise_config"("name");

-- AddForeignKey
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_exerciseConfigId_fkey" FOREIGN KEY ("exerciseConfigId") REFERENCES "exercise_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
