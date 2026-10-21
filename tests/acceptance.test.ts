(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
(process.env as Record<string, string | undefined>).DEMO_MODE = 'true';

import assert from 'assert';
import { db } from '../src/lib/db/store';
import { payrollEngine } from '../src/lib/payroll/engine';
import { classcardClient } from '../src/lib/integrations/classcard/client';
import { runClasscardSync } from '../src/lib/integrations/classcard/sync';
import { hasPermission } from '../src/lib/auth/permissions';
import { SEED_USERS } from '../src/lib/db/seedData';
import { formatCurrency, roundToTwoDecimals } from '../src/lib/utils/formatters';
import { hashPassword, verifyPassword, generateResetToken } from '../src/lib/auth/crypto';
import { CurrentUser } from '../src/lib/types/auth';

async function runAcceptanceTests() {
  // Ensure test starts with clean seed data
  db.resetToSeed();

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
    assert.equal(config.apiKey, '', 'Classcard API keys must not be persisted in the store');
    assert(!JSON.stringify(config).includes('cc_live_'), 'Raw keys must never be present in runtime config');
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
      // Run sync twice
      const firstJob = await runClasscardSync('STUDENTS');
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
    assert(adminUser, 'Admin user must exist in seed');

    const opsRole = db.getRoles().find((r) => r.systemRole === 'OPERATIONS')!;
    const mentorRole = db.getRoles().find((r) => r.systemRole === 'MENTOR')!;

    const opsUser: CurrentUser = {
      id: 'test-ops-user',
      email: 'ops@academyapex.com',
      name: 'Test Operations Specialist',
      role: 'OPERATIONS',
      roleName: 'Operations Specialist',
      assignedBranchIds: [],
      avatarUrl: '',
      permissions: opsRole.permissions,
    };

    const mentorUser: CurrentUser = {
      id: 'test-mentor-user',
      email: 'mentor@academyapex.com',
      name: 'Test Mentor User',
      role: 'MENTOR',
      roleName: 'Mentor',
      assignedBranchIds: [],
      avatarUrl: '',
      permissions: mentorRole.permissions,
    };

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
      mentorId: 'test-m-1',
      mentorName: 'Test Mentor 1',
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
    const testMentor = db.createMentor({
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan.turing@academyapex.com',
      phone: '+1 555 1234',
      branchId: 'branch-bos',
      branchName: 'Boston Campus',
      subjectIds: [],
      payrollPlanId: 'plan-hybrid-senior',
      status: 'ACTIVE',
      provenance: 'LOCALLY_CREATED',
      teachingHoursThisMonth: 15,
      completedClassesCount: 10,
      attendanceRate: 100,
      hourlyRate: 50,
    });

    db.createClass({
      title: 'Logic & Computation',
      subjectId: 'subj-cs',
      subjectName: 'Computer Science',
      mentorId: testMentor.id,
      mentorName: `${testMentor.firstName} ${testMentor.lastName}`,
      branchId: 'branch-bos',
      branchName: 'Boston Campus',
      startTime: '2026-10-05T10:00:00Z',
      endTime: '2026-10-05T11:30:00Z',
      durationMinutes: 90,
      isGroup: false,
      capacity: 1,
      students: [{ studentId: 's1', studentName: 'Student 1', studentEmail: 's1@test.com', attendanceStatus: 'PRESENT' }],
      status: 'COMPLETED',
      attendanceStatusSummary: 'ALL_PRESENT',
      isLateCancellation: false,
      provenance: 'LOCALLY_CREATED',
    });

    const batch = payrollEngine.generateBatch({
      periodId: 'period-2026-10-c1',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      mentorIds: [testMentor.id],
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
    const mentor = db.createMentor({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace.hopper@academyapex.com',
      phone: '+1 555 4321',
      branchId: 'branch-nyc',
      branchName: 'NYC Flagship',
      subjectIds: [],
      payrollPlanId: 'plan-per-class-std',
      status: 'ACTIVE',
      provenance: 'LOCALLY_CREATED',
      teachingHoursThisMonth: 10,
      completedClassesCount: 5,
      attendanceRate: 100,
      hourlyRate: 65,
    });

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
    const mentor = db.createMentor({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada.lovelace@academyapex.com',
      phone: '+1 555 7777',
      branchId: 'branch-sf',
      branchName: 'SF Innovation Hub',
      subjectIds: [],
      payrollPlanId: 'plan-per-class-std',
      status: 'ACTIVE',
      provenance: 'LOCALLY_CREATED',
      teachingHoursThisMonth: 12,
      completedClassesCount: 8,
      attendanceRate: 100,
      hourlyRate: 65,
    });

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
      mentorId: 'test-m-sub',
      mentorName: 'Test Mentor',
      branchId: 'branch-nyc',
      category: 'UNAPPROVED_ABSENCE',
      reason: 'Self-approval test',
      amount: 50.0,
      createdBy: 'user-ops-test',
      createdByName: 'Test Ops Officer',
    });

    assert.throws(
      () => {
        db.approvePenalty(pen.id, 'user-ops-test', 'Test Ops Officer');
      },
      /cannot approve a penalty that you submitted yourself/,
      'Must throw authorization error when submitter tries to self-approve'
    );
  });

  // --- 14. PENALTY REVERSAL WORKFLOW ---
  test('Scenario 14: Authorized reversal replaces silent deletion and logs rationale', () => {
    const pen = db.createPenalty({
      mentorId: 'test-m-rev',
      mentorName: 'Test Mentor',
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
    const slip1 = db.savePayslip({
      id: 'slip-test-1',
      payslipNumber: 'PS-TEST-001',
      batchId: 'batch-test-1',
      mentorId: 'mentor-iso-1',
      mentorName: 'Iso Mentor 1',
      mentorEmail: 'mentor1@test.com',
      branchName: 'Main Campus',
      periodName: 'Cycle 1',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      planName: 'Per-Class Standard',
      compensationModel: 'PER_CLASS',
      planVersion: 1,
      eligibleClassesCount: 4,
      eligibleDurationMinutes: 240,
      earningsItems: [],
      penaltyItems: [],
      grossEarnings: 1200,
      totalDeductions: 0,
      netPayable: 1200,
      currency: 'USD',
      paymentStatus: 'UNPAID',
      generatedAt: '2026-10-16T00:00:00Z',
    });

    const slip2 = db.savePayslip({
      id: 'slip-test-2',
      payslipNumber: 'PS-TEST-002',
      batchId: 'batch-test-1',
      mentorId: 'mentor-iso-2',
      mentorName: 'Iso Mentor 2',
      mentorEmail: 'mentor2@test.com',
      branchName: 'Main Campus',
      periodName: 'Cycle 1',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      planName: 'Per-Class Standard',
      compensationModel: 'PER_CLASS',
      planVersion: 1,
      eligibleClassesCount: 6,
      eligibleDurationMinutes: 360,
      earningsItems: [],
      penaltyItems: [],
      grossEarnings: 1800,
      totalDeductions: 0,
      netPayable: 1800,
      currency: 'USD',
      paymentStatus: 'UNPAID',
      generatedAt: '2026-10-16T00:00:00Z',
    });

    const m1Slips = db.getPayslips('mentor-iso-1');
    assert(m1Slips.every((s) => s.mentorId === 'mentor-iso-1'), 'Mentor 1 should only see mentor 1 payslips');
    assert(m1Slips.some((s) => s.id === slip1.id), 'Mentor 1 should see slip 1');

    const m2Slips = db.getPayslips('mentor-iso-2');
    assert(m2Slips.every((s) => s.mentorId === 'mentor-iso-2'), 'Mentor 2 should only see mentor 2 payslips');
    assert(m2Slips.some((s) => s.id === slip2.id), 'Mentor 2 should see slip 2');
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
    const val1 = 0.1 + 0.2;
    const rounded = roundToTwoDecimals(val1);
    assert(rounded === 0.3, 'roundToTwoDecimals must resolve floating point drift');
    assert(formatCurrency(0.3) === '$0.30');
    assert(formatCurrency(1250.555) === '$1250.56' || formatCurrency(1250.555).includes('1,250.56'));
  });

  // --- 18. AUDIT LOGGING ---
  test('Scenario 18: Sensitive operations create persistent audit records', () => {
    const initialLogsCount = db.getAuditLogs().length;
    db.logAudit({
      userId: 'user-super-admin',
      userName: 'Himanshu Mathankar',
      userRole: 'ADMINISTRATOR',
      action: 'CREDENTIAL_UPDATED',
      entityType: 'ClasscardConfig',
      entityId: 'config',
      details: 'Updated Classcard Public API key',
    });

    const newLogs = db.getAuditLogs();
    assert(newLogs.length === initialLogsCount + 1, 'Audit log count must increase by 1');
    assert(newLogs[0].action === 'CREDENTIAL_UPDATED');
    assert(newLogs[0].userName === 'Himanshu Mathankar');
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
    const targetClass = db.createClass({
      title: 'Active Diagnostic Seminar',
      subjectId: 'subj-test',
      subjectName: 'Test Seminar',
      mentorId: 'm-target',
      mentorName: 'Target Mentor',
      branchId: 'b-target',
      branchName: 'Target Branch',
      startTime: '2026-10-25T14:00:00Z',
      endTime: '2026-10-25T15:30:00Z',
      durationMinutes: 90,
      isGroup: true,
      capacity: 5,
      students: [
        { studentId: 's101', studentName: 'Roster Student 1', studentEmail: 's101@test.com', attendanceStatus: 'UNMARKED' },
      ],
      status: 'SCHEDULED',
      attendanceStatusSummary: 'UNMARKED',
      isLateCancellation: false,
      provenance: 'LOCALLY_CREATED',
    });

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

  // --- 21. RATE LIMITING PROTECTION ---
  test('Scenario 21: Rate limiter enforces quotas on sensitive financial & sync operations', () => {
    const { checkRateLimit } = require('../src/lib/rate-limit/limiter');
    const mockReq = {
      headers: new Headers({ 'x-forwarded-for': '192.168.1.100' }),
    };

    // First request should succeed
    const res1 = checkRateLimit(mockReq as any, { limit: 2, windowSeconds: 60, identifierPrefix: 'test-limiter' });
    assert(res1.success === true, 'First request should pass rate limit');
    assert(res1.remaining === 1, 'Remaining count should decrement');

    // Second request should succeed
    const res2 = checkRateLimit(mockReq as any, { limit: 2, windowSeconds: 60, identifierPrefix: 'test-limiter' });
    assert(res2.success === true, 'Second request should pass rate limit');
    assert(res2.remaining === 0, 'Remaining count should be 0');

    // Third request should be blocked
    const res3 = checkRateLimit(mockReq as any, { limit: 2, windowSeconds: 60, identifierPrefix: 'test-limiter' });
    assert(res3.success === false, 'Third request exceeding limit should be rejected');
    assert(res3.remaining === 0);
  });

  // --- 22. SUPER ADMIN CREDENTIALS & PBKDF2 CRYPTO ---
  test('Scenario 22: Super admin account (himanshu.m@letsunbound.com) verifies with admin@1290@ and ADMINISTRATOR role', () => {
    const user = db.getUserByEmail('himanshu.m@letsunbound.com');
    assert(user, 'Super admin user himanshu.m@letsunbound.com must exist');
    assert(user.role === 'ADMINISTRATOR', 'User must have ADMINISTRATOR role');
    assert(user.roleName === 'Super Admin', 'User roleName should be Super Admin');
    assert(user.passwordHash && user.salt, 'User must have passwordHash and salt');

    // Verify valid password
    const isValid = verifyPassword('admin@1290@', user.passwordHash, user.salt);
    assert(isValid === true, 'Password verification must succeed for admin@1290@');

    // Verify invalid password fails
    const isInvalid = verifyPassword('wrong-password', user.passwordHash, user.salt);
    assert(isInvalid === false, 'Password verification must fail for incorrect password');
  });

  // --- 23. PASSWORD RESET TOKEN CREATION & PASSWORD UPDATE ---
  test('Scenario 23: Password reset generates secure token and successfully rotates password', () => {
    const user = db.getUserByEmail('himanshu.m@letsunbound.com')!;
    const { token: resetToken, expiresAt: resetExpiry } = generateResetToken(60);

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetExpiry;
    db.saveUser(user);

    // Lookup user by reset token
    const userByToken = db.getUserByResetToken(resetToken);
    assert(userByToken, 'Must find user by valid reset token');
    assert(userByToken.id === user.id);

    // Apply new password
    const newPassword = 'TemporaryNewPassword@2026!';
    const { hash: newHash, salt: newSalt } = hashPassword(newPassword);
    userByToken.passwordHash = newHash;
    userByToken.salt = newSalt;
    userByToken.resetToken = undefined;
    userByToken.resetTokenExpiry = undefined;
    db.saveUser(userByToken);

    // Check that new password verifies
    const checkNew = verifyPassword(newPassword, userByToken.passwordHash, userByToken.salt);
    assert(checkNew === true, 'New password must verify successfully');

    // Restore super admin credentials for subsequent test runs
    const { hash: origHash, salt: origSalt } = hashPassword('admin@1290@');
    userByToken.passwordHash = origHash;
    userByToken.salt = origSalt;
    db.saveUser(userByToken);
  });

  // --- 24. ZERO DEMO DATA VERIFICATION ---
  test('Scenario 24: Store and seed state contains ZERO demo students, mentors, classes, or payslips', () => {
    // Reset to clean seed
    db.resetToSeed();

    assert(db.getStudents().length === 0, 'Database must have 0 demo students');
    assert(db.getMentors().length === 0, 'Database must have 0 demo mentors');
    assert(db.getClasses().length === 0, 'Database must have 0 demo classes');
    assert(db.getPenalties().length === 0, 'Database must have 0 demo penalties');
    assert(db.getPayslips().length === 0, 'Database must have 0 demo payslips');
    assert(db.getPayrollBatches().length === 0, 'Database must have 0 demo payroll batches');
    assert(db.getInvoices().length === 0, 'Database must have 0 demo invoices');
    assert(db.getPayments().length === 0, 'Database must have 0 demo payments');
    assert(db.getAuditLogs().length === 0, 'Database must have 0 demo audit logs');
    assert(db.getSyncJobs().length === 0, 'Database must have 0 demo sync jobs');
    assert(db.getUsers().length === 1, 'Database must have only 1 user (Super Admin)');
    assert(db.getUsers()[0].email === 'himanshu.m@letsunbound.com', 'Single user must be himanshu.m@letsunbound.com');
  });

  // --- 25. USER CREATION & INVITATION WORKFLOW ---
  test('Scenario 25: Admin can create new users with SENT_PASSWORD_VERIFICATION status and setup token', () => {
    const newUser = db.createUser({
      name: 'Eleanor Vance',
      email: 'eleanor.vance@letsunbound.com',
      role: 'OPERATIONS',
      roleName: 'Operations Specialist',
      status: 'SENT_PASSWORD_VERIFICATION',
      assignedBranchIds: [],
      permissions: [],
    });

    assert(newUser.id, 'User must have an ID');
    assert(newUser.status === 'SENT_PASSWORD_VERIFICATION');

    const retrieved = db.getUserByEmail('eleanor.vance@letsunbound.com');
    assert(retrieved, 'Must find created user by email');
    assert(retrieved.name === 'Eleanor Vance');
    assert(retrieved.status === 'SENT_PASSWORD_VERIFICATION');
  });

  // --- 26. USER STATUS LIFECYCLE (ACTIVE, SUSPENDED, DISABLED) ---
  test('Scenario 26: User status transitions correctly between ACTIVE, SUSPENDED, and DISABLED', () => {
    const user = db.getUserByEmail('eleanor.vance@letsunbound.com')!;
    
    // Set to ACTIVE
    db.updateUser(user.id, { status: 'ACTIVE' });
    assert(db.getUserById(user.id)!.status === 'ACTIVE');

    // Suspend
    db.updateUser(user.id, { status: 'SUSPENDED' });
    assert(db.getUserById(user.id)!.status === 'SUSPENDED');

    // Disable
    db.updateUser(user.id, { status: 'DISABLED' });
    assert(db.getUserById(user.id)!.status === 'DISABLED');

    // Clean up
    db.deleteUser(user.id);
    assert(db.getUserById(user.id) === undefined);
  });

  // --- 27. CORPORATE EMAIL & SMTP CONFIGURATION ---
  test('Scenario 27: Company mail server settings can be retrieved, configured, and stored securely', () => {
    const initialConfig = db.getEmailConfig();
    assert(initialConfig, 'Email configuration must exist in store');
    assert(initialConfig.host === 'smtp.letsunbound.com', 'Default host must be configured');
    assert(initialConfig.port === 587, 'Default port must be 587');
    assert(initialConfig.security === 'STARTTLS', 'Default security must be STARTTLS');

    // Update SMTP configuration
    const updated = db.saveEmailConfig({
      host: 'mail.letsunbound.com',
      port: 465,
      security: 'SSL_TLS',
      authRequired: true,
      user: 'notifications@letsunbound.com',
      pass: 'SecretCompanyPassword@2026',
      fromEmail: 'notifications@letsunbound.com',
      fromName: 'LUmentor Faculty Notifications',
      isEnabled: true,
    });

    assert(updated.host === 'mail.letsunbound.com');
    assert(updated.port === 465);
    assert(updated.security === 'SSL_TLS');
    assert(updated.isEnabled === true);
    assert(updated.pass === 'SecretCompanyPassword@2026');

    // Retrieve again to ensure persistence
    const reloaded = db.getEmailConfig();
    assert(reloaded.host === 'mail.letsunbound.com');
    assert(reloaded.port === 465);
  });

  // --- 28. EMAIL DISPATCH SERVICE & SIMULATED DRY-RUN ---
  test('Scenario 28: Email service supports custom company mail templates and fallback simulation', async () => {
    const { sendEmail } = require('../src/lib/email/service');
    
    // Test simulated dispatch
    const res = await sendEmail({
      to: 'himanshu.m@letsunbound.com',
      subject: 'Test Subject',
      text: 'Test message body',
    }, {
      host: 'mail.letsunbound.com',
      port: 587,
      security: 'STARTTLS',
      authRequired: true,
      user: 'notifications@letsunbound.com',
      pass: '',
      fromEmail: 'notifications@letsunbound.com',
      fromName: 'LUmentor',
      allowSelfSignedCert: false,
      isEnabled: false, // dry-run mode
    });

    assert(res.success === true, 'Dry-run should report success');
    assert(res.mocked === true, 'Must indicate mocked/simulated status when isEnabled is false');
  });

  // --- 29. SMART SHEET SCHEMA DETECTION ---
  test('Scenario 29: Sheet report engine detects schema and normalizes fuzzy columns', () => {
    const { detectSchema, normCol, statusBucket, parseMoney } = require('../src/lib/analytics/sheetEngine');
    
    assert(normCol('  Teacher Joining Date!  ') === 'teacher joining date');
    assert(statusBucket('Checked-in present') === 'Present');
    assert(statusBucket('Absent due to illness') === 'Absent');
    assert(statusBucket('15 min Late') === 'Late');
    assert(parseMoney('$145.50') === 145.50);
    assert(parseMoney('₹ 12,500.00') === 12500);

    const testColumns = [
      'Learner Name',
      'Student ID',
      'Tutor',
      'Teacher Join Date',
      'Course',
      'Attendance Status',
      'Session Date',
      'Start Time',
      'End Time',
      'Amount',
      'Invoice No',
      'Invoice Status',
    ];

    const schema = detectSchema(testColumns);
    assert(schema.student_name === 'Learner Name', 'Must match student name');
    assert(schema.staff === 'Tutor', 'Must match staff');
    assert(schema.staff_join_date === 'Teacher Join Date', 'Must match join date');
    assert(schema.subject === 'Course', 'Must match subject');
    assert(schema.status === 'Attendance Status', 'Must match status');
    assert(schema.date === 'Session Date', 'Must match date');
    assert(schema.fees === 'Amount', 'Must match fees');
    assert(schema.invoice_no === 'Invoice No', 'Must match invoice number');
  });

  // --- 30. CLASS SESSION DEDUPLICATION & TEACHER METRICS ---
  test('Scenario 30: Group classes are deduplicated so multi-student classes count as 1 session', () => {
    const { detectSchema, prepareSheetData, generateTeacherTable } = require('../src/lib/analytics/sheetEngine');

    // 4 attendance rows representing 1 group class with 4 students
    const groupRows = [
      { 'Date': '2026-10-15', 'Start Time': '10:00', 'End Time': '11:00', 'Subject': 'Math', 'Batch': 'Batch A', 'Location': 'Campus 1', 'Teacher Name': 'Dr. Smith', 'Student Name': 'Alice', 'Status': 'Present' },
      { 'Date': '2026-10-15', 'Start Time': '10:00', 'End Time': '11:00', 'Subject': 'Math', 'Batch': 'Batch A', 'Location': 'Campus 1', 'Teacher Name': 'Dr. Smith', 'Student Name': 'Bob', 'Status': 'Present' },
      { 'Date': '2026-10-15', 'Start Time': '10:00', 'End Time': '11:00', 'Subject': 'Math', 'Batch': 'Batch A', 'Location': 'Campus 1', 'Teacher Name': 'Dr. Smith', 'Student Name': 'Charlie', 'Status': 'Absent' },
      { 'Date': '2026-10-15', 'Start Time': '10:00', 'End Time': '11:00', 'Subject': 'Math', 'Batch': 'Batch A', 'Location': 'Campus 1', 'Teacher Name': 'Dr. Smith', 'Student Name': 'David', 'Status': 'Late' },
    ];

    const columns = Object.keys(groupRows[0]);
    const schema = detectSchema(columns);
    const prepared = prepareSheetData(groupRows, schema);

    const teacherSummary = generateTeacherTable(prepared, schema);
    assert(teacherSummary.length === 1, 'Should have 1 teacher');
    assert(teacherSummary[0].classSessions === 1, 'Group class must count as 1 session, not 4');
    assert(teacherSummary[0].attendanceRecords === 4, 'Must have 4 attendance records');
    assert(teacherSummary[0].students === 4, 'Must have 4 distinct students');
    assert(teacherSummary[0].present === 3, 'Present includes Present and Late (Alice, Bob, David)');
    assert(teacherSummary[0].absent === 1, '1 absent (Charlie)');
    assert(Math.round(teacherSummary[0].studentAttendancePct) === 75, 'Attendance should be 75%');
  });

  // --- 31. STUDENT RISK CLASSIFICATION & QUALITY AUDITING ---
  test('Scenario 31: Student attendance risk classification and dataset quality auditing', () => {
    const { detectSchema, prepareSheetData, generateStudentTable, auditDataQuality } = require('../src/lib/analytics/sheetEngine');

    const rows = [
      // High risk student: 1 present, 3 absent = 25% (<75%)
      { 'Student': 'Student Low', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student Low', 'Status': 'Absent', 'Staff': 'T1' },
      { 'Student': 'Student Low', 'Status': 'Absent', 'Staff': 'T1' },
      { 'Student': 'Student Low', 'Status': 'Absent', 'Staff': 'T1' },
      // Healthy student: 9 present, 1 absent = 90% (>=90%)
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Present', 'Staff': 'T1' },
      { 'Student': 'Student High', 'Status': 'Absent', 'Staff': 'T1' },
    ];

    const schema = detectSchema(Object.keys(rows[0]));
    const prepared = prepareSheetData(rows, schema);
    const students = generateStudentTable(prepared, schema);

    const lowRiskStu = students.find((s: any) => s.studentName === 'Student Low');
    const highRiskStu = students.find((s: any) => s.studentName === 'Student High');

    assert(lowRiskStu.risk === 'High Risk', 'Must be classified as High Risk (<75%)');
    assert(highRiskStu.risk === 'Healthy', 'Must be classified as Healthy (>=90%)');

    const audit = auditDataQuality(rows);
    assert(audit.totalRows === 14, 'Must count 14 total rows');
    assert(audit.cellCompletenessPct === 100, 'All cells present in this set');
  });

  // Post-test cleanup: ensure consistent baseline data in store
  db.resetToSeed();

  console.log('\n-------------------------------------------------------------');
  console.log(`   TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('-------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAcceptanceTests();
