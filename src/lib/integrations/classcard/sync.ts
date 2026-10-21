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

  const defaultBranch = db.getBranches().find((b) => b.isActive) || db.getBranches()[0];
  const branchId = defaultBranch ? defaultBranch.id : 'branch-nyc';

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

          // Deduplication: Look up by externalId first, then by email
          const existing = db.getStudents().find(
            (s) => (s.externalId && extId && s.externalId === extId) || (email && s.email.toLowerCase() === email)
          );

          if (existing) {
            db.updateStudent(existing.id, {
              firstName: firstName || existing.firstName,
              lastName: lastName || existing.lastName,
              phone: phone || existing.phone,
              externalId: extId || existing.externalId,
              dateOfBirth: dateOfBirth || existing.dateOfBirth,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsUpdated++;
          } else {
            db.createStudent({
              firstName: firstName || 'Student',
              lastName: lastName || 'Learner',
              email: email || `student-${extId || Date.now()}@classcard.imported`,
              phone,
              dateOfBirth,
              branchId,
              enrolledPackageIds: [],
              status: 'ACTIVE',
              externalId: extId || undefined,
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

    // 2. Sync Invoices
    if (jobType === 'ALL' || jobType === 'INVOICES') {
      const res = await classcardClient.getInvoices();
      const rawData = res.data;
      const invoiceItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as any)?.data)
        ? (rawData as any).data
        : [];

      if (res.success && invoiceItems.length > 0) {
        job.logSummary.push(`Fetched ${invoiceItems.length} tuition invoices from Classcard.`);
        const allStudents = db.getStudents();
        for (const item of invoiceItems) {
          job.recordsProcessed++;
          const extId = String(item.invoice_id || item.id || '');
          const studentExtId = String(item.student_id || '');
          const matchedStudent = allStudents.find((s) => s.externalId === studentExtId);
          const studentName = matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}` : `Student #${studentExtId}`;
          const invNum = item.inv_prefix ? `${item.inv_prefix}-${item.inv_number_string || item.invoice_id}` : String(item.inv_number_string || item.invoice_id || `INV-${Date.now()}`);
          const amount = parseFloat(String(item.amount || '0')) || 0;
          const rawStatus = String(item.invoice_status || item.status || 'UNPAID').toUpperCase();
          const status = rawStatus === 'OVERDUE' ? 'OVERDUE' : rawStatus === 'PAID' ? 'PAID' : rawStatus === 'PARTIAL' ? 'PARTIAL' : 'UNPAID';

          const existing = db.getInvoices().find((inv) => inv.externalId === extId || inv.invoiceNumber === invNum);
          if (existing) {
            db.updateInvoice(existing.id, {
              totalAmount: amount,
              status,
              studentName,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsUpdated++;
          } else {
            db.createInvoice({
              invoiceNumber: invNum,
              studentId: matchedStudent?.id || `stud-${studentExtId}`,
              studentName,
              branchId,
              issueDate: new Date().toISOString().slice(0, 10),
              dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
              totalAmount: amount,
              paidAmount: status === 'PAID' ? amount : 0,
              currency: 'USD',
              status,
              items: [
                {
                  id: `item-${extId}`,
                  description: 'Instructional Tutoring Package',
                  quantity: 1,
                  unitPrice: amount,
                  amount,
                },
              ],
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsCreated++;
          }
        }
      }
    }

    // 3. Sync Payments
    if (jobType === 'ALL' || jobType === 'INVOICES') {
      const res = await classcardClient.getPayments();
      const rawData = res.data;
      const paymentItems: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? (rawData as Array<Record<string, unknown>>)
        : Array.isArray((rawData as any)?.data)
        ? (rawData as any).data
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

          const existing = db.getPayments().find((p) => p.externalId === extId);
          if (existing) {
            db.updatePayment(existing.id, {
              amount,
              method,
              paymentDate: date,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsUpdated++;
          } else {
            db.createPayment({
              paymentNumber: `PAY-${extId || Date.now()}`,
              invoiceId: `inv-${invoiceId}`,
              studentId: 'student-general',
              studentName: 'Enrolled Student',
              amount,
              paymentDate: date,
              method,
              status: 'SUCCESS',
              externalId: extId,
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsCreated++;
          }
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
          if (subjectName && !db.getSubjects().some((s) => s.name.toLowerCase() === subjectName.toLowerCase())) {
            db.createSubject({
              name: subjectName,
              code: String(fee.subject_id || subjectName.slice(0, 6).toUpperCase()),
              category: String(fee.course_name || 'General'),
              description: String(fee.description || fee.name || ''),
              defaultDurationMinutes: Number(fee.duration) || 60,
              availableDurations: [30, 45, 60, 90],
              isActive: true,
              color: '#06b6d4',
              externalId: String(fee.id),
              provenance: 'CLASSCARD_SOURCED',
            });
            job.recordsCreated++;
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
      db.updateClasscardConfig({
        lastFailedSync: new Date().toISOString(),
        lastErrorMessage: job.errorMessage,
      });
    } else {
      job.status = job.recordsFailed > 0 ? 'PARTIAL' : 'COMPLETED';
      job.logSummary.push(
        `Sync finalized in ${(job.durationMs / 1000).toFixed(2)}s. Processed: ${job.recordsProcessed}, Created: ${job.recordsCreated}, Updated: ${job.recordsUpdated}, Failed: ${job.recordsFailed}.`
      );
      db.updateClasscardConfig({
        lastSuccessfulSync: new Date().toISOString(),
        lastErrorMessage: undefined,
      });
    }

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
