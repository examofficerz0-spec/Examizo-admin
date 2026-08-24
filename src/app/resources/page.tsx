'use client';

import React, { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminAccessGuard } from '@/components/layout/AdminAccessGuard';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { getAdminSwrCache, setAdminSwrCache } from '@/lib/adminSwrCache';
import {
  FolderDown,
  Plus,
  Search,
  BookOpen,
  FileText,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  CheckCircle2,
  X,
  Filter,
  Upload
} from 'lucide-react';

interface CourseItem {
  _id: string;
  name: string;
  category?: string;
  subjects?: string[];
}

interface ResourceItem {
  _id: string;
  course_id: string;
  title: string;
  description?: string;
  subject?: string;
  resource_type: 'PDF Book' | 'Study Notes' | 'Formula Sheet' | 'Reference Manual';
  file_url: string;
  file_size?: string;
  page_count?: number;
  is_active: boolean;
  created_at?: string;
}

export default function AdminResourcesPage() {
  const initialCache = getAdminSwrCache<{ courses: CourseItem[]; resources: ResourceItem[] }>('admin_resources_cache');
  const [courses, setCourses] = useState<CourseItem[]>(initialCache?.courses || []);
  const [resources, setResources] = useState<ResourceItem[]>(initialCache?.resources || []);
  const [loading, setLoading] = useState(!initialCache);

  // Filter State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);

  // Form State
  const [formCourseId, setFormCourseId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubject, setFormSubject] = useState('Physics');
  const [formResourceType, setFormResourceType] = useState<'PDF Book' | 'Study Notes' | 'Formula Sheet' | 'Reference Manual'>('PDF Book');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileSize, setFormFileSize] = useState('5.0 MB');
  const [formPageCount, setFormPageCount] = useState(120);

  // Local File Upload State
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [localFileName, setLocalFileName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleLocalPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please select a valid PDF file (.pdf)');
      return;
    }

    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    setFormFileSize(`${sizeInMb} MB`);
    setLocalFileName(file.name);

    if (!formTitle) {
      const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' ');
      setFormTitle(cleanName);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormFileUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/resources', { cache: 'no-store' });
      const data = await res.json();
      const newCache = {
        courses: data.courses || [],
        resources: data.resources || [],
      };
      setAdminSwrCache('admin_resources_cache', newCache);

      if (data.courses) setCourses(data.courses);
      if (data.resources) setResources(data.resources);

      if (data.courses && data.courses.length > 0 && !formCourseId) {
        setFormCourseId(data.courses[0]._id);
      }
    } catch (err) {
      console.error('Error fetching admin resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingResource(null);
    setFormTitle('');
    setFormDescription('');
    setFormSubject('Physics');
    setFormResourceType('PDF Book');
    setFormFileUrl('');
    setFormFileSize('5.0 MB');
    setFormPageCount(120);
    setUploadMode('file');
    setLocalFileName('');
    if (courses.length > 0) setFormCourseId(selectedCourseId !== 'All' ? selectedCourseId : courses[0]._id);
    setShowModal(true);
  };

  const handleOpenEdit = (res: ResourceItem) => {
    setEditingResource(res);
    setFormCourseId(res.course_id);
    setFormTitle(res.title);
    setFormDescription(res.description || '');
    setFormSubject(res.subject || 'General');
    setFormResourceType(res.resource_type || 'PDF Book');
    setFormFileUrl(res.file_url);
    setFormFileSize(res.file_size || '3.5 MB');
    setFormPageCount(res.page_count || 100);
    setUploadMode('url');
    setLocalFileName('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId || !formTitle || !formFileUrl) {
      alert('Please fill out Course, Title, and File URL.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        course_id: formCourseId,
        title: formTitle,
        description: formDescription,
        subject: formSubject,
        resource_type: formResourceType,
        file_url: formFileUrl,
        file_size: formFileSize,
        page_count: formPageCount,
      };

      if (editingResource) {
        await fetch(`/api/resources/${editingResource._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save resource.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await fetch(`/api/resources/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete resource');
    }
  };

  const getCourseName = (cId: string) => {
    const found = courses.find((c) => String(c._id) === String(cId));
    return found ? found.name : 'All Courses';
  };

  // Filtered resources
  const filtered = resources.filter((res) => {
    const matchesCourse = selectedCourseId === 'All' || String(res.course_id) === String(selectedCourseId);
    const matchesSearch =
      res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (res.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (res.resource_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  return (
    <AdminAccessGuard permission="manage_resources" pageTitle="Resource Center">
      <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Resource Center & Digital Book Management" />

        <main className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
          
          {/* Top Banner Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 shadow-xs">
                  <FolderDown className="w-6 h-6" />
                </span>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Course Resource & E-Book Management
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload and manage course-specific PDF textbooks, formula sheets, study notes, and reference manuals.
              </p>
            </div>

            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Resource / PDF Book
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search PDF books, title, subject..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Course Selector Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 shrink-0">Filter by Course:</span>
              <CustomSelect
                options={[
                  { value: 'All', label: `All Registered Courses (${courses.length})` },
                  ...courses.map((c) => ({ value: c._id, label: c.name, badge: c.category })),
                ]}
                value={selectedCourseId}
                onChange={(val) => setSelectedCourseId(val)}
                className="w-full md:w-64"
              />
            </div>
          </div>

          {/* Resources Data Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 h-56 animate-pulse space-y-4 shadow-xs">
                  <div className="h-5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
                <FolderDown className="w-10 h-10 text-slate-400 stroke-[1.5]" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">No Resources Added Yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Click &apos;Add New Resource / PDF Book&apos; above to upload study materials for your courses.
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item._id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-blue-500/50 transition-all space-y-4 group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                        {item.resource_type}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {item.subject || 'General'}
                      </span>
                    </div>

                    {/* Course Tag */}
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">
                      📚 {getCourseName(item.course_id)}
                    </p>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed font-medium">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Details & Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      <span>📄 {item.page_count || 100} Pages</span>
                      <span>💾 {item.file_size || '3.5 MB'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Link
                      </a>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Edit Resource"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 transition-colors cursor-pointer"
                        title="Delete Resource"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* ADD / EDIT RESOURCE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FolderDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {editingResource ? 'Edit Course Resource' : 'Add New PDF Book / Resource'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs font-medium">
              
              {/* Course Selector */}
              <div className="space-y-1">
                <label className="text-slate-700 dark:text-slate-300 font-extrabold">Target Course *</label>
                <select
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.category || 'Exam'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource Title */}
              <div className="space-y-1">
                <label className="text-slate-700 dark:text-slate-300 font-extrabold">Resource Title / Book Name *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Organic Chemistry Complete Concept Book & Mechanisms"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Subject Tag */}
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-extrabold">Subject</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Physics, Chemistry, Math, etc."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Resource Type */}
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-extrabold">Resource Type</label>
                  <select
                    value={formResourceType}
                    onChange={(e: any) => setFormResourceType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="PDF Book">PDF Book</option>
                    <option value="Study Notes">Study Notes</option>
                    <option value="Formula Sheet">Formula Sheet</option>
                    <option value="Reference Manual">Reference Manual</option>
                  </select>
                </div>
              </div>

              {/* PDF File Source Switcher: Local Upload vs URL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 dark:text-slate-300 font-extrabold">PDF / Resource File *</label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        uploadMode === 'file'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      📁 Upload Local PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('url')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        uploadMode === 'url'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      🔗 PDF File URL
                    </button>
                  </div>
                </div>

                {uploadMode === 'file' ? (
                  <div className="space-y-2">
                    <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-5 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all cursor-pointer group text-center">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleLocalPdfChange}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform mb-1.5" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {localFileName ? `Selected: ${localFileName}` : 'Click to select or drag & drop PDF from local system'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Supports local PDF files up to 50MB</span>
                    </label>

                    {localFileName && (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold truncate">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{localFileName}</span>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-mono">
                            {formFileSize}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalFileName('');
                            setFormFileUrl('');
                          }}
                          className="text-rose-600 hover:text-rose-700 text-xs font-bold shrink-0 ml-2 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    value={formFileUrl}
                    onChange={(e) => setFormFileUrl(e.target.value)}
                    placeholder="https://example.com/books/sample.pdf or /pdf/file.pdf"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-[11px]"
                    required={uploadMode === 'url'}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* File Size */}
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-extrabold">File Size</label>
                  <input
                    type="text"
                    value={formFileSize}
                    onChange={(e) => setFormFileSize(e.target.value)}
                    placeholder="e.g. 14.5 MB"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Page Count */}
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-extrabold">Page Count</label>
                  <input
                    type="number"
                    value={formPageCount}
                    onChange={(e) => setFormPageCount(parseInt(e.target.value, 10) || 0)}
                    placeholder="120"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-slate-700 dark:text-slate-300 font-extrabold">Description / Notes</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief overview of what this PDF book or formula sheet covers..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingResource ? 'Update Resource' : 'Publish Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminAccessGuard>
  );
}
