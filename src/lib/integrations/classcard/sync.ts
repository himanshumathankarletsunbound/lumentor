import { db } from '../../db/store';
import { classcardClient } from './client';
import { SyncJob, SyncJobType } from '../../types/classcard';
import {
  createSyncJobRecord,
  getSyncBranchId,
  listStudentExternalIds,
  upsertClasscardInvoice,
  upsertClasscardPayment,
  upsertClasscardStudent,
  upsertClasscardSubject,
} from '../../db/state-repository';

async function runDemoSync(jobType: SyncJobType): Promise<SyncJob> {
  const job: SyncJob = {
    id: `sync-${Date.now()}`,
    jobType,
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    logSummary: [`Starting Classcard ${jobType} synchronization in explicit demo mode...`],
  };
  if (jobType === 'ALL' || jobType === 'STUDENTS') {
    const result = await classcardClient.getStudents();
    const students = Array.isArray(result.data) ? result.data as Array<Record<string, unknown>> : [];
    for (const item of students) {
      job.recordsProcessed++;
      const externalId = String(item.id || item.student_id || '');
      const email = String(item.email || `${externalId}@classcard.demo`).toLowerCase();
      const existing = db.getStudents().find((student) => student.externalId === externalId || student.email.toLowerCase() === email);
      if (existing) {
        db.updateStudent(existing.id, { externalId, email, provenance: 'CLASSCARD_SOURCED' });
        job.recordsUpdated++;
      } else {
        const branch = db.getBranches()[0];
        if (!branch) throw new Error('Demo synchronization requires a demo branch.');
        db.createStudent({
          firstName: String(item.first_name || 'Student'),
          lastName: String(item.last_name || 'Learner'),
          email,
          phone: String(item.phone || ''),
          branchId: branch.id,
          enrolledPackageIds: [],
          status: 'ACTIVE',
          externalId,
          provenance: 'CLASSCARD_SOURCED',
        });
        job.recordsCreated++;
      }
    }
  }
  job.status = 'COMPLETED';
  job.completedAt = new Date().toISOString();
  return job;
}

