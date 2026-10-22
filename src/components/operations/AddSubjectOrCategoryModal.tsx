'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { BookOpen, FolderPlus, Plus, Sparkles } from 'lucide-react';

interface AddSubjectOrCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'subject' | 'category';
  defaultCategory?: string;
  existingCategories: string[];
  onSaveSubject: (data: {
    name: string;
    code: string;
    category: string;
    duration: number;
    description?: string;
  }) => Promise<void>;
  onSaveCategory: (data: {
    categoryName: string;
    description?: string;
    initialSubject?: {
      name: string;
      code: string;
      duration: number;
    };
  }) => Promise<void>;
}

export function AddSubjectOrCategoryModal({
  isOpen,
  onClose,
  initialMode = 'subject',
  defaultCategory = '',
  existingCategories,
  onSaveSubject,
  onSaveCategory,
}: AddSubjectOrCategoryModalProps) {
  const [mode, setMode] = useState<'subject' | 'category'>(initialMode);

  // Subject fields
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || (existingCategories[0] || 'General'));
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [duration, setDuration] = useState('60');
  const [subjectDescription, setSubjectDescription] = useState('');

  // Category fields
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [includeInitialSubject, setIncludeInitialSubject] = useState(true);
  const [catSubjectName, setCatSubjectName] = useState('');
  const [catSubjectCode, setCatSubjectCode] = useState('');
  const [catDuration, setCatDuration] = useState('60');

  // Status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      if (defaultCategory) {
        setSelectedCategory(defaultCategory);
        setIsCustomCategory(false);
      } else if (existingCategories.length > 0) {
        setSelectedCategory(existingCategories[0]);
        setIsCustomCategory(false);
      }
    }
  }, [isOpen, initialMode, defaultCategory, existingCategories]);

  const handleClose = () => {
    if (saving) return;
    setError(null);
    setSubjectName('');
    setSubjectCode('');
    setCustomCategoryInput('');
    setIsCustomCategory(false);
    setCategoryName('');
    setCategoryDescription('');
    setCatSubjectName('');
    setCatSubjectCode('');
    onClose();
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isCustomCategory ? customCategoryInput.trim() : selectedCategory.trim();

    if (!subjectName.trim()) {
      setError('Subject name is required.');
      return;
    }
    if (!subjectCode.trim()) {
      setError('Subject code is required.');
      return;
    }
    if (!finalCategory) {
      setError('Please select or specify a category.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSaveSubject({
        name: subjectName.trim(),
        code: subjectCode.trim().toUpperCase(),
        category: finalCategory,
        duration: Number(duration) || 60,
        description: subjectDescription.trim(),
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setError('Category name is required.');
      return;
    }

    let initialSubjectData: { name: string; code: string; duration: number } | undefined;
    if (includeInitialSubject) {
      if (!catSubjectName.trim()) {
        setError('Initial subject name is required when included.');
        return;
      }
      if (!catSubjectCode.trim()) {
        setError('Initial subject code is required when included.');
        return;
      }
      initialSubjectData = {
        name: catSubjectName.trim(),
        code: catSubjectCode.trim().toUpperCase(),
        duration: Number(catDuration) || 60,
      };
    }

    setSaving(true);
    setError(null);
    try {
      await onSaveCategory({
        categoryName: categoryName.trim(),
        description: categoryDescription.trim(),
        initialSubject: initialSubjectData,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <span>Add Academic Record</span>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('subject');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              mode === 'subject'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('category');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              mode === 'category'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Tab 1: Add Subject */}
        {mode === 'subject' && (
          <form onSubmit={handleSubjectSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Calculus"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subject Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MATH-201"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 underline"
                >
                  {isCustomCategory ? 'Pick existing category' : '+ Create new category'}
                </button>
              </div>

              {isCustomCategory ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    required
                    placeholder="Enter new category name (e.g. Robotics & Coding)"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-indigo-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    This new category will be automatically registered and grouped.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsCustomCategory(true);
                      setCustomCategoryInput('');
                    } else {
                      setSelectedCategory(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__new__">+ Create new category...</option>
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Default Duration (Minutes) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  required
                  placeholder="60"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Topic (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Derivatives, Integrals & Series"
                  value={subjectDescription}
                  onChange={(e) => setSubjectDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" isLoading={saving} type="submit">
                Add Subject
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Add Category */}
        {mode === 'category' && (
          <form onSubmit={handleCategorySubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Category Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Robotics, Artificial Intelligence, World Languages"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Category Notes / Curriculum Description (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. STEM programs, laboratory modules, and tech workshops"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Initial Subject Group */}
            <div className="pt-2 border-t border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 mb-2">
                <input
                  type="checkbox"
                  checked={includeInitialSubject}
                  onChange={(e) => setIncludeInitialSubject(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Create initial subject under this category</span>
              </label>

              {includeInitialSubject && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        First Subject Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={includeInitialSubject}
                        placeholder="e.g. Introduction to Robotics"
                        value={catSubjectName}
                        onChange={(e) => setCatSubjectName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Subject Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={includeInitialSubject}
                        placeholder="e.g. ROBO-101"
                        value={catSubjectCode}
                        onChange={(e) => setCatSubjectCode(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min="15"
                      step="15"
                      placeholder="60"
                      value={catDuration}
                      onChange={(e) => setCatDuration(e.target.value)}
                      className="w-full sm:w-1/2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" isLoading={saving} type="submit">
                Add Category {includeInitialSubject ? '& Subject' : ''}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
