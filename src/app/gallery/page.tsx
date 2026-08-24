'use client';

import React, { useState, useEffect } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminAccessGuard } from '@/components/layout/AdminAccessGuard';
import { getAdminSwrCache, setAdminSwrCache, subscribeAdminSwrCache, broadcastAdminChange } from '@/lib/adminSwrCache';
import { 
  Plus, 
  Search, 
  Image as ImageIcon, 
  Trash2, 
  Edit, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  X,
  ArrowUpDown
} from 'lucide-react';

interface GalleryItem {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  display_order: number;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIES = [
  'All',
  'Exam Halls',
  'Classrooms',
  'Campus & Facilities',
  'Award Ceremony',
  'Events & Seminars',
  'General',
];

const DEFAULT_PRESET_IMAGES = [
  '/images/exam_hall_1.jpg',
  '/images/exam_hall_2.jpg',
  '/images/exam_hall_3.jpg',
  '/images/exam_hall_4.jpg',
];

export default function AdminGalleryPage() {
  const initialCache = getAdminSwrCache<GalleryItem[]>('admin_gallery_cache');
  const [items, setItems] = useState<GalleryItem[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    category: 'Exam Halls',
    display_order: 0,
    is_active: true,
  });

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.gallery)) {
        setItems(data.gallery);
        setAdminSwrCache('admin_gallery_cache', data.gallery);
      }
    } catch (e) {
      console.error('Failed to load gallery items:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Live reactive subscription to gallery cache
    const unsubscribe = subscribeAdminSwrCache<GalleryItem[]>('admin_gallery_cache', (fresh) => {
      if (Array.isArray(fresh)) {
        setItems(fresh);
        setLoading(false);
      }
    });

    fetchGallery();

    return () => unsubscribe();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      description: '',
      image_url: '',
      category: 'Exam Halls',
      display_order: items.length + 1,
      is_active: true,
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      image_url: item.image_url,
      category: item.category || 'General',
      display_order: item.display_order || 0,
      is_active: Boolean(item.is_active),
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((prev) => ({ ...prev, image_url: reader.result as string }));
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.image_url.trim()) {
      setErrorMsg('Title and Image are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      if (editingItem) {
        const res = await fetch(`/api/gallery/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg('Photo updated successfully!');
          setIsModalOpen(false);
          fetchGallery();
        } else {
          setErrorMsg(data.error || 'Failed to update photo');
        }
      } else {
        const res = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg('New photo added to gallery!');
          setIsModalOpen(false);
          fetchGallery();
        } else {
          setErrorMsg(data.error || 'Failed to add photo');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Photo deleted from gallery.');
        fetchGallery();
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const handleToggleStatus = async (item: GalleryItem) => {
    try {
      const newStatus = item.is_active ? 0 : 1;
      const res = await fetch(`/api/gallery/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, is_active: newStatus } : it))
        );
      }
    } catch (e) {
      console.error('Status toggle error:', e);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const activeCount = items.filter((it) => it.is_active === 1).length;
  const categoriesList = Array.from(new Set(items.map((it) => it.category).filter(Boolean)));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Gallery Showcase Management"
          subtitle="Add, curate, and organize high-resolution photos shown on the student portal"
        />

        <AdminAccessGuard permission="manage_gallery" pageTitle="Gallery Showcase">
          <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Public Media &amp; Showcase</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Gallery Showcase Management</h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
                Add, curate, and organize high-resolution photos of proctored exam halls, classrooms, facilities, and student events shown on the student portal.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenAdd}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Photo</span>
              </button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Photos</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{items.length}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Published Active Photos</span>
              <p className="text-2xl font-black text-emerald-600">{activeCount}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Categories</span>
              <p className="text-2xl font-black text-indigo-600">{categoriesList.length || 1}</p>
            </div>
          </div>

          {/* Notification Toasts */}
          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filter and Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search photos, title, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Gallery Items Grid */}
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-bold">
              Loading gallery media...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
              <ImageIcon className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No photos found</h3>
              <p className="text-xs text-slate-400">
                {searchTerm || selectedCategory !== 'All'
                  ? 'No photos matched your filter criteria.'
                  : 'Start by uploading photos of your exam rooms, campus, or award ceremonies.'}
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
              >
                Add First Photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e: any) => {
                          e.target.src = '/images/exam_hall_1.jpg';
                        }}
                      />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900/80 backdrop-blur-md text-white border border-white/10">
                          {item.category}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                            item.is_active
                              ? 'bg-emerald-500/90 text-white'
                              : 'bg-slate-800/90 text-slate-300'
                          }`}
                        >
                          {item.is_active ? 'Active' : 'Hidden'}
                        </button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="p-4 pt-1 space-y-1.5">
                      <h4 className="font-black text-slate-900 dark:text-white text-sm line-clamp-1">
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-slate-400">
                      Order: #{item.display_order}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Photo"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                        title="Delete Photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </main>
        </AdminAccessGuard>
      </div>

      {/* Upload/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    {editingItem ? 'Edit Gallery Photo' : 'Add Showcase Photo'}
                  </h3>
                  <p className="text-xs text-slate-400">Manage showcase visuals for the student portal</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Photo Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Examination Hall - Session 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category & Display Order */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Display Order</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">Short Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional brief description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Image Input Options */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Image Source <span className="text-rose-500">*</span>
                </label>
                
                {/* Direct Image URL input */}
                <input
                  type="text"
                  placeholder="Paste direct Image URL (https://...)"
                  value={formData.image_url.startsWith('data:') ? '[Uploaded File]' : formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                />

                {/* Local Upload Button */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Local Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">or pick a sample:</span>
                </div>

                {/* Preset sample buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DEFAULT_PRESET_IMAGES.map((preset, idx) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, image_url: preset })}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0"
                    >
                      Exam Hall #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Box */}
              {formData.image_url && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-slate-400">Live Preview:</span>
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.src = '/images/exam_hall_1.jpg';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Publish to Student Portal
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all flex items-center gap-2"
                >
                  {saving ? 'Saving...' : editingItem ? 'Update Photo' : 'Publish Photo'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
