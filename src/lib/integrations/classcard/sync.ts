import { db } from '../../db/store';
import { classcardClient } from './client';
import { SyncJob, SyncJobType } from '../../types/classcard';

export async function runClasscardSync(jobType: SyncJobType = 'ALL'): Promise<SyncJob> {
  const startTime = Date.now();
  const job: SyncJob = {
    id: `sync-${Date.now()}`,
    jobType,
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    logSummary: [`Starting Classcard ${jobType} synchronization...`],
  };

  try {
    // 1. Sync Students
    if (jobType === 'ALL' || jobType === 'STUDENTS') {
      const res = await classcardClient.getStudents();
      const rawData = res.data;
      const studentItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as any)?.data)
        ? (rawData as any).data
        : Array.isArray((rawData as any)?.students)
        ? (rawData as any).students
        : [];

      if (res.success && studentItems.length > 0) {
        job.logSummary.push(`Fetched ${studentItems.length} student records from Classcard Production API.`);
        for (const item of studentItems) {
          job.recordsProcessed++;
          const extId = String(item.id || '');
          const email = String(item.email || '').toLowerCase();

          // Deduplication: Look up by externalId first, then by email
          const existing = db.getStudents().find(
            (s) => (s.externalId && s.externalId === extId) || (s.email.toLowerCase() === email)
          );

          if (existing) {
            db.updateStudent(existing.id, {
              firstName: String(item.first_name || existing.firstName),
              lastName: String(item.last_name || existing.lastName),
              phone: String(item.phone || existing.phone),
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsUpdated++;
          } else {
            db.createStudent({
              firstName: String(item.first_name || 'Student'),
              lastName: String(item.last_name || 'Imported'),
              email: email || `student-${Date.now()}@imported.com`,
              phone: String(item.phone || ''),
              branchId: db.getBranches()[0]?.id || 'branch-nyc',
              enrolledPackageIds: [],
              status: 'ACTIVE',
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsCreated++;
          }
        }
      } else if (!res.success) {
        job.recordsFailed++;
        job.logSummary.push(`Warning: Failed fetching students: ${res.errorMessage}`);
      }
    }

    // 2. Sync Staff / Mentors
    if (jobType === 'ALL' || jobType === 'STAFF') {
      const res = await classcardClient.getStaffList();
      const rawData = res.data;
      const staffItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as any)?.data)
        ? (rawData as any).data
        : Array.isArray((rawData as any)?.staff)
        ? (rawData as any).staff
        : [];

      if (res.success && staffItems.length > 0) {
        job.logSummary.push(`Fetched ${staffItems.length} staff records from Classcard Production API.`);
        for (const item of staffItems) {
          job.recordsProcessed++;
          const extId = String(item.id || '');
          const email = String(item.email || '').toLowerCase();

          const existing = db.getMentors().find(
            (m) => (m.externalId && m.externalId === extId) || (m.email.toLowerCase() === email)
          );

          if (existing) {
            db.updateMentor(existing.id, {
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsUpdated++;
          } else {
            const names = String(item.name || `${item.first_name || 'Staff'} ${item.last_name || ''}`).trim().split(' ');
            db.createMentor({
              firstName: names[0] || 'Staff',
              lastName: names.slice(1).join(' ') || 'Member',
              email: email || `staff-${Date.now()}@imported.com`,
              phone: String(item.phone || ''),
              branchId: db.getBranches()[0]?.id || 'branch-nyc',
              subjectIds: [db.getSubjects()[0]?.id || 'subj-phys'],
              payrollPlanId: db.getPayrollPlans()[0]?.id || 'plan-hybrid-senior',
              status: 'ACTIVE',
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
              teachingHoursThisMonth: 0,
              completedClassesCount: 0,
              attendanceRate: 100,
            });
            job.recordsCreated++;
          }
        }
      }
    }

    // 3. Sync Events / Calendar
    if (jobType === 'ALL' || jobType === 'EVENTS') {
      const res = await classcardClient.getEvents();
      const rawData = res.data;
      const eventItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as any)?.data)
        ? (rawData as any).data
        : Array.isArray((rawData as any)?.events)
        ? (rawData as any).events
        : [];

      if (res.success && eventItems.length > 0) {
        job.logSummary.push(`Synchronized ${eventItems.length} scheduled class events from Classcard Production.`);
        for (const item of eventItems) {
          job.recordsProcessed++;
          const extId = String(item.id || '');
          const existing = db.getClasses().find((c) => c.externalId === extId);

          if (existing) {
            job.recordsUpdated++;
          } else if (extId) {
            // New event from Classcard
            const branch = db.getBranches()[0];
            const mentor = db.getMentors()[0];
            const subject = db.getSubjects()[0];
            const student = db.getStudents()[0];

            db.createClass({
              title: String(item.title || 'Classcard Scheduled Session'),
              subjectId: subject?.id || 'subj-phys',
              subjectName: subject?.name || 'AP Physics C',
              mentorId: mentor?.id || 'mentor-1',
              mentorName: `${mentor?.firstName} ${mentor?.lastName}`,
              branchId: branch?.id || 'branch-nyc',
              branchName: branch?.name || 'Manhattan Campus',
              startTime: String(item.start_time || new Date().toISOString()),
              endTime: String(item.end_time || new Date(Date.now() + 3600000).toISOString()),
              durationMinutes: Number(item.duration) || 60,
              isGroup: false,
              capacity: 1,
              students: student
                ? [
                    {
                      studentId: student.id,
                      studentName: `${student.firstName} ${student.lastName}`,
                      studentEmail: student.email,
                      attendanceStatus: 'UNMARKED',
                    },
                  ]
                : [],
              status: 'SCHEDULED',
              attendanceStatusSummary: 'UNMARKED',
              isLateCancellation: false,
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
              syncStatus: 'SYNCED',
            });
            job.recordsCreated++;
          }
        }
      }
    }

    job.status = job.recordsFailed > 0 ? 'PARTIAL' : 'COMPLETED';
    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - startTime;
    job.logSummary.push(
      `Sync finalized in ${(job.durationMs / 1000).toFixed(2)}s. Processed: ${job.recordsProcessed}, Created: ${job.recordsCreated}, Updated: ${job.recordsUpdated}, Failed: ${job.recordsFailed}.`
    );

    // Update config stats
    db.updateClasscardConfig({
      lastSuccessfulSync: new Date().toISOString(),
      lastErrorMessage: undefined,
    });

    db.addSyncJob(job);
    return job;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    job.status = 'FAILED';
    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - startTime;
    job.errorMessage = errorMsg;
    job.logSummary.push(`Fatal sync error: ${errorMsg}`);

    db.updateClasscardConfig({
      lastFailedSync: new Date().toISOString(),
      lastErrorMessage: errorMsg,
    });

    db.addSyncJob(job);
    return job;
  }
}
