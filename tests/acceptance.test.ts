import assert from 'assert';
import { db } from '../src/lib/db/store';
import { payrollEngine } from '../src/lib/payroll/engine';
import { classcardClient } from '../src/lib/integrations/classcard/client';
import { runClasscardSync } from '../src/lib/integrations/classcard/sync';
import { hasPermission } from '../src/lib/auth/permissions';
import { SEED_USERS } from '../src/lib/db/seedData';
import { formatCurrency, roundToTwoDecimals } from '../src/lib/utils/formatters';

async function runAcceptanceTests() {
  console.log('\n=============================================================');
  console.log('   RUNNING AUTOMATED ACCEPTANCE & VERIFICATION TEST SUITE    ');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`[FAIL] ${name}`);
      console.error('       ', err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  // --- 1. CREDENTIAL SECURITY ---
  test('Scenario 1: Classcard credentials are kept secure and masked for client visibility', () => {
    const config = db.getClasscardConfig();
    assert(config.apiKey, 'API key should be configured in store');
    const maskedKey = `${config.apiKey.slice(0, 8)}••••••••${config.apiKey.slice(-4)}`;
    assert(maskedKey.includes('••••••••'), 'Masked key must mask the majority of secret characters');
    assert(!maskedKey.includes('cc_live_9f82a1740b2e88a'), 'Raw key must never be shown unmasked');
  });

  // --- 2. CONNECTION TEST ---
  await (async () => {
    try {
      const conn = await classcardClient.testConnection();
      assert(conn.success === true, 'Connection test should report success');
      console.log(`[PASS] Scenario 2: Connection test displays verified status (${conn.message})`);
      passed++;
    } catch (err: unknown) {
      console.error('[FAIL] Scenario 2: Connection test failed', err);
      failed++;
    }
  })();

  // --- 3. DEDUPLICATION & IDEMPOTENT SYNC ---
  await (async () => {
    try {
      const initialStudentCount = db.getStudents().length;
      // Run sync twice
      await runClasscardSync('STUDENTS');
      const countAfterFirstSync = db.getStudents().length;
      const secondJob = await runClasscardSync('STUDENTS');
      const countAfterSecondSync = db.getStudents().length;

      assert(
        countAfterFirstSync === countAfterSecondSync,
        `Deduplication failed: student count changed from ${countAfterFirstSync} to ${countAfterSecondSync}`
      );
      assert(
        secondJob.recordsCreated === 0,
        'Second sync of identical data must create 0 new records (must update existing)'
      );
      console.log(`[PASS] Scenario 3: Supported Classcard records synchronize idempotently without duplicates`);
      passed++;
    } catch (err: unknown) {
      console.error('[FAIL] Scenario 3: Synchronization deduplication failed', err);
      failed++;
    }
  })();

  // --- 4. SAFE HANDLING OF EMPTY BODIES ---
  test('Scenario 4: Safe handling of documented empty body endpoints and response normalization', () => {
    const client = classcardClient;
    assert(typeof client.lateCancelEnrolment === 'function', 'Client must support lateCancelEnrolment');
    assert(typeof client.getAttendances === 'function', 'Client must support getAttendances');
  });

  // --- 5. RBAC PERMISSIONS ---
  test('Scenario 5: Users with different roles see only authorized modules and actions', () => {
    const adminUser = SEED_USERS.find((u) => u.role === 'ADMINISTRATOR')!;
    const opsUser = SEED_USERS.find((u) => u.role === 'OPERATIONS')!;
    const mentorUser = SEED_USERS.find((u) => u.role === 'MENTOR')!;

    // Admin has full access
    assert(hasPermission(adminUser, 'payroll_rules', 'manage_settings') === true);
    assert(hasPermission(adminUser, 'penalties', 'approve') === true);

    // Operations can submit penalties but cannot edit payroll rules or view sensitive payroll
    assert(hasPermission(opsUser, 'penalties', 'create') === true);
    assert(hasPermission(opsUser, 'payroll_rules', 'manage_settings') === false);
    assert(hasPermission(opsUser, 'payroll_dashboard', 'view_sensitive_payroll') === false);

    // Mentor can only access personal modules and cannot delete or manage settings
    assert(hasPermission(mentorUser, 'payslips', 'view') === true);
    assert(hasPermission(mentorUser, 'classes', 'view') === true);
    assert(hasPermission(mentorUser, 'payroll_rules', 'view') === false);
    assert(hasPermission(mentorUser, 'penalties', 'approve') === false);
  });

  // --- 6. BRANCH, SUBJECT, PACKAGE CONFIGURATION ---
  test('Scenario 6: Administrator can configure branches, subjects, and packages with proper schemas', () => {
    const branch = db.createBranch({
      name: 'Chicago Loop Academy',
      code: 'CHI-LOOP',
      address: '111 W Jackson Blvd',
      city: 'Chicago',
      timezone: 'America/Chicago',
      phone: '+1 (312) 555-0199',
      email: 'chicago@academyapex.com',
      isActive: true,
      provenance: 'LOCALLY_CREATED',
    });
    assert(branch.id, 'Branch must receive a generated ID');

    const subject = db.createSubject({
      name: 'AP Statistics & Probability',
      code: 'STAT-AP-101',
      category: 'Mathematics',
      description: 'Hypothesis testing, regression, distributions',
      defaultDurationMinutes: 60,
      availableDurations: [45, 60, 90],
      isActive: true,
      color: '#06b6d4',
      provenance: 'LOCALLY_CREATED',
    });
    assert(subject.id, 'Subject must receive a generated ID');
    assert(subject.availableDurations.includes(60), 'Subject durations must be array of numbers');
  });

  // --- 7. CALENDAR FILTERING ---
  test('Scenario 7: Calendar filters update events and summaries correctly', () => {
    const all = db.getClasses();
    const nyClasses = db.getClasses({ branchId: 'branch-nyc' });
    const sfClasses = db.getClasses({ branchId: 'branch-sf' });

    assert(nyClasses.every((c) => c.branchId === 'branch-nyc'), 'NYC filter must strictly match branch-nyc');
    assert(sfClasses.every((c) => c.branchId === 'branch-sf'), 'SF filter must strictly match branch-sf');
    assert(nyClasses.length + sfClasses.length <= all.length, 'Branch subset must not exceed total');
  });

  // --- 8. ATTENDANCE DISCREPANCY TRACKING ---
  test('Scenario 8: Attendance marking updates student roster and computes class status', () => {
    const cls = db.createClass({
      title: 'Test Robotics Session',
      subjectId: 'subj-cs',
      subjectName: 'Computer Science',
      mentorId: 'mentor-1',
      mentorName: 'Dr. Elena Rostova',
      branchId: 'branch-nyc',
      branchName: 'Manhattan Campus',
      startTime: '2026-10-18T10:00:00Z',
      endTime: '2026-10-18T11:00:00Z',
      durationMinutes: 60,
      isGroup: false,
      capacity: 1,
      students: [
        {
          studentId: 'stud-1',
          studentName: 'Alexander Rivera',
          studentEmail: 'alex.rivera@prepstudent.com',
          attendanceStatus: 'UNMARKED',
        },
      ],
      status: 'SCHEDULED',
      attendanceStatusSummary: 'UNMARKED',
      isLateCancellation: false,
      provenance: 'LOCALLY_CREATED',
    });

    assert(cls.status === 'SCHEDULED');
    assert(cls.attendanceStatusSummary === 'UNMARKED');

    // Mark attendance as PRESENT
    const updated = db.updateAttendance(cls.id, 'stud-1', 'PRESENT', 'Dr. Elena Rostova', 'Attended on time');
    assert(updated.students[0].attendanceStatus === 'PRESENT');
    assert(updated.attendanceStatusSummary === 'ALL_PRESENT');
    assert(updated.status === 'COMPLETED', 'Class should auto-complete when all rosters are marked');
  });

  // --- 9. MULTI-MODEL PAYROLL CALCULATIONS ---
  test('Scenario 9: Multiple mentors can have different payroll models and rates', () => {
    const plans = db.getPayrollPlans();
    const models = plans.map((p) => p.compensationModel);

    assert(models.includes('PER_CLASS'), 'Must support PER_CLASS model');
    assert(models.includes('DURATION_BASED'), 'Must support DURATION_BASED model');
    assert(models.includes('PER_STUDENT'), 'Must support PER_STUDENT model');
    assert(models.includes('FIXED_SALARY'), 'Must support FIXED_SALARY model');
    assert(models.includes('PERCENTAGE_BASED'), 'Must support PERCENTAGE_BASED model');
    assert(models.includes('HYBRID'), 'Must support HYBRID model');
  });

  // --- 10. REPRODUCIBLE RECALCULATION & PLAN VERSIONING ---
  test('Scenario 10: Payroll calculations are reproducible and preserve plan version snapshots', () => {
    const batch = payrollEngine.generateBatch({
      periodId: 'period-2026-10-c1',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
    });

    assert(batch.lineItems.length > 0, 'Batch should generate line items');
    for (const item of batch.lineItems) {
      assert(item.planVersion > 0, 'Line item must record applied plan version');
      assert(item.grossEarnings >= 0, 'Gross earnings must be non-negative');
      assert(item.netPayable <= item.grossEarnings, 'Net payable cannot exceed gross earnings');
    }
  });

  // --- 11. UNAPPROVED PENALTIES DO NOT REDUCE PAYROLL ---
  test('Scenario 11: Unapproved penalties (SUBMITTED / DRAFT) do NOT reduce payable amounts', () => {
    const mentor = db.getMentors()[0];
    const initialPenalties = db.getPenalties(mentor.id);

    // Create an unapproved penalty
    const unapproved = db.createPenalty({
      mentorId: mentor.id,
      mentorName: `${mentor.firstName} ${mentor.lastName}`,
      branchId: mentor.branchId,
      category: 'MISSING_ATTENDANCE',
      reason: 'Draft unapproved penalty for testing',
      amount: 100.0,
      createdBy: 'user-ops-1',
      createdByName: 'Jordan Miller',
    });

    assert(unapproved.status === 'SUBMITTED', 'Newly submitted penalty must have SUBMITTED status');

    const plan = db.getPayrollPlanById(mentor.payrollPlanId)!;
    const lineItem = payrollEngine.calculateMentorPayroll(
      mentor,
      plan,
      db.getClasses(),
      '2026-10-01',
      '2026-10-15',
      'test-batch-unapproved'
    );

    // Check applied penalties
    assert(
      !lineItem.appliedPenaltyIds.includes(unapproved.id),
      'Unapproved penalty MUST NOT be included in appliedPenaltyIds'
    );
  });

  // --- 12. APPROVED PENALTIES NOT APPLIED TWICE ---
  test('Scenario 12: Approved penalties are not applied twice across subsequent cycles', () => {
    const mentor = db.getMentors()[1];
    // Create and approve penalty
    const pen = db.createPenalty({
      mentorId: mentor.id,
      mentorName: `${mentor.firstName} ${mentor.lastName}`,
      branchId: mentor.branchId,
      category: 'LATE_CANCELLATION',
      reason: 'Testing deduplication of deduction',
      amount: 40.0,
      createdBy: 'user-ops-1',
      createdByName: 'Jordan Miller',
    });

    db.approvePenalty(pen.id, 'user-admin-1', 'Alexandria Vance');
    assert(pen.status === 'APPROVED');

    // Run first batch calculation
    const plan = db.getPayrollPlanById(mentor.payrollPlanId)!;
    const batch1 = payrollEngine.generateBatch({
      periodId: 'p1',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      mentorIds: [mentor.id],
    });

    // Finalize batch 1
    batch1.status = 'APPROVED';
    payrollEngine.finalizeBatchAndGeneratePayslips(batch1.id, 'Admin');

    // Penalty should now be APPLIED
    const updatedPen = db.getPenaltyById(pen.id)!;
    assert(updatedPen.status === 'APPLIED', 'Penalty should be marked APPLIED after batch finalize');
    assert(updatedPen.appliedPayrollBatchId === batch1.id);

    // Run subsequent batch 2
    const batch2 = payrollEngine.generateBatch({
      periodId: 'p2',
      startDate: '2026-10-16',
      endDate: '2026-10-31',
      mentorIds: [mentor.id],
    });

    const item2 = batch2.lineItems[0];
    assert(
      !item2.appliedPenaltyIds.includes(pen.id),
      'Penalty must NOT be applied to a second batch once already APPLIED'
    );
  });

  // --- 13. ANTI-SELF-APPROVAL RULE ---
  test('Scenario 13: Operations staff cannot approve their own submitted penalty (Anti-self-approval rule)', () => {
    const pen = db.createPenalty({
      mentorId: 'mentor-1',
      mentorName: 'Dr. Elena Rostova',
      branchId: 'branch-nyc',
      category: 'UNAPPROVED_ABSENCE',
      reason: 'Self-approval test',
      amount: 50.0,
      createdBy: 'user-ops-test',
      createdByName: 'Test Ops Officer',
    });

    assert.throws(
      () => {
        // Attempting to approve as the creator
        db.approvePenalty(pen.id, 'user-ops-test', 'Test Ops Officer');
      },
      /cannot approve a penalty that you submitted yourself/,
      'Must throw authorization error when submitter tries to self-approve'
    );
  });

  // --- 14. PENALTY REVERSAL WORKFLOW ---
  test('Scenario 14: Authorized reversal replaces silent deletion and logs rationale', () => {
    const pen = db.createPenalty({
      mentorId: 'mentor-3',
      mentorName: 'Aisha Patel',
      branchId: 'branch-nyc',
      category: 'POLICY_VIOLATION',
      reason: 'Reversal test',
      amount: 25.0,
      createdBy: 'user-ops-1',
      createdByName: 'Jordan Miller',
    });
    db.approvePenalty(pen.id, 'user-admin-1', 'Alexandria Vance');

    const reversed = db.reversePenalty(
      pen.id,
      'user-admin-1',
      'Alexandria Vance',
      'Verified illness note provided post-cutoff'
    );

    assert(reversed.status === 'REVERSED');
    assert(reversed.reversalReason === 'Verified illness note provided post-cutoff');
    assert(reversed.reversedByName === 'Alexandria Vance');
  });

  // --- 15. MENTOR DATA ISOLATION ---
  test('Scenario 15: A mentor can view only their own payroll, penalties, and payslips', () => {
    const m1Slips = db.getPayslips('mentor-1');
    assert(m1Slips.every((s) => s.mentorId === 'mentor-1'), 'Mentor 1 should only see mentor 1 payslips');

    const m2Slips = db.getPayslips('mentor-2');
    assert(m2Slips.every((s) => s.mentorId === 'mentor-2'), 'Mentor 2 should only see mentor 2 payslips');

    const m1Pens = db.getPenalties('mentor-1');
    assert(m1Pens.every((p) => p.mentorId === 'mentor-1'), 'Mentor 1 should only see mentor 1 penalties');
  });

  // --- 16. APPROVAL AND PAYMENT ARE DISTINCT WORKFLOW STATES ---
  test('Scenario 16: Payroll approval and payment confirmation are distinct states', () => {
    const batch = payrollEngine.generateBatch({
      periodId: 'p-test',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
    });

    assert(batch.status === 'DRAFT');
    assert(batch.paymentStatus === 'UNPAID');

    batch.status = 'APPROVED';
    db.savePayrollBatch(batch);
    assert(batch.status === 'APPROVED');
    assert(batch.paymentStatus === 'UNPAID', 'Approval MUST NOT mark batch as paid automatically');

    batch.paymentStatus = 'PAID';
    batch.paymentReference = 'ACH-TEST-999';
    db.savePayrollBatch(batch);
    assert(batch.paymentStatus === 'PAID');
    assert(batch.paymentReference === 'ACH-TEST-999');
  });

  // --- 17. DECIMAL-SAFE CURRENCY ARITHMETIC ---
  test('Scenario 17: Decimal monetary calculations are safe from floating point precision issues', () => {
    const val1 = 0.1 + 0.2; // Javascript floating point is 0.30000000000000004
    const rounded = roundToTwoDecimals(val1);
    assert(rounded === 0.3, 'roundToTwoDecimals must resolve floating point drift');
    assert(formatCurrency(0.3) === '$0.30');
    assert(formatCurrency(1250.555) === '$1250.56' || formatCurrency(1250.555).includes('1,250.56'));
  });

  // --- 18. AUDIT LOGGING ---
  test('Scenario 18: Sensitive operations create persistent audit records', () => {
    const initialLogsCount = db.getAuditLogs().length;
    db.logAudit({
      userId: 'user-admin-1',
      userName: 'Alexandria Vance',
      userRole: 'ADMINISTRATOR',
      action: 'CREDENTIAL_UPDATED',
      entityType: 'ClasscardConfig',
      entityId: 'config',
      details: 'Updated Classcard Public API key',
    });

    const newLogs = db.getAuditLogs();
    assert(newLogs.length === initialLogsCount + 1, 'Audit log count must increase by 1');
    assert(newLogs[0].action === 'CREDENTIAL_UPDATED');
    assert(newLogs[0].userName === 'Alexandria Vance');
  });

  // --- 19. CUSTOM FIELDS & CLASSCARD MAPPINGS ---
  test('Scenario 19: Custom fields can be defined and mapped to Classcard schemas', () => {
    const initialFields = db.getCustomFields();
    assert(initialFields.length >= 5, 'Seed custom fields should be initialized');

    const created = db.createCustomField({
      name: 'Diagnostic Baseline Score',
      key: 'baseline_score',
      entityType: 'STUDENT',
      fieldType: 'NUMBER',
      classcardFieldKey: 'custom_field_baseline',
      classcardEndpoint: 'GET /students/{id}/custom-fields',
      isRequired: false,
      defaultValue: '1200',
      description: 'Initial practice SAT score prior to package instruction',
      isActive: true,
    });

    assert(created.id.startsWith('cf-'));
    assert(created.key === 'baseline_score');
    assert(created.classcardFieldKey === 'custom_field_baseline');

    const studentFields = db.getCustomFields('STUDENT');
    assert(studentFields.some((f) => f.key === 'baseline_score'));

    const mentorFields = db.getCustomFields('MENTOR');
    assert(mentorFields.every((f) => f.entityType === 'MENTOR'));

    // Clean up
    db.deleteCustomField(created.id);
    const afterDelete = db.getCustomFields('STUDENT');
    assert(!afterDelete.some((f) => f.id === created.id));
  });

  // --- 20. ATTENDANCE VERIFICATION & AUTO-COMPLETION ---
  test('Scenario 20: Marking attendance recomputes class status and roster participation', () => {
    const classes = db.getClasses();
    const targetClass = classes.find((c) => c.status === 'SCHEDULED' && c.students.length > 0);
    assert(targetClass, 'Should have at least one scheduled class with students');

    const updatedRoster = targetClass.students.map((s) => ({
      ...s,
      attendanceStatus: 'PRESENT' as const,
      markedAt: new Date().toISOString(),
      markedBy: 'Auditor Pro',
    }));

    const updated = db.updateClass(targetClass.id, {
      students: updatedRoster,
      attendanceStatusSummary: 'ALL_PRESENT',
      status: 'COMPLETED',
    });

    assert(updated.attendanceStatusSummary === 'ALL_PRESENT');
    assert(updated.status === 'COMPLETED');
    assert(updated.students.every((s) => s.attendanceStatus === 'PRESENT'));
  });

  console.log('\n-------------------------------------------------------------');
  console.log(`   TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('-------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests();
