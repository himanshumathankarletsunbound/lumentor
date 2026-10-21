import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { hashPassword, generateResetToken } from '../../../lib/auth/crypto';
import { SystemRole, UserStatus, RolePermission } from '../../../lib/types/auth';
import { sendPasswordSetupEmail } from '../../../lib/email/service';

function sanitizeUser(u: any) {
  const { passwordHash: _h, salt: _s, resetToken: _rt, ...safeUser } = u;
  return {
    ...safeUser,
    status: (u.status || 'ACTIVE') as UserStatus,
    hasConfiguredPassword: Boolean(u.passwordHash && u.salt),
  };
}

export async function GET() {
  try {
    db.reloadIfModified();
    const users = db.getUsers().map(sanitizeUser);
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const role = (body.role || 'OPERATIONS') as SystemRole;
    const roleName = String(body.roleName || '').trim();
    const assignedBranchIds = Array.isArray(body.assignedBranchIds) ? body.assignedBranchIds : [];
    const sendPasswordSetupEmailFlag = body.sendPasswordSetupEmail !== false;
    const initialPassword = String(body.initialPassword || '').trim();
    let requestedStatus = (body.status || '') as UserStatus;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Full name is required.' }, { status: 400 });
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    db.reloadIfModified();
    const existing = db.getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `A user with email ${email} already exists.` },
        { status: 400 }
      );
    }

    // Resolve role permissions
    const roles = db.getRoles();
    const matchedRole = roles.find((r) => r.systemRole === role) || roles[0];
    const finalRoleName = roleName || matchedRole?.name || role;
    const permissions: RolePermission[] = matchedRole ? matchedRole.permissions : [];

    let passwordHash: string | undefined = undefined;
    let salt: string | undefined = undefined;
    let resetToken: string | undefined = undefined;
    let resetTokenExpiry: string | undefined = undefined;
    let resetUrl: string | undefined = undefined;

    if (initialPassword) {
      const hashed = hashPassword(initialPassword);
      passwordHash = hashed.hash;
      salt = hashed.salt;
      if (!requestedStatus) {
        requestedStatus = 'ACTIVE';
      }
    }

    if (sendPasswordSetupEmailFlag || !initialPassword) {
      const tokenInfo = generateResetToken(1440); // 24 hours validity
      resetToken = tokenInfo.token;
      resetTokenExpiry = tokenInfo.expiresAt;

      const origin = req.nextUrl.origin || 'http://localhost:3005';
      resetUrl = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;

      if (!requestedStatus || requestedStatus === 'ACTIVE') {
        requestedStatus = 'SENT_PASSWORD_VERIFICATION';
      }
    }

    const newUser = db.createUser({
      name,
      email,
      role,
      roleName: finalRoleName,
      status: requestedStatus || 'SENT_PASSWORD_VERIFICATION',
      assignedBranchIds,
      permissions,
      passwordHash,
      salt,
      resetToken,
      resetTokenExpiry,
    });

    db.logAudit({
      userId: 'user-admin',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      details: `Created user ${newUser.email} (${newUser.roleName}) with status ${newUser.status}. Invite setup: ${sendPasswordSetupEmailFlag ? 'YES' : 'NO'}`,
    });

    // Send setup email via company SMTP mail server
    if (resetUrl && sendPasswordSetupEmailFlag) {
      sendPasswordSetupEmail(newUser.email, newUser.name, resetUrl).catch((err) => {
        console.warn('Failed to dispatch password setup email:', err);
      });
    }

    return NextResponse.json({
      success: true,
      user: sanitizeUser(newUser),
      resetUrl,
      message: sendPasswordSetupEmailFlag
        ? `User created successfully. Password verification link generated.`
        : `User created successfully with active credentials.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create user.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    db.reloadIfModified();
    const user = db.getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Action 1: Resend password verification link
    if (action === 'resend_password_link' || action === 'resend_invite') {
      const tokenInfo = generateResetToken(1440); // 24 hours
      user.resetToken = tokenInfo.token;
      user.resetTokenExpiry = tokenInfo.expiresAt;
      user.status = 'SENT_PASSWORD_VERIFICATION';
      db.saveUser(user);

      const origin = req.nextUrl.origin || 'http://localhost:3005';
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(tokenInfo.token)}`;

      db.logAudit({
        userId: 'user-admin',
        userName: 'Administrator',
        userRole: 'ADMINISTRATOR',
        action: 'PASSWORD_RESET_RESENT',
        entityType: 'User',
        entityId: user.id,
        details: `Resent password setup link to ${user.email}`,
      });

      // Dispatch email
      sendPasswordSetupEmail(user.email, user.name, resetUrl).catch((err) => {
        console.warn('Failed to dispatch password setup email on resend:', err);
      });

      return NextResponse.json({
        success: true,
        user: sanitizeUser(user),
        resetUrl,
        message: `Password setup link generated and dispatched to ${user.email}.`,
      });
    }

    // Action 2: Update status
    if (body.status) {
      const validStatuses: UserStatus[] = ['ACTIVE', 'SENT_PASSWORD_VERIFICATION', 'SUSPENDED', 'DISABLED'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }

      user.status = body.status;
      if (body.status === 'SUSPENDED' || body.status === 'DISABLED') {
        user.sessionToken = undefined;
        user.sessionExpiry = undefined;
      }
    }

    // Action 3: Update role or basic fields
    if (body.name) user.name = String(body.name).trim();
    if (body.role) {
      user.role = body.role as SystemRole;
      const roles = db.getRoles();
      const matched = roles.find((r) => r.systemRole === user.role);
      user.roleName = body.roleName || matched?.name || user.role;
      if (matched) {
        user.permissions = matched.permissions;
      }
    }
    if (Array.isArray(body.assignedBranchIds)) {
      user.assignedBranchIds = body.assignedBranchIds;
    }

    db.saveUser(user);

    db.logAudit({
      userId: 'user-admin',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      details: `Updated user profile/status for ${user.email} (Status: ${user.status}, Role: ${user.role})`,
    });

    return NextResponse.json({
      success: true,
      user: sanitizeUser(user),
      message: 'User updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update user.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    db.reloadIfModified();
    const user = db.getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Safety check: Don't delete the primary super admin
    if (user.id === 'user-super-admin' || user.email === 'himanshu.m@letsunbound.com') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the primary Super Administrator account.' },
        { status: 400 }
      );
    }

    db.deleteUser(id);

    db.logAudit({
      userId: 'user-admin',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      details: `Deleted user account ${user.email} (${user.name})`,
    });

    return NextResponse.json({ success: true, message: `User ${user.email} has been removed.` });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete user.' },
      { status: 500 }
    );
  }
}
