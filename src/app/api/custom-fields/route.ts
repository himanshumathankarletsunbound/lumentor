import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { CustomFieldEntityType } from '../../../lib/types/models';

export async function GET(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'settings', 'view');
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType') as CustomFieldEntityType | null;

    const fields = db.getCustomFields(entityType || undefined);
    return NextResponse.json({
      success: true,
      count: fields.length,
      customFields: fields,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'settings', 'manage_settings');
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      name,
      key,
      entityType,
      fieldType,
      classcardFieldKey,
      classcardEndpoint,
      isRequired = false,
      options,
      defaultValue,
      description,
      createdBy = 'Administrator',
    } = body;

    if (!name || !key || !entityType || !fieldType) {
      return NextResponse.json(
        { success: false, error: 'name, key, entityType, and fieldType are required' },
        { status: 400 }
      );
    }

    const field = db.createCustomField({
      name,
      key,
      entityType,
      fieldType,
      classcardFieldKey,
      classcardEndpoint,
      isRequired: Boolean(isRequired),
      options,
      defaultValue,
      description,
      isActive: true,
    });

    db.logAudit({
      userId: 'usr-admin-1',
      userName: createdBy,
      userRole: 'ADMINISTRATOR',
      action: 'CUSTOM_FIELD_MAPPED',
      entityType: 'CustomFieldDefinition',
      entityId: field.id,
      details: `Configured field "${name}" (${key}) for entity ${entityType} mapped to Classcard ${classcardFieldKey || 'none'}.`,
    });
    await db.persistNow();

    return NextResponse.json({
      success: true,
      message: 'Custom field mapping created successfully',
      customField: field,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await authorizationErrorAsync(req, 'settings', 'manage_settings');
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Field id is required' },
        { status: 400 }
      );
    }

    const deleted = db.deleteCustomField(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `Field ${id} not found` },
        { status: 404 }
      );
    }

    db.logAudit({
      userId: 'usr-admin-1',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'CUSTOM_FIELD_DELETED',
      entityType: 'CustomFieldDefinition',
      entityId: id,
      details: `Removed custom field definition ${id}.`,
    });
    await db.persistNow();

    return NextResponse.json({
      success: true,
      message: 'Custom field mapping deleted successfully',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
