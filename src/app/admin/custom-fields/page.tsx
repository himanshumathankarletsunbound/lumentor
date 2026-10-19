'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { Alert } from '../../../components/ui/Alert';
import { CustomFieldDefinition, CustomFieldEntityType, CustomFieldType } from '../../../lib/types/models';
import { Sliders, Plus, Edit2, Trash2, ArrowRight, CheckCircle2, Database, Link2 } from 'lucide-react';
import { formatDate } from '../../../lib/utils/formatters';

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>(db.getCustomFields());
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [entityType, setEntityType] = useState<CustomFieldEntityType>('STUDENT');
  const [fieldType, setFieldType] = useState<CustomFieldType>('TEXT');
  const [classcardFieldKey, setClasscardFieldKey] = useState('');
  const [classcardEndpoint, setClasscardEndpoint] = useState('GET /students/{id}/custom-fields');
  const [isRequired, setIsRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState('');
  const [description, setDescription] = useState('');

  const filtered = fields.filter((f) => {
    if (selectedEntity !== 'ALL' && f.entityType !== selectedEntity) return false;
    return true;
  });

  const handleNameChange = (val: string) => {
    setName(val);
    if (!key || key === name.toLowerCase().replace(/[^a-z0-9]/g, '_')) {
      setKey(val.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
  };

  const handleCreateField = () => {
    if (!name.trim() || !key.trim()) return;

    const options = fieldType === 'SELECT' && optionsStr.trim()
      ? optionsStr.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const newField = db.createCustomField({
      name,
      key,
      entityType,
      fieldType,
      classcardFieldKey: classcardFieldKey.trim() || undefined,
      classcardEndpoint: classcardEndpoint.trim() || undefined,
      isRequired,
      options,
      description: description.trim() || undefined,
      isActive: true,
    });

    db.logAudit({
      userId: 'usr-admin-1',
      userName: 'Dr. Evelyn Vance',
      userRole: 'ADMINISTRATOR',
      action: 'CUSTOM_FIELD_CREATED',
      entityType: 'CustomFieldDefinition',
      entityId: newField.id,
      details: `Created custom field "${name}" (${key}) for entity ${entityType} mapped to Classcard ${classcardFieldKey || 'none'}.`,
    });

    setFields(db.getCustomFields());
    setShowModal(false);
    setNotification({
      type: 'success',
      message: `Custom field "${name}" created and mapped successfully.`,
    });

    // Reset form
    setName('');
    setKey('');
    setClasscardFieldKey('');
    setOptionsStr('');
    setDescription('');
  };

  const handleDeleteField = (id: string, fieldName: string) => {
    if (confirm(`Are you sure you want to delete custom field "${fieldName}"?`)) {
      db.deleteCustomField(id);
      db.logAudit({
        userId: 'usr-admin-1',
        userName: 'Dr. Evelyn Vance',
        userRole: 'ADMINISTRATOR',
        action: 'CUSTOM_FIELD_DELETED',
        entityType: 'CustomFieldDefinition',
        entityId: id,
        details: `Deleted custom field "${fieldName}".`,
      });
      setFields(db.getCustomFields());
      setNotification({
        type: 'info',
        message: `Custom field "${fieldName}" removed.`,
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Custom Fields & Mappings</h1>
            <p className="text-xs text-slate-500 mt-1">
              Define operational custom attributes across Students, Mentors, and Classes, and map them to Classcard API schemas.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowModal(true)}
          >
            Add Custom Field
          </Button>
        </div>

        {notification && (
          <Alert
            type={notification.type}
            title={notification.type === 'success' ? 'Saved' : 'Updated'}
            message={notification.message}
          />
        )}

        {/* Entity Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          {['ALL', 'STUDENT', 'MENTOR', 'CLASS', 'LEAD'].map((ent) => (
            <button
              key={ent}
              onClick={() => setSelectedEntity(ent)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedEntity === ent
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {ent === 'ALL' ? 'All Entities' : `${ent}s`}
            </button>
          ))}
        </div>

        {/* Fields Table */}
        <Card>
          <CardHeader
            title="Registered Custom Field Mappings"
            subtitle="Local operational variables linked to Classcard API endpoints"
          />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field Label & Key</TableHead>
                  <TableHead>Target Entity</TableHead>
                  <TableHead>Data Type</TableHead>
                  <TableHead>Classcard API Mapping</TableHead>
                  <TableHead>Validation</TableHead>
                  <TableHead>Allowed Options / Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <TableEmptyState
                        title="No custom fields defined"
                        description="Add a custom field to capture bespoke attributes and synchronize them with Classcard."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <p className="font-semibold text-slate-900">{f.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{f.key}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            f.entityType === 'STUDENT'
                              ? 'default'
                              : f.entityType === 'MENTOR'
                              ? 'purple'
                              : f.entityType === 'CLASS'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {f.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {f.fieldType}
                        </span>
                      </TableCell>
                      <TableCell>
                        {f.classcardFieldKey ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700">
                              <Link2 className="w-3 h-3 text-indigo-500" />
                              <span className="font-mono">{f.classcardFieldKey}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">{f.classcardEndpoint}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Local Only (Unmapped)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.isRequired ? 'danger' : 'neutral'} size="sm">
                          {f.isRequired ? 'Required' : 'Optional'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-slate-600 truncate">
                        {f.options && f.options.length > 0 ? (
                          <span title={f.options.join(', ')}>
                            {f.options.slice(0, 3).join(', ')}
                            {f.options.length > 3 ? ` +${f.options.length - 3} more` : ''}
                          </span>
                        ) : (
                          f.defaultValue || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.isActive ? 'success' : 'neutral'} size="sm" dot>
                          {f.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteField(f.id, f.name)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Modal: Add Custom Field */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Custom Field & Classcard Mapping"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Field Label *</label>
                <input
                  type="text"
                  placeholder="e.g. Academic Grade Level"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Internal Key / Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. grade_level"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Entity *</label>
                <select
                  value={entityType}
                  onChange={(e) => {
                    const ent = e.target.value as CustomFieldEntityType;
                    setEntityType(ent);
                    if (ent === 'STUDENT') setClasscardEndpoint('GET /students/{id}/custom-fields');
                    else if (ent === 'MENTOR') setClasscardEndpoint('GET /staff/{id}');
                    else if (ent === 'CLASS') setClasscardEndpoint('GET /events/{id}');
                    else setClasscardEndpoint('GET /leads');
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="STUDENT">Student</option>
                  <option value="MENTOR">Mentor / Staff</option>
                  <option value="CLASS">Class / Session</option>
                  <option value="LEAD">Prospective Lead</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Data Type *</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="TEXT">Text (Single Line)</option>
                  <option value="NUMBER">Numeric</option>
                  <option value="BOOLEAN">Boolean (Yes/No)</option>
                  <option value="SELECT">Single Select Option</option>
                  <option value="DATE">Calendar Date</option>
                </select>
              </div>
            </div>

            {fieldType === 'SELECT' && (
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Options (comma-separated)</label>
                <input
                  type="text"
                  placeholder="9th Grade, 10th Grade, 11th Grade, 12th Grade"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            )}

            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Classcard API v2 Synchronization Mapping</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-indigo-950 block mb-1">Classcard JSON Payload Key</label>
                  <input
                    type="text"
                    placeholder="e.g. custom_field_grade"
                    value={classcardFieldKey}
                    onChange={(e) => setClasscardFieldKey(e.target.value)}
                    className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-indigo-950 block mb-1">Classcard Source Endpoint</label>
                  <input
                    type="text"
                    value={classcardEndpoint}
                    onChange={(e) => setClasscardEndpoint(e.target.value)}
                    className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Field Description</label>
              <textarea
                placeholder="Operational purpose, usage instructions, or compliance guidance..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isRequired"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isRequired" className="font-medium text-slate-700">
                Mark this field as mandatory for data entry
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateField}>
                Save Field & Mapping
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
