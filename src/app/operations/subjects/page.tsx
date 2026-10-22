'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { db } from '../../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmptyState } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { RowActions } from '../../../components/ui/RowActions';
import { DeleteConfirmModal } from '../../../components/ui/DeleteConfirmModal';
import { AddRecordModal } from '../../../components/operations/AddRecordModal';
import { AddSubjectOrCategoryModal } from '../../../components/operations/AddSubjectOrCategoryModal';
import { BookOpen, Plus, FolderKanban, FolderPlus, ChevronDown, Search } from 'lucide-react';
import { Subject } from '../../../lib/types/models';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>(db.getSubjects());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState<'subject' | 'category'>('subject');
  const [defaultCategoryForAdd, setDefaultCategoryForAdd] = useState<string>('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dropdown menu state for header "Add" button
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Custom registered categories (persists empty categories created by user)
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lumentor_custom_subject_categories');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const refreshSubjects = async () => {
    const response = await fetch('/api/records?type=subject');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load subjects.');
    setSubjects(result.records as Subject[]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSubjects().catch((error: unknown) => {
        console.error('Failed to load subjects from the database:', error);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Close add menu when clicking outside
  useEffect(() => {
    if (!addMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [addMenuOpen]);

  // Compute all unique categories (derived from subjects + user-created categories)
  const categories = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => {
      const cat = (s.category || 'General').trim();
      if (cat) set.add(cat);
    });
    customCategories.forEach((cat) => {
      if (cat.trim()) set.add(cat.trim());
    });
    return Array.from(set).sort();
  }, [subjects, customCategories]);

  // Group subjects by category with search query filtering
  const categorizedSubjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = subjects.filter((s) => {
      if (!query) return true;
      return (
        s.name.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query) ||
        (s.category && s.category.toLowerCase().includes(query))
      );
    });

    const groups: Record<string, Subject[]> = {};
    categories.forEach((cat) => {
      groups[cat] = [];
    });

    filtered.forEach((s) => {
      const cat = (s.category || 'General').trim();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });

    return groups;
  }, [subjects, categories, searchQuery]);

  const activeCategories = useMemo(() => {
    if (selectedCategory !== 'ALL') {
      return categories.filter((cat) => cat === selectedCategory);
    }
    return categories;
  }, [categories, selectedCategory]);

  const handleSaveSubject = async (data: {
    name: string;
    code: string;
    category: string;
    duration: number;
    description?: string;
  }) => {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subject',
        record: {
          name: data.name,
          code: data.code,
          category: data.category || 'General',
          description: data.description || '',
          defaultDurationMinutes: data.duration,
          availableDurations: [data.duration],
          isActive: true,
          color: '#6366f1',
          provenance: 'LOCALLY_CREATED',
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create subject.');

    if (!customCategories.includes(data.category)) {
      const updated = [...customCategories, data.category];
      setCustomCategories(updated);
      try {
        localStorage.setItem('lumentor_custom_subject_categories', JSON.stringify(updated));
      } catch {}
    }

    await refreshSubjects();
  };

  const handleSaveCategory = async (data: {
    categoryName: string;
    description?: string;
    initialSubject?: {
      name: string;
      code: string;
      duration: number;
    };
  }) => {
    const catName = data.categoryName.trim();
    if (!customCategories.includes(catName)) {
      const updated = [...customCategories, catName];
      setCustomCategories(updated);
      try {
        localStorage.setItem('lumentor_custom_subject_categories', JSON.stringify(updated));
      } catch {}
    }

    if (data.initialSubject) {
      await handleSaveSubject({
        name: data.initialSubject.name,
        code: data.initialSubject.code,
        category: catName,
        duration: data.initialSubject.duration,
        description: data.description,
      });
    }
  };

  const handleUpdateSubject = async (values: Record<string, string>) => {
    if (!editingSubject) return;
    const duration = Number(values.duration) || 60;
    const response = await fetch('/api/records', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subject',
        id: editingSubject.id,
        updates: {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          category: values.category.trim() || 'General',
          description: values.description?.trim() || '',
          defaultDurationMinutes: duration,
          availableDurations: [duration],
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update subject.');
    await refreshSubjects();
    setEditingSubject(null);
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/records?type=subject&id=${encodeURIComponent(deletingSubject.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete subject.');
      await refreshSubjects();
      setDeletingSubject(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Subjects</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {subjects.length} Subjects across {categories.length} Categories
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Curriculum catalog organized by categories, course definitions, and session durations.
            </p>
          </div>

          {/* Action Button: "Add" with Category and Subject Options */}
          <div className="flex items-center gap-2" ref={addMenuRef}>
            <div className="relative inline-block text-left">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                rightIcon={<ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${addMenuOpen ? 'rotate-180' : ''}`} />}
                onClick={() => setAddMenuOpen(!addMenuOpen)}
              >
                Add
              </Button>

              {addMenuOpen && (
                <div className="absolute right-0 z-40 mt-1.5 w-56 origin-top-right rounded-xl bg-white p-1 text-xs shadow-xl ring-1 ring-slate-900/10 border border-slate-100 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false);
                      setModalMode('subject');
                      setDefaultCategoryForAdd('');
                      setShowAddModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800">Add Subject</div>
                      <div className="text-[10px] font-normal text-slate-400">Add a course under a category</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false);
                      setModalMode('category');
                      setDefaultCategoryForAdd('');
                      setShowAddModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800">Add Category</div>
                      <div className="text-[10px] font-normal text-slate-400">Create a curriculum category</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Categories Bar & Search Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          {/* Category Tabs / Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              All Categories ({subjects.length})
            </button>
            {categories.map((cat) => {
              const count = (categorizedSubjects[cat] || []).length;
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FolderKanban className={`w-3 h-3 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Quick "+ New Category" button in the tabs bar */}
            <button
              type="button"
              onClick={() => {
                setModalMode('category');
                setShowAddModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg font-medium text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200/60 transition-colors flex items-center gap-1"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative shrink-0 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search subjects or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Subjects Grouped by Category */}
        {categories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <TableEmptyState
              title="No Academic Subjects Found"
              description="Create your first subject or define a curriculum category to get started."
              action={
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setModalMode('subject');
                      setShowAddModal(true);
                    }}
                  >
                    Add Subject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<FolderPlus className="w-4 h-4 text-indigo-600" />}
                    onClick={() => {
                      setModalMode('category');
                      setShowAddModal(true);
                    }}
                  >
                    Add Category
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {activeCategories.map((categoryName) => {
              const categorySubjects = categorizedSubjects[categoryName] || [];
              return (
                <div key={categoryName} className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                  {/* Category Section Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100">
                        <FolderKanban className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-slate-900 text-sm tracking-tight">{categoryName}</h2>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {categorySubjects.length} {categorySubjects.length === 1 ? 'subject' : 'subjects'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5 text-indigo-600" />}
                      className="text-xs text-indigo-700 hover:bg-indigo-50"
                      onClick={() => {
                        setModalMode('subject');
                        setDefaultCategoryForAdd(categoryName);
                        setShowAddModal(true);
                      }}
                    >
                      Add subject to {categoryName}
                    </Button>
                  </div>

                  {/* Table of Subjects inside this Category */}
                  {categorySubjects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50">
                      No subjects configured under <span className="font-semibold text-slate-700">{categoryName}</span> yet.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setModalMode('subject');
                          setDefaultCategoryForAdd(categoryName);
                          setShowAddModal(true);
                        }}
                        className="text-indigo-600 font-semibold hover:underline ml-1"
                      >
                        + Add first subject
                      </button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject Name</TableHead>
                          <TableHead>Subject Code</TableHead>
                          <TableHead>Default Duration</TableHead>
                          <TableHead>Available Durations</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categorySubjects.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-bold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <span className="w-3 h-3 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: s.color || '#6366f1' }} />
                                <div>
                                  <span className="font-semibold text-slate-900">{s.name}</span>
                                  {s.description && <p className="text-[11px] text-slate-400 font-normal">{s.description}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-slate-700">{s.code}</TableCell>
                            <TableCell className="text-xs text-slate-700 font-semibold">{s.defaultDurationMinutes} mins</TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {s.availableDurations && s.availableDurations.length > 0
                                ? s.availableDurations.map((d) => `${d}m`).join(', ')
                                : `${s.defaultDurationMinutes}m`}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.provenance === 'CLASSCARD_SOURCED' ? 'purple' : 'neutral'} size="sm">
                                {s.provenance === 'CLASSCARD_SOURCED' ? 'Classcard' : 'Local'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <RowActions
                                editTooltip={`Edit ${s.name}`}
                                deleteTooltip={`Delete ${s.name}`}
                                onEdit={() => setEditingSubject(s)}
                                onDelete={() => setDeletingSubject(s)}
                                extraActions={[
                                  {
                                    label: 'View curriculum details',
                                    onClick: () => alert(`Subject details for ${s.name} (${s.code}) will be displayed in full preview mode.`),
                                  },
                                  {
                                    label: 'Duplicate subject',
                                    onClick: () => {
                                      setDefaultCategoryForAdd(s.category);
                                      setModalMode('subject');
                                      setShowAddModal(true);
                                    },
                                  },
                                  {
                                    label: 'Assign to mentors',
                                    onClick: () => alert(`Direct mentor assignment for ${s.name} will open mentor matrix.`),
                                  },
                                ]}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unified Add Modal: Handles Adding Category OR Subject */}
        <AddSubjectOrCategoryModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setDefaultCategoryForAdd('');
          }}
          initialMode={modalMode}
          defaultCategory={defaultCategoryForAdd}
          existingCategories={categories}
          onSaveSubject={handleSaveSubject}
          onSaveCategory={handleSaveCategory}
        />

        {/* Edit Subject Modal */}
        {editingSubject && (
          <AddRecordModal
            title={`Edit Subject: ${editingSubject.name}`}
            isOpen={Boolean(editingSubject)}
            submitLabel="Save changes"
            onClose={() => setEditingSubject(null)}
            initialValues={{
              name: editingSubject.name,
              code: editingSubject.code,
              category: editingSubject.category,
              duration: String(editingSubject.defaultDurationMinutes),
            }}
            fields={[
              { name: 'name', label: 'Subject name' },
              { name: 'code', label: 'Subject code' },
              { name: 'category', label: 'Category' },
              { name: 'duration', label: 'Default duration (minutes)', type: 'number' },
            ]}
            onSave={handleUpdateSubject}
          />
        )}

        {/* Delete Subject Confirmation Modal */}
        {deletingSubject && (
          <DeleteConfirmModal
            isOpen={Boolean(deletingSubject)}
            recordName={deletingSubject.name}
            recordType="subject"
            isDeleting={isDeleting}
            onConfirm={handleDeleteSubject}
            onClose={() => setDeletingSubject(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