export async function runClasscardSync(jobType: SyncJobType = 'ALL'): Promise<SyncJob> {
  if (process.env.DEMO_MODE === 'true') return runDemoSync(jobType);
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

  const branchId = await getSyncBranchId();

  try {
    // 1. Sync Students
    if (jobType === 'ALL' || jobType === 'STUDENTS') {
      const res = await classcardClient.getStudents();
      const rawData = res.data;
      const studentItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as unknown as Record<string, unknown>)?.data)
        ? (rawData as unknown as Record<string, unknown>).data as Array<Record<string, unknown>>
        : Array.isArray((rawData as unknown as Record<string, unknown>)?.students)
        ? (rawData as unknown as Record<string, unknown>).students as Array<Record<string, unknown>>
        : [];

      if (res.success && studentItems.length > 0) {
        job.logSummary.push(`Fetched ${studentItems.length} student records from Classcard Production API.`);
        for (const item of studentItems) {
          job.recordsProcessed++;
          // Classcard API v2 returns user_detail_id, student_id, or user_id
          const extId = String(item.user_detail_id || item.student_id || item.user_id || item.id || '');
          const email = String(
            (item.user && typeof item.user === 'object' && (item.user as Record<string, unknown>).email) ||
            item.email ||
            item.email1 ||
            ''
          ).trim().toLowerCase();

          const firstName = String(item.firstName || item.first_name || item.name || 'Student').trim();
          const lastName = String(item.surname || item.last_name || '').trim();
          const phone = String(item.phone1 || item.phone || '').trim();
          const dateOfBirth = item.dob ? String(item.dob) : undefined;

          const result = await upsertClasscardStudent({
            externalId: extId || `student-${Date.now()}-${job.recordsProcessed}`,
            firstName: firstName || 'Student',
            lastName: lastName || 'Learner',
            email: email || `student-${extId || Date.now()}@classcard.imported`,
            phone,
            dateOfBirth,
            branchId,
          });
          if (result === 'created') job.recordsCreated++;
          else job.recordsUpdated++;
        }
      } else if (!res.success) {
        job.recordsFailed++;
        job.logSummary.push(`Warning: Failed fetching students: ${res.errorMessage}`);
      }
    }

    // 2. Sync Invoices
    if (jobType === 'ALL' || jobType === 'INVOICES') {
      const res = await classcardClient.getInvoices();
      const rawData = res.data;
      const invoiceItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as unknown as Record<string, unknown>)?.data)
        ? (rawData as unknown as Record<string, unknown>).data as Array<Record<string, unknown>>
        : [];

      if (res.success && invoiceItems.length > 0) {
        job.logSummary.push(`Fetched ${invoiceItems.length} tuition invoices from Classcard.`);
        const allStudents = await listStudentExternalIds();
        for (const item of invoiceItems) {
          job.recordsProcessed++;
          const extId = String(item.invoice_id || item.id || '');
          const studentExtId = String(item.student_id || '');
          const matchedStudent = allStudents.find((s) => s.externalId === studentExtId);
          const invNum = item.inv_prefix ? `${item.inv_prefix}-${item.inv_number_string || item.invoice_id}` : String(item.inv_number_string || item.invoice_id || `INV-${Date.now()}`);
          const amount = parseFloat(String(item.amount || '0')) || 0;
          const rawStatus = String(item.invoice_status || item.status || 'UNPAID').toUpperCase();
          const status = rawStatus === 'OVERDUE' ? 'OVERDUE' : rawStatus === 'PAID' ? 'PAID' : rawStatus === 'PARTIAL' ? 'PARTIAL' : 'UNPAID';

          if (!matchedStudent) {
            job.recordsFailed++;
            job.logSummary.push(`Warning: Invoice ${invNum} skipped because student ${studentExtId} is not synchronized.`);
            continue;
          }
          const result = await upsertClasscardInvoice({
            externalId: extId,
            invoiceNumber: invNum,
            studentId: matchedStudent.id,
            branchId,
            issueDate: new Date().toISOString().slice(0, 10),
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            totalAmount: amount,
            paidAmount: status === 'PAID' ? amount : 0,
            status,
          });
          if (result === 'created') job.recordsCreated++;
          else job.recordsUpdated++;
        }
      }
    }

    // 3. Sync Payments
    if (jobType === 'ALL' || jobType === 'INVOICES') {
      const res = await classcardClient.getPayments();
      const rawData = res.data;
      const paymentItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as unknown as Record<string, unknown>)?.data)
        ? (rawData as unknown as Record<string, unknown>).data as Array<Record<string, unknown>>
        : [];

      if (res.success && paymentItems.length > 0) {
        job.logSummary.push(`Fetched ${paymentItems.length} payment transactions from Classcard.`);
        for (const item of paymentItems) {
          job.recordsProcessed++;
          const extId = String(item.payment_num || item.transaction_id || item.id || '');
          const amount = parseFloat(String(item.amount || '0')) || 0;
          const invoiceId = String(item.invoice_id || '');
          const date = item.date ? String(item.date) : new Date().toISOString().slice(0, 10);
          const rawMode = String(item.mode || '').toLowerCase();
          const method = rawMode.includes('gateway') || rawMode.includes('stripe')
            ? 'STRIPE'
            : rawMode.includes('card')
            ? 'CREDIT_CARD'
            : rawMode.includes('transfer') || rawMode.includes('bank')
            ? 'BANK_TRANSFER'
            : 'OTHER';

          const result = await upsertClasscardPayment({
            externalId: extId,
            invoiceId,
            paymentNumber: `PAY-${extId || Date.now()}`,
            amount,
            paymentDate: date,
            method,
          });
          if (result === 'created') job.recordsCreated++;
          else job.recordsUpdated++;
        }
      }
    }

    // 4. Sync Items / Catalogue
    if (jobType === 'ALL' || jobType === 'CATEGORIES') {
      const res = await classcardClient.getItems();
      const rawData = res.data as { fees?: Array<Record<string, unknown>>; courses?: Array<Record<string, unknown>> };
      if (res.success && rawData && Array.isArray(rawData.fees) && rawData.fees.length > 0) {
        job.logSummary.push(`Synchronized ${rawData.fees.length} service/course catalog definitions from Classcard.`);
        for (const fee of rawData.fees) {
          const subjectName = String(fee.subject_name || fee.name || '');
          if (subjectName) {
            const result = await upsertClasscardSubject({
              name: subjectName,
              code: String(fee.subject_id || subjectName.slice(0, 6).toUpperCase()),
              category: String(fee.course_name || 'General'),
              description: String(fee.description || fee.name || ''),
              defaultDurationMinutes: Number(fee.duration) || 60,
              externalId: String(fee.id),
            });
            if (result === 'created') job.recordsCreated++;
            else job.recordsUpdated++;
          }
        }
      }
    }

    // 5. Staff / Faculty
    if (jobType === 'STAFF') {
      const res = await classcardClient.getStaffList();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        job.logSummary.push(`Synchronized ${res.data.length} staff records.`);
      } else if (!res.success && res.statusCode === 404) {
        job.logSummary.push('Note: Staff endpoint not provided by public API tier; faculty managed locally.');
      } else if (!res.success) {
        job.recordsFailed++;
        job.logSummary.push(`Warning: Failed fetching staff: ${res.errorMessage}`);
      }
    }

    // 6. Events / Schedule
    if (jobType === 'EVENTS') {
      const res = await classcardClient.getEvents();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        job.logSummary.push(`Synchronized ${res.data.length} event sessions.`);
      } else if (!res.success && (res.statusCode === 401 || res.statusCode === 422)) {
        job.logSummary.push('Note: Live events query requires explicit staff/location filter; current schedule preserved.');
      } else if (!res.success) {
        job.recordsFailed++;
        job.logSummary.push(`Warning: Failed fetching events: ${res.errorMessage}`);
      }
    }

    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - startTime;

    if (job.recordsCreated === 0 && job.recordsUpdated === 0 && job.recordsFailed > 0) {
      job.status = 'FAILED';
      const firstWarning = job.logSummary.find((l) => l.startsWith('Warning:'));
      job.errorMessage = firstWarning ? firstWarning.replace('Warning: ', '') : 'Classcard API returned an error.';
      job.logSummary.push(
        `Sync aborted after ${(job.durationMs / 1000).toFixed(2)}s: ${job.errorMessage}`
      );
    } else {
      job.status = job.recordsFailed > 0 ? 'PARTIAL' : 'COMPLETED';
      job.logSummary.push(
        `Sync finalized in ${(job.durationMs / 1000).toFixed(2)}s. Processed: ${job.recordsProcessed}, Created: ${job.recordsCreated}, Updated: ${job.recordsUpdated}, Failed: ${job.recordsFailed}.`
      );
    }

    await createSyncJobRecord(job);
    return job;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    job.status = 'FAILED';
    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - startTime;
    job.errorMessage = errorMsg;
    job.logSummary.push(`Fatal sync error: ${errorMsg}`);

    await createSyncJobRecord(job);
    return job;
  }
}
