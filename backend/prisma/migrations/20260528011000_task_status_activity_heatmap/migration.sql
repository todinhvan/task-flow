CREATE TABLE "task_status_activities" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_status_activities_taskId_createdAt_idx" ON "task_status_activities"("taskId", "createdAt");
CREATE INDEX "task_status_activities_actorId_createdAt_idx" ON "task_status_activities"("actorId", "createdAt");
CREATE INDEX "task_status_activities_createdAt_idx" ON "task_status_activities"("createdAt");

ALTER TABLE "task_status_activities"
ADD CONSTRAINT "task_status_activities_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "task_status_activities"
ADD CONSTRAINT "task_status_activities_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

INSERT INTO "task_status_activities" ("id", "taskId", "actorId", "fromStatus", "toStatus", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text || t."id"),
    t."id",
    t."assigneeId",
    NULL,
    t."status",
    COALESCE(t."completedAt", t."updatedAt", t."createdAt")
FROM "tasks" t
WHERE
    t."deletedAt" IS NULL
    AND t."source" = 'MANAGER_ASSIGNED'
    AND (
        t."status" <> 'TODO'
        OR t."completedAt" IS NOT NULL
        OR t."updatedAt" > t."createdAt"
    );
