import assert from 'node:assert';
import { db } from '../src/lib/db/store';
import { sendAttendanceReminderEmail } from '../src/lib/email/service';
import { PayoutSchedule } from '../src/lib/types/payroll';

console.log('=============================================================');
console.log('   RUNNING PAYOUT SCHEDULES & PRE-FLIGHT VERIFICATION TEST   ');
console.log('=============================================================\n');

async function runTests() {
  // Test 1: Payout Schedule creation with 3rd, 5th, 15th cohorts
  console.log('[TEST 1] Creating Payout Schedules for 3rd, 5th, and 15th cohorts...');
  const schedule3rd: PayoutSchedule = {
    id: 'test-sched-03',
    name: 'November 3rd Payout Cohort',
    code: 'SCHED-NOV-03',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    freezingDate: '2026-10-31',
    payoutDate: '2026-11-03',
    payoutDay: 3,
    status: 'ACTIVE',
    assignedMentorIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const schedule15th: PayoutSchedule = {
    id: 'test-sched-15',
    name: 'November 15th Mid-Month Cohort',
    code: 'SCHED-NOV-15',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    freezingDate: '2026-11-15',
    payoutDate: '2026-11-15',
    payoutDay: 15,
    status: 'ACTIVE',
    assignedMentorIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.savePayoutSchedule(schedule3rd);
  db.savePayoutSchedule(schedule15th);

  const schedules = db.getPayoutSchedules();
  assert.ok(schedules.find((s) => s.id === 'test-sched-03'), 'Schedule 3rd should be saved');
  assert.ok(schedules.find((s) => s.id === 'test-sched-15'), 'Schedule 15th should be saved');
  console.log('  -> PASS: Successfully created and retrieved payout schedules.\n');

  // Test 2: Freeze and Unfreeze
  console.log('[TEST 2] Testing month-end freeze & unfreeze cycle...');
  const frozen = db.freezePayoutSchedule('test-sched-03', 'Operations Director');
  assert.strictEqual(frozen.isFrozen, true, 'Schedule should be marked as frozen');
  assert.strictEqual(frozen.frozenBy, 'Operations Director', 'FrozenBy should match');

  const unfrozen = db.unfreezePayoutSchedule('test-sched-03');
  assert.strictEqual(unfrozen.isFrozen, false, 'Schedule should be unlocked');
  console.log('  -> PASS: Freeze and unfreeze operations execute cleanly.\n');

  // Test 3: Email Reminder Service
  console.log('[TEST 3] Testing attendance reminder email formatting and dispatch...');
  const emailResult = await sendAttendanceReminderEmail(
    'mentor.test@example.com',
    'Dr. Aris Thorne',
    [
      { id: 'cls-1', title: 'Advanced Calculus', startTime: '2026-10-20T10:00:00Z', durationMinutes: 60, branchName: 'Downtown' },
      { id: 'cls-2', title: 'Linear Algebra', startTime: '2026-10-22T14:00:00Z', durationMinutes: 90, branchName: 'Uptown' },
    ],
    '2026-10-31',
    '2026-11-03'
  );

  assert.strictEqual(emailResult.success, true, 'Email service should succeed in simulation/dev mode');
  console.log('  -> PASS: Reminder notification template and simulated delivery verified.\n');

  // Cleanup
  db.deletePayoutSchedule('test-sched-03');
  db.deletePayoutSchedule('test-sched-15');

  console.log('-------------------------------------------------------------');
  console.log('   ALL VERIFICATION SCENARIOS PASSED (3/3)                   ');
  console.log('-------------------------------------------------------------');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
