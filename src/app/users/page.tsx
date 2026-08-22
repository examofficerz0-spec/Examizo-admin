'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { StudentStatsModal } from '@/components/ui/StudentStatsModal';
import { getAdminSwrCache, setAdminSwrCache, subscribeAdminSwrCache, broadcastAdminChange } from '@/lib/adminSwrCache';
import {
  Users,
  Search,
  UserPlus,
  ShieldCheck,
  Trash2,
  X,
  AlertTriangle,
  Shield,
  Edit3,
  BookOpen,
  Key,
  Eye,
  EyeOff,
  Bell,
  Send,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Layers,
  BarChart2,
  Copy,
  Check,
  Crown,
  Settings,
  Sparkles,
} from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'manage_questions', label: 'Manage & Add Questions', desc: 'Create, edit, and curate topic question bank' },
  { id: 'manage_courses', label: 'Manage Courses', desc: 'Create and update course subjects and marking schemes' },
  { id: 'manage_mock_tests', label: 'Manage Mock Tests', desc: 'Create and schedule mock tests' },
  { id: 'manage_users', label: 'Manage Users & Admins', desc: 'Onboard students and assign admin roles' },
  { id: 'view_audit_logs', label: 'View Audit Logs', desc: 'Access platform security logs and actions' },
];

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<'students' | 'admins'>('students');

  // Authenticated Admin State & Master Controller Detection
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  useEffect(() => {
    try {
      const match = document.cookie.match(/admin_token=([^;]+)/);
      if (match) {
        const payloadBase64 = match[1].split('.')[1];
        if (payloadBase64) {
          const info = JSON.parse(atob(payloadBase64));
          setCurrentAdmin(info);
        }
      }
    } catch (_) {}

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.admin) {
          setCurrentAdmin(data.admin);
        }
      })
      .catch(() => {});
  }, []);

  const isMasterController = Boolean(
    currentAdmin &&
      (currentAdmin.adminId === 'admin_master_1' ||
        currentAdmin.id === 'admin_master_1' ||
        currentAdmin.role === 'Super Admin' ||
        currentAdmin.email === 'admin' ||
        currentAdmin.name === 'Master Controller')
  );

  // Student State
  const initialCache = getAdminSwrCache<{ users?: any[]; admins?: any[]; courses?: any[] }>('admin_users_cache');
  const [users, setUsers] = useState<any[]>(initialCache?.users || []);
  const [selectedStatsStudentId, setSelectedStatsStudentId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(!initialCache?.users);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentCourseId, setStudentCourseId] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [studentError, setStudentError] = useState('');

  // Assign Course Modal State
  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState<any | null>(null);
  const [selectedCourseForStudent, setSelectedCourseForStudent] = useState<string>('');
  const [savingCourse, setSavingCourse] = useState(false);

  // Admin State & RBAC
  const [admins, setAdmins] = useState<any[]>(initialCache?.admins || []);
  const [courses, setCourses] = useState<any[]>(initialCache?.courses || []);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminRole, setAdminRole] = useState('Question Contributor');
  const [adminPermissions, setAdminPermissions] = useState<string[]>(['manage_questions']);
  const [adminAllowedCourses, setAdminAllowedCourses] = useState<string[]>(['all']);
  const [adminError, setAdminError] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Master Controller Credentials Modal State
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterName, setMasterName] = useState('Master Controller');
  const [masterUsername, setMasterUsername] = useState('admin');
  const [masterNewPassword, setMasterNewPassword] = useState('');
  const [masterConfirmPassword, setMasterConfirmPassword] = useState('');
  const [showMasterPass, setShowMasterPass] = useState(false);
  const [masterUpdating, setMasterUpdating] = useState(false);
  const [masterError, setMasterError] = useState('');

  // Password Visibility Toggle Map for Table Items
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Quick Password Reset Modal State
  const [quickResetModal, setQuickResetModal] = useState<{
    entity: any;
    targetType: 'student' | 'admin';
    newPass: string;
  } | null>(null);
  const [quickResetSubmitting, setQuickResetSubmitting] = useState(false);

  // Send Notification Modal State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifTab, setNotifTab] = useState<'create' | 'manage'>('create');
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [loadingSentNotifs, setLoadingSentNotifs] = useState(false);
  const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);
  const [notifTargetType, setNotifTargetType] = useState<'all' | 'user' | 'course'>('all');
  const [notifTargetUserId, setNotifTargetUserId] = useState<string>('');
  const [notifTargetCourseId, setNotifTargetCourseId] = useState<string>('');
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifMessage, setNotifMessage] = useState<string>('');
  const [notifType, setNotifType] = useState<'info' | 'alert' | 'announcement' | 'warning' | 'success'>('announcement');
  const [sendingNotif, setSendingNotif] = useState<boolean>(false);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCredential = (text: string, id: string, label: string = 'Credentials') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setNotifToast(`${label} copied to clipboard!`);
    setTimeout(() => {
      setCopiedId(null);
      setNotifToast(null);
    }, 3000);
  };

  const fetchSentNotifications = async () => {
    setLoadingSentNotifs(true);
    try {
      const res = await fetch('/api/admin/notifications');
      const data = await res.json();
      if (res.ok && Array.isArray(data.notifications)) {
        setSentNotifications(data.notifications);
      }
    } catch (e) {
      console.error('Error fetching sent notifications:', e);
    } finally {
      setLoadingSentNotifs(false);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    if (!confirm('Are you sure you want to remove this notification? It will be deleted permanently for all students.')) return;
    setDeletingNotifId(notifId);
    try {
      const res = await fetch(`/api/admin/notifications?id=${notifId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setNotifToast(data.message || 'Notification removed successfully!');
        setTimeout(() => setNotifToast(null), 3500);
        setSentNotifications((prev) => prev.filter((n) => String(n._id) !== String(notifId)));
      } else {
        alert(data.error || 'Failed to remove notification');
      }
    } catch (e) {
      alert('Error deleting notification');
    } finally {
      setDeletingNotifId(null);
    }
  };

  // Multi-Profile Grouping State
  const [expandedEmails, setExpandedEmails] = useState<{ [rootEmail: string]: boolean }>({});

  const toggleExpandEmail = (rootEmail: string) => {
    setExpandedEmails((prev) => ({ ...prev, [rootEmail]: !prev[rootEmail] }));
  };

  const getRootEmail = (u: any): string => {
    if (u.account_email) return u.account_email.toLowerCase().trim();
    const email = (u.email || '').toLowerCase().trim();
    if (email.includes('+')) {
      const [local, domain] = email.split('@');
      const baseLocal = local.split('+')[0];
      if (domain.includes('exammaster.internal') || domain.includes('internal')) {
        return `${baseLocal}@gmail.com`;
      }
      return `${baseLocal}@${domain}`;
    }
    return email;
  };

  const groupedUsers = useMemo(() => {
    const groups: { [rootEmail: string]: any[] } = {};
    const order: string[] = [];

    for (const u of users) {
      const root = getRootEmail(u);
      if (!groups[root]) {
        groups[root] = [];
        order.push(root);
      }
      groups[root].push(u);
    }

    return order.map((rootEmail) => {
      const groupList = groups[rootEmail];
      const primary =
        groupList.find((p) => p.email.toLowerCase() === rootEmail.toLowerCase()) ||
        groupList.find((p) => !p.email.includes('+')) ||
        groupList[0];
      const subProfiles = groupList.filter((p) => String(p._id) !== String(primary._id));

      return {
        rootEmail,
        primary,
        subProfiles,
      };
    });
  }, [users]);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      if (data && Array.isArray(data.courses)) {
        setCourses(data.courses);
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  };

  const openSendNotifForUser = (student?: any) => {
    fetchCourses();
    fetchUsers();
    setNotifTargetType(student ? 'user' : 'all');
    setNotifTargetUserId(student ? student._id : '');
    setNotifTargetCourseId('');
    setNotifTitle('');
    setNotifMessage('');
    setNotifTab('create');
    setShowNotificationModal(true);
    fetchSentNotifications();
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    setSendingNotif(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: notifTargetType,
          targetUserId: notifTargetUserId,
          targetCourseId: notifTargetCourseId,
          title: notifTitle,
          message: notifMessage,
          type: notifType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotifToast(data.message || 'Notification sent successfully!');
        setTimeout(() => setNotifToast(null), 3500);
        setShowNotificationModal(false);
        setNotifTitle('');
        setNotifMessage('');
        fetchSentNotifications();
      } else {
        alert(data.error || 'Failed to send notification');
      }
    } catch (e) {
      console.error(e);
      alert('Error sending notification');
    } finally {
      setSendingNotif(false);
    }
  };

  // Destructive action modal state
  const [activeActionModal, setActiveActionModal] = useState<{
    entity: any;
    targetType: 'student' | 'admin';
    type: 'suspend' | 'activate' | 'delete';
  } | null>(null);

  const openAssignCourseModal = (student: any) => {
    fetchCourses();
    setAssigningStudent(student);
    const existingId = student.locked_course_id?._id || student.locked_course_id || '';
    setSelectedCourseForStudent(existingId);
    setShowAssignCourseModal(true);
  };

  const handleSaveAssignedCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningStudent) return;

    setSavingCourse(true);
    try {
      const res = await fetch(`/api/users/${assigningStudent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_course',
          locked_course_id: selectedCourseForStudent || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotifToast(`Course batch updated for ${assigningStudent.name}!`);
        setTimeout(() => setNotifToast(null), 3500);
        setShowAssignCourseModal(false);
        fetchUsers();
      } else {
        alert(data.error || 'Failed to update course');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating course');
    } finally {
      setSavingCourse(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      if (courseFilter) params.set('course', courseFilter);

      const res = await fetch(`/api/users?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
        if (!searchQuery && !statusFilter && !courseFilter) {
          const cur = getAdminSwrCache<any>('admin_users_cache') || {};
          setAdminSwrCache('admin_users_cache', { ...cur, users: data.users });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const [adminsRes, coursesRes] = await Promise.all([
        fetch('/api/admins', { cache: 'no-store' }),
        fetch('/api/courses', { cache: 'no-store' }),
      ]);
      const adminsData = await adminsRes.json();
      const coursesData = await coursesRes.json();
      if (adminsData.admins) setAdmins(adminsData.admins);
      if (coursesData.courses) setCourses(coursesData.courses);
      const cur = getAdminSwrCache<any>('admin_users_cache') || {};
      setAdminSwrCache('admin_users_cache', {
        ...cur,
        admins: adminsData.admins || [],
        courses: coursesData.courses || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    // Live reactive subscription to users & admins cache
    const unsubscribe = subscribeAdminSwrCache<any>('admin_users_cache', (fresh) => {
      if (fresh) {
        if (Array.isArray(fresh.users)) setUsers(fresh.users);
        if (Array.isArray(fresh.admins)) setAdmins(fresh.admins);
        if (Array.isArray(fresh.courses)) setCourses(fresh.courses);
        setLoadingUsers(false);
      }
    });

    fetchCourses();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchUsers();
    } else {
      fetchAdmins();
    }
  }, [activeTab, searchQuery, statusFilter, courseFilter]);

  const handleRolePreset = (selectedRole: string) => {
    setAdminRole(selectedRole);
    if (selectedRole === 'Super Admin') {
      setAdminPermissions(['manage_questions', 'manage_courses', 'manage_mock_tests', 'manage_users', 'view_audit_logs']);
      setAdminAllowedCourses(['all']);
    } else if (selectedRole === 'Question Contributor') {
      setAdminPermissions(['manage_questions']);
      if (adminAllowedCourses.length === 0 || adminAllowedCourses.includes('all')) {
        setAdminAllowedCourses(courses.length > 0 ? [courses[0]._id] : ['all']);
      }
    } else if (selectedRole === 'Course Manager') {
      setAdminPermissions(['manage_courses', 'manage_questions']);
      setAdminAllowedCourses(['all']);
    } else if (selectedRole === 'Exam Controller') {
      setAdminPermissions(['manage_mock_tests', 'manage_questions']);
      setAdminAllowedCourses(['all']);
    }
  };

  const togglePermission = (permId: string) => {
    setAdminPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const toggleCoursePermission = (courseId: string) => {
    if (courseId === 'all') {
      if (adminAllowedCourses.includes('all')) {
        setAdminAllowedCourses(courses.length > 0 ? [courses[0]._id] : []);
      } else {
        setAdminAllowedCourses(['all']);
      }
      return;
    }

    setAdminAllowedCourses((prev) => {
      const filtered = prev.filter((c) => c !== 'all');
      if (filtered.includes(courseId)) {
        return filtered.filter((c) => c !== courseId);
      } else {
        return [...filtered, courseId];
      }
    });
  };

  const openCreateAdminModal = () => {
    setEditingAdmin(null);
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminRole('Question Contributor');
    setAdminPermissions(['manage_questions']);
    setAdminAllowedCourses(courses.length > 0 ? [courses[0]._id] : ['all']);
    setAdminError('');
    setShowAddAdminModal(true);
  };

  const openEditAdminModal = (admin: any) => {
    setEditingAdmin(admin);
    setAdminName(admin.name || '');
    setAdminEmail(admin.email || '');
    setAdminPassword('');
    setAdminRole(admin.role || 'Question Contributor');
    setAdminPermissions(
      admin.permissions ||
        (admin.role === 'Super Admin'
          ? ['manage_questions', 'manage_courses', 'manage_mock_tests', 'manage_users', 'view_audit_logs']
          : ['manage_questions'])
    );
    setAdminAllowedCourses(admin.allowed_courses || ['all']);
    setAdminError('');
    setShowAddAdminModal(true);
  };

  // Master Controller Credentials Modal Handler
  const openMasterCredentialsModal = () => {
    const masterObj = admins.find((a) => a._id === 'admin_master_1' || a.role === 'Super Admin') || currentAdmin;
    setMasterName(masterObj?.name || 'Master Controller');
    setMasterUsername(masterObj?.email || 'admin');
    setMasterNewPassword('');
    setMasterConfirmPassword('');
    setShowMasterPass(false);
    setMasterError('');
    setShowMasterModal(true);
  };

  const handleSaveMasterCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setMasterError('');

    if (masterNewPassword && masterNewPassword !== masterConfirmPassword) {
      setMasterError('New passwords do not match');
      return;
    }

    if (masterNewPassword && masterNewPassword.length < 4) {
      setMasterError('Password must be at least 4 characters long');
      return;
    }

    setMasterUpdating(true);
    try {
      const res = await fetch('/api/admins/master-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: masterName,
          username: masterUsername,
          newPassword: masterNewPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMasterError(data.error || 'Failed to update credentials');
      } else {
        setShowMasterModal(false);
        setNotifToast('Master Controller credentials updated successfully!');
        setTimeout(() => setNotifToast(null), 4000);
        setCurrentAdmin((prev: any) => ({
          ...prev,
          name: masterName,
          email: masterUsername,
        }));
        fetchAdmins();
        broadcastAdminChange('users');
      }
    } catch (err) {
      setMasterError('Network error occurred while saving credentials');
    } finally {
      setMasterUpdating(false);
    }
  };

  const handleManualOnboardStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          email: studentEmail,
          password: studentPassword,
          locked_course_id: studentCourseId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStudentError(data.error || 'Failed to onboard student');
      } else {
        setShowAddStudentModal(false);
        setStudentName('');
        setStudentEmail('');
        setStudentPassword('');
        setStudentCourseId('');
        setNotifToast(`Student ${studentName} onboarded successfully!`);
        setTimeout(() => setNotifToast(null), 3500);
        fetchUsers();
        broadcastAdminChange('users');
      }
    } catch (err: any) {
      setStudentError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setSubmitting(true);

    try {
      if (editingAdmin) {
        const res = await fetch(`/api/admins/${editingAdmin._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: adminName,
            role: adminRole,
            permissions: adminPermissions,
            allowed_courses: adminAllowedCourses,
            password: adminPassword || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setAdminError(data.error || 'Failed to update admin account');
        } else {
          setShowAddAdminModal(false);
          setNotifToast(`Admin permissions updated for ${adminName}!`);
          setTimeout(() => setNotifToast(null), 3500);
          fetchAdmins();
          broadcastAdminChange('users');
        }
      } else {
        const res = await fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: adminRole,
            permissions: adminPermissions,
            allowed_courses: adminAllowedCourses,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setAdminError(data.error || 'Failed to create admin account');
        } else {
          setShowAddAdminModal(false);
          setNotifToast(`New admin ${adminName} assigned successfully!`);
          setTimeout(() => setNotifToast(null), 3500);
          fetchAdmins();
          broadcastAdminChange('users');
        }
      }
    } catch (err) {
      setAdminError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickResetModal || !quickResetModal.newPass.trim()) return;

    setQuickResetSubmitting(true);
    try {
      if (quickResetModal.targetType === 'admin') {
        const res = await fetch(`/api/admins/${quickResetModal.entity._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: quickResetModal.newPass.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
          setNotifToast(`Password updated for admin ${quickResetModal.entity.name}!`);
          setTimeout(() => setNotifToast(null), 3500);
          setQuickResetModal(null);
          fetchAdmins();
          broadcastAdminChange('users');
        } else {
          alert(data.error || 'Failed to update password');
        }
      } else {
        const res = await fetch(`/api/users/${encodeURIComponent(quickResetModal.entity._id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset_password', new_password: quickResetModal.newPass.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
          setNotifToast(`Password updated for student ${quickResetModal.entity.name}!`);
          setTimeout(() => setNotifToast(null), 3500);
          setQuickResetModal(null);
          fetchUsers();
          broadcastAdminChange('users');
        } else {
          alert(data.error || 'Failed to update password');
        }
      }
    } catch (err) {
      alert('Error updating password');
    } finally {
      setQuickResetSubmitting(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!activeActionModal) return;
    const { entity, targetType, type } = activeActionModal;
    const targetId = entity._id || entity.id;

    try {
      if (targetType === 'admin') {
        const res = await fetch(`/api/admins/${targetId}`, { method: 'DELETE' });
        const data = await res.json();
        setActiveActionModal(null);
        if (!res.ok) {
          alert(data.error || 'Failed to delete admin');
        } else {
          setNotifToast(data.message || 'Admin account removed successfully!');
          setTimeout(() => setNotifToast(null), 3500);
        }
        fetchAdmins();
        broadcastAdminChange('users');
      } else {
        if (type === 'delete') {
          const res = await fetch(`/api/users/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
          const data = await res.json();
          setActiveActionModal(null);
          if (res.ok) {
            setNotifToast(data.message || 'Student account permanently deleted!');
            setTimeout(() => setNotifToast(null), 3500);
          } else {
            alert(data.error || 'Failed to delete student');
          }
        } else {
          const res = await fetch(`/api/users/${encodeURIComponent(targetId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: type }),
          });
          const data = await res.json();
          setActiveActionModal(null);
          if (res.ok) {
            setNotifToast(data.message || `Account ${type === 'suspend' ? 'suspended' : 'reinstated'} successfully!`);
            setTimeout(() => setNotifToast(null), 3500);
          }
        }
        fetchUsers();
        broadcastAdminChange('users');
      }
    } catch (err) {
      console.error(err);
      alert('Action execution failed');
    }
  };

  const masterAdminRecord = admins.find((a) => a._id === 'admin_master_1' || a.role === 'Super Admin');

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="User & Admin Management"
          subtitle="Manage student accounts, credentials, and configure administrative RBAC personnel (FR-36, FR-37)"
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Category Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('students')}
              className={`pb-3 px-5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'students'
                  ? 'border-brand-800 text-brand-800 dark:border-brand-500 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" /> Student Accounts
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`pb-3 px-5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'admins'
                  ? 'border-brand-800 text-brand-800 dark:border-brand-500 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Administrative Personnel
            </button>
          </div>

          {/* STUDENTS TAB CONTENT */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              {/* Quick Course Classification Summary Pills */}
              <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Classify By Course:</span>
                <button
                  type="button"
                  onClick={() => setCourseFilter('')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    courseFilter === ''
                      ? 'bg-[#0B192C] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All Courses ({users.length})
                </button>
                {courses.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setCourseFilter(c._id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      courseFilter === c._id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100'
                    }`}
                  >
                    📚 {c.name}
                  </button>
                ))}
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search students by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetchCourses();
                      fetchUsers();
                      setNotifTargetType('all');
                      setNotifTargetUserId('');
                      setNotifTargetCourseId('');
                      setNotifTitle('');
                      setNotifMessage('');
                      setShowNotificationModal(true);
                    }}
                    type="button"
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shrink-0 shadow-sm cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    Send Notification
                  </button>

                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    type="button"
                    className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shrink-0 shadow-sm cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Onboard New Student
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
                {loadingUsers ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading student accounts...</div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No student accounts found.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Student</th>
                        {isMasterController && <th className="p-4">Login & Password Credential</th>}
                        <th className="p-4">Locked Course</th>
                        <th className="p-4">XP Total</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {groupedUsers.map(({ rootEmail, primary: u, subProfiles }) => {
                        const hasSubProfiles = subProfiles.length > 0;
                        const isExpanded = !!expandedEmails[rootEmail];
                        const isGoogleUser = Boolean(
                          u.auth_provider === 'google' ||
                          !u.raw_password
                        );
                        const uPass = u.raw_password || '';
                        const isPassRevealed = !!revealedPasswords[u._id];

                        return (
                          <React.Fragment key={rootEmail}>
                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="p-4 font-semibold text-slate-900 dark:text-white">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStatsStudentId(u._id)}
                                  className="font-extrabold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors cursor-pointer flex items-center gap-1.5"
                                  title="Click to view student performance statistics"
                                >
                                  <span>{u.name}</span>
                                  <BarChart2 className="w-3.5 h-3.5 text-blue-500 opacity-60 hover:opacity-100" />
                                </button>
                                <div className="text-[11px] font-normal text-slate-500">{u.email}</div>

                                {hasSubProfiles && (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandEmail(rootEmail)}
                                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/70 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-300 font-extrabold rounded-lg border border-purple-200 dark:border-purple-800 text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                                    >
                                      <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                      <span>👥 +{subProfiles.length} Sub-Profile{subProfiles.length > 1 ? 's' : ''} Created</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Master Controller Password Credential View */}
                              {isMasterController && (
                                <td className="p-4">
                                  {isGoogleUser ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 shadow-2xs">
                                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                      </svg>
                                      <span>Google Sign-In</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                      <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                      <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                        {isPassRevealed ? uPass : '••••••••'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleRevealPassword(u._id)}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                        title={isPassRevealed ? 'Hide Password' : 'Show Password'}
                                      >
                                        {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => copyCredential(`Email: ${u.email}\nPassword: ${uPass}`, u._id, `${u.name}'s Password`)}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                                        title="Copy Login Credentials"
                                      >
                                        {copiedId === u._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setQuickResetModal({ entity: u, targetType: 'student', newPass: '' })}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                        title="Change / Reset Student Password"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                                {u.locked_course_id?.name ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] flex items-center gap-1.5 shadow-2xs">
                                      <Lock className="w-3 h-3 text-blue-600 shrink-0" />
                                      <span className="font-extrabold">{u.locked_course_id.name}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openAssignCourseModal(u)}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors text-[10px] font-bold cursor-pointer"
                                      title="Change Course Batch"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold rounded-lg text-[11px] border border-amber-200 dark:border-amber-800">
                                      Course Selection In-Progress
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openAssignCourseModal(u)}
                                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-md cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Assign Course
                                    </button>
                                  </div>
                                )}
                              </td>

                              <td className="p-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                                {(u.xp_total || 0).toLocaleString()} XP
                              </td>

                              <td className="p-4">
                                <span
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                                    u.status === 'Active'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                                  }`}
                                >
                                  {u.status || 'Active'}
                                </span>
                              </td>

                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openSendNotifForUser(u)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-md cursor-pointer"
                                    title="Send Private Notification"
                                  >
                                    <Bell className="w-3.5 h-3.5" />
                                  </button>

                                  {u.status === 'Active' ? (
                                    <button
                                      type="button"
                                      onClick={() => setActiveActionModal({ entity: u, targetType: 'student', type: 'suspend' })}
                                      className="px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
                                    >
                                      Suspend
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setActiveActionModal({ entity: u, targetType: 'student', type: 'activate' })}
                                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                                    >
                                      Reinstate
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setActiveActionModal({ entity: u, targetType: 'student', type: 'delete' })}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                    title="Permanently Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Collapsible Sub-Profiles Row */}
                            {hasSubProfiles && isExpanded && (
                              <tr className="bg-purple-50/30 dark:bg-purple-950/20 border-y border-purple-100 dark:border-purple-900/40">
                                <td colSpan={isMasterController ? 6 : 5} className="p-3 pl-8">
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
                                      <Users className="w-3.5 h-3.5 text-purple-600" />
                                      <span>Linked Sub-Profiles for {rootEmail} ({subProfiles.length})</span>
                                    </div>

                                    <div className="grid grid-cols-1 divide-y divide-purple-100 dark:divide-purple-900/30 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden shadow-2xs">
                                      {subProfiles.map((p) => {
                                        const isPSubGoogle = Boolean(
                                          p.auth_provider === 'google' ||
                                          !p.raw_password
                                        );
                                        const pPass = p.raw_password || '';
                                        const isPPassRevealed = !revealedPasswords[p._id];

                                        return (
                                          <div key={p._id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <div className="flex items-center gap-3">
                                              <span className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-extrabold flex items-center justify-center text-xs">
                                                {p.name.charAt(0).toUpperCase()}
                                              </span>
                                              <div>
                                                <p className="font-bold text-slate-900 dark:text-white text-xs">{p.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{p.email}</p>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                              {/* Course Tag */}
                                              <div>
                                                {p.locked_course_id?.name ? (
                                                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold rounded text-[10px] border border-blue-200 dark:border-blue-800">
                                                    {p.locked_course_id.name}
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] text-slate-400 italic">No Course</span>
                                                )}
                                              </div>

                                              {/* Master Password View for Sub-Profile */}
                                              {isMasterController && (
                                                isPSubGoogle ? (
                                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                                                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                                                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                                    </svg>
                                                    <span>Google Sign-In</span>
                                                  </div>
                                                ) : (
                                                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                                                    <Key className="w-3 h-3 text-amber-500" />
                                                    <span className="font-mono text-[10px] font-bold">
                                                      {isPPassRevealed ? pPass : '••••••'}
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleRevealPassword(p._id)}
                                                      className="p-0.5 hover:text-slate-900 cursor-pointer"
                                                    >
                                                      {isPPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => copyCredential(`Email: ${p.email}\nPassword: ${pPass}`, p._id, `${p.name}'s Password`)}
                                                      className="p-0.5 hover:text-blue-600 cursor-pointer"
                                                    >
                                                      {copiedId === p._id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                  </div>
                                                )
                                              )}

                                              {/* XP */}
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                                {(p.xp_total || 0).toLocaleString()} XP
                                              </span>

                                              {/* Status */}
                                              <span
                                                className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                  p.status === 'Active'
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                                }`}
                                              >
                                                {p.status}
                                              </span>

                                              {/* Actions */}
                                              <div className="flex items-center gap-1.5 ml-2">
                                                <button
                                                  type="button"
                                                  onClick={() => openAssignCourseModal(p)}
                                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer"
                                                >
                                                  <Edit3 className="w-3 h-3" /> Assign/Edit
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => openSendNotifForUser(p)}
                                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded cursor-pointer"
                                                  title="Send Notification"
                                                >
                                                  <Bell className="w-3.5 h-3.5" />
                                                </button>
                                                {p.status === 'Active' ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => setActiveActionModal({ entity: p, targetType: 'student', type: 'suspend' })}
                                                    className="px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded cursor-pointer"
                                                  >
                                                    Suspend
                                                  </button>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => setActiveActionModal({ entity: p, targetType: 'student', type: 'activate' })}
                                                    className="px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded cursor-pointer"
                                                  >
                                                    Reinstate
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => setActiveActionModal({ entity: p, targetType: 'student', type: 'delete' })}
                                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                                  title="Delete Profile"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ADMINS TAB CONTENT */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              {/* Master Controller Security Center Banner (Visible only if logged in as Master Controller) */}
              {isMasterController && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-[#0B192C] text-white border border-indigo-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold tracking-wide">Master Controller Security Hub</h4>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-400/30">
                          Primary Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Active Master Login ID: <strong className="text-white font-mono">{masterAdminRecord?.email || currentAdmin?.email || 'admin'}</strong> • Full Super Admin platform controls
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openMasterCredentialsModal}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0"
                  >
                    <Settings className="w-4 h-4" />
                    Change Master Login Credentials
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Administrative Credentials & Roles</h3>
                  <p className="text-xs text-slate-500">
                    Configure role-based access control (RBAC), specific action permissions, and assigned courses.
                  </p>
                </div>
                <button
                  onClick={openCreateAdminModal}
                  type="button"
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  Assign New Admin
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
                {loadingAdmins ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading admin credentials...</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Admin Personnel</th>
                        {isMasterController && <th className="p-4">Login & Password</th>}
                        <th className="p-4">Assigned Role</th>
                        <th className="p-4">Assigned Course Scope</th>
                        <th className="p-4">Action Permissions</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {admins.map((a) => {
                        const isSuper = a.role === 'Super Admin' || (a.permissions && a.permissions.includes('all'));
                        const isMasterRow = a._id === 'admin_master_1' || a.email === 'admin' || a.role === 'Super Admin';
                        const aPass = a.raw_password || (isSuper ? 'Admin@123456' : 'Admin@123456');
                        const isPassRevealed = !!revealedPasswords[a._id];

                        const allowedCourseNames = (a.allowed_courses || []).includes('all')
                          ? 'All Courses (Unrestricted)'
                          : (a.allowed_courses || [])
                              .map((cid: string) => courses.find((c) => c._id === cid)?.name || cid)
                              .join(', ');

                        return (
                          <tr key={a._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-4 font-semibold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                {isSuper ? (
                                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                                ) : (
                                  <Shield className="w-4 h-4 text-brand-700 dark:text-brand-400 shrink-0" />
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span>{a.name}</span>
                                    {isMasterRow && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[9px]">
                                        Master
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono font-normal text-slate-500">{a.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Password Credential Column (Only visible if logged in as Master Controller) */}
                            {isMasterController && (
                              <td className="p-4">
                                <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                  <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    {isPassRevealed ? aPass : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealPassword(a._id)}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                    title={isPassRevealed ? 'Hide Password' : 'Show Password'}
                                  >
                                    {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyCredential(`Username/Email: ${a.email}\nPassword: ${aPass}`, a._id, `${a.name}'s Password`)}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                                    title="Copy Credentials"
                                  >
                                    {copiedId === a._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  {!isMasterRow && (
                                    <button
                                      type="button"
                                      onClick={() => setQuickResetModal({ entity: a, targetType: 'admin', newPass: '' })}
                                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                      title="Reset Admin Password"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}

                            <td className="p-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                                  isSuper
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                                }`}
                              >
                                {a.role || 'Super Admin'}
                              </span>
                            </td>

                            <td className="p-4 max-w-xs">
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate" title={allowedCourseNames}>
                                  {allowedCourseNames || 'No Courses Assigned'}
                                </span>
                              </div>
                            </td>

                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {isSuper ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                    Full Platform Access
                                  </span>
                                ) : (a.permissions || []).length === 0 ? (
                                  <span className="text-[11px] text-slate-400 italic">No explicit actions</span>
                                ) : (
                                  (a.permissions || []).map((perm: string) => (
                                    <span
                                      key={perm}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                    >
                                      {ALL_PERMISSIONS.find((p) => p.id === perm)?.label || perm}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>

                            <td className="p-4 text-right">
                              {isMasterRow ? (
                                isMasterController ? (
                                  <button
                                    type="button"
                                    onClick={openMasterCredentialsModal}
                                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 ml-auto shadow-xs transition-all cursor-pointer"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                    Change Credentials
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-slate-400 italic">Primary Admin</span>
                                )
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEditAdminModal(a)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" /> Edit Access
                                  </button>
                                  <button
                                    onClick={() => setActiveActionModal({ entity: a, targetType: 'admin', type: 'delete' })}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title="Remove Admin Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MASTER CONTROLLER CREDENTIALS MODAL */}
      {showMasterModal && isMasterController && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Master Controller Credentials</h3>
                  <p className="text-[11px] text-slate-500">Update Master login identifier and master password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {masterError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{masterError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMasterCredentials} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Master Display Name
                </label>
                <input
                  type="text"
                  required
                  value={masterName}
                  onChange={(e) => setMasterName(e.target.value)}
                  placeholder="e.g. Master Controller"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Master Login ID / Username / Email
                </label>
                <input
                  type="text"
                  required
                  value={masterUsername}
                  onChange={(e) => setMasterUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">You will use this ID or username to log in to the admin portal.</p>
              </div>

              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-extrabold text-[11px]">
                  <Key className="w-3.5 h-3.5" />
                  <span>Update Password (Leave blank to keep unchanged)</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Master Password
                  </label>
                  <div className="relative">
                    <input
                      type={showMasterPass ? 'text' : 'password'}
                      value={masterNewPassword}
                      onChange={(e) => setMasterNewPassword(e.target.value)}
                      placeholder="Enter new master password..."
                      className="w-full p-2.5 pr-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMasterPass(!showMasterPass)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    >
                      {showMasterPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {masterNewPassword && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type={showMasterPass ? 'text' : 'password'}
                      value={masterConfirmPassword}
                      onChange={(e) => setMasterConfirmPassword(e.target.value)}
                      placeholder="Re-enter new master password..."
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMasterModal(false)}
                  className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={masterUpdating}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {masterUpdating ? 'Saving...' : 'Update Master Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK RESET PASSWORD MODAL (STUDENT / ADMIN) */}
      {quickResetModal && isMasterController && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200 dark:border-blue-900">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Set New Password for {quickResetModal.entity.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">{quickResetModal.entity.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickResetModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickResetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="text"
                  required
                  value={quickResetModal.newPass}
                  onChange={(e) => setQuickResetModal({ ...quickResetModal, newPass: e.target.value })}
                  placeholder="Enter new password (e.g. Student@2026)..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickResetModal(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickResetSubmitting || !quickResetModal.newPass.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {quickResetSubmitting ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Onboard New Student</h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {studentError && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{studentError}</div>}

            <form onSubmit={handleManualOnboardStudent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Student Email Address</label>
                <input
                  type="email"
                  required
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Password</label>
                <div className="relative">
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Password123"
                    className="w-full p-2 pr-9 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    title={showStudentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Course Batch <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={studentCourseId}
                  onChange={(e) => setStudentCourseId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                >
                  <option value="">-- Let Student Choose Course --</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      📚 {c.name} {c.category ? `(${c.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-800 hover:bg-brand-900 text-white font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Onboarding...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign / Edit Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-lg w-full shadow-lg my-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-800 dark:text-brand-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingAdmin ? 'Edit Admin Role & Permissions' : 'Assign New Admin Personnel'}
                </h3>
              </div>
              <button onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminError && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{adminError}</div>}

            <form onSubmit={handleSaveAdmin} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Username / Email</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingAdmin}
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="sarah@exammaster.com"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password {editingAdmin && <span className="font-normal text-slate-400">(Leave blank to keep unchanged)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required={!editingAdmin}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder={editingAdmin ? (editingAdmin.raw_password ? `Current: ${editingAdmin.raw_password}` : '••••••••') : 'Enter password...'}
                    className="w-full p-2 pr-9 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    title={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Administrative Role Preset</label>
                <select
                  value={adminRole}
                  onChange={(e) => handleRolePreset(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                >
                  <option value="Question Contributor">Question Contributor (Question Bank for Specific Courses)</option>
                  <option value="Super Admin">Super Admin (Full Unrestricted Platform Control)</option>
                  <option value="Course Manager">Course Manager (Curriculum & Questions)</option>
                  <option value="Exam Controller">Exam Controller (Mock Tests & Scoring)</option>
                  <option value="Custom">Custom Role (Manual Permission & Scope Configuration)</option>
                </select>
              </div>

              {/* Course Assignment Scope */}
              {adminRole !== 'Super Admin' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                      Assigned Course Responsibilities
                    </label>
                    <span className="text-[11px] text-slate-500">Restricts question bank & test edits</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50">
                      <input
                        type="checkbox"
                        checked={adminAllowedCourses.includes('all')}
                        onChange={() => toggleCoursePermission('all')}
                        className="rounded border-slate-300 text-brand-800 focus:ring-brand-500"
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">All Courses (Unrestricted Scope)</span>
                    </label>

                    {!adminAllowedCourses.includes('all') && (
                      <div className="pl-6 space-y-1">
                        {courses.length === 0 ? (
                          <div className="text-slate-400 italic">No courses found in database</div>
                        ) : (
                          courses.map((c) => (
                            <label key={c._id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50">
                              <input
                                type="checkbox"
                                checked={adminAllowedCourses.includes(c._id)}
                                onChange={() => toggleCoursePermission(c._id)}
                                className="rounded border-slate-300 text-brand-800 focus:ring-brand-500"
                              />
                              <span className="text-slate-800 dark:text-slate-200 font-medium">{c.name}</span>
                              <span className="text-[10px] text-slate-400">({c.description?.slice(0, 40)}...)</span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Permissions */}
              {adminRole !== 'Super Admin' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                    Specific Action Permissions
                  </label>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {ALL_PERMISSIONS.map((perm) => {
                      const isChecked = adminPermissions.includes(perm.id);
                      return (
                        <label key={perm.id} className="flex items-start gap-2.5 cursor-pointer p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.id)}
                            className="mt-0.5 rounded border-slate-300 text-brand-800 focus:ring-brand-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{perm.label}</div>
                            <div className="text-[10px] text-slate-500">{perm.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 dark:text-slate-300 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving Account...' : editingAdmin ? 'Update Access & Permissions' : 'Assign Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Action Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                activeActionModal.type === 'activate'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : activeActionModal.type === 'suspend'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {activeActionModal.targetType === 'admin'
                  ? 'Remove Admin Account'
                  : activeActionModal.type === 'suspend'
                  ? 'Suspend Account'
                  : activeActionModal.type === 'activate'
                  ? 'Reactivate Account'
                  : 'Delete Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Target: <strong className="text-slate-800 dark:text-slate-200">{activeActionModal.entity.name}</strong> ({activeActionModal.entity.email})
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className={`px-5 py-2.5 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                  activeActionModal.type === 'activate'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : activeActionModal.type === 'suspend'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                }`}
              >
                {activeActionModal.targetType === 'admin'
                  ? 'Confirm Removal'
                  : activeActionModal.type === 'suspend'
                  ? 'Confirm Suspension'
                  : activeActionModal.type === 'activate'
                  ? 'Confirm Reactivation'
                  : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notifToast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-slate-900 text-white font-bold text-xs rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notifToast}</span>
        </div>
      )}

      {/* Send Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Send Notification</h3>
                  <p className="text-[11px] text-slate-500">Deliver announcements, alerts, or personal student messages</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 gap-4 mb-2 pb-1">
              <button
                type="button"
                onClick={() => setNotifTab('create')}
                className={`pb-2 text-xs font-black transition-all border-b-2 cursor-pointer ${
                  notifTab === 'create'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                📢 Send New Notification
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotifTab('manage');
                  fetchSentNotifications();
                }}
                className={`pb-2 text-xs font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  notifTab === 'manage'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span>📋 Manage & Remove Sent ({sentNotifications.length})</span>
              </button>
            </div>

            {notifTab === 'create' ? (
              <form onSubmit={handleSendNotification} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Recipient Audience</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNotifTargetType('all')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        notifTargetType === 'all'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      📢 All Students
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTargetType('user')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        notifTargetType === 'user'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      👤 Single Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTargetType('course')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        notifTargetType === 'course'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      🏫 Course Batch
                    </button>
                  </div>
                </div>

                {notifTargetType === 'user' && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Target Student</label>
                    <select
                      value={notifTargetUserId}
                      onChange={(e) => setNotifTargetUserId(e.target.value)}
                      required
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">-- Choose Student --</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {notifTargetType === 'course' && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Course Batch</label>
                    <select
                      value={notifTargetCourseId}
                      onChange={(e) => setNotifTargetCourseId(e.target.value)}
                      required
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">-- Choose Course --</option>
                      {courses.length === 0 ? (
                        <option disabled value="">No courses available</option>
                      ) : (
                        courses.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} {c.category ? `(${c.category})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notification Category</label>
                  <select
                    value={notifType}
                    onChange={(e) => setNotifType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="announcement">📢 Announcement (Standard Update)</option>
                    <option value="alert">🚨 Urgent Alert (High Priority)</option>
                    <option value="info">ℹ️ General Info</option>
                    <option value="success">🎉 Success / Celebration</option>
                    <option value="warning">⚠️ System Warning</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notification Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. New Mock Test Published / Important Update"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Message Content</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter the notification message details for students..."
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowNotificationModal(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingNotif}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingNotif ? 'Sending...' : 'Deliver Notification'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                {loadingSentNotifs ? (
                  <div className="py-8 text-center text-slate-400 font-bold">Loading sent notifications...</div>
                ) : sentNotifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 font-bold">No active notifications found.</div>
                ) : (
                  sentNotifications.map((notif) => (
                    <div
                      key={notif._id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">{notif.title}</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                            {notif.type || 'Announcement'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                            Target: {notif.targetType === 'all' ? 'All Students' : notif.targetType === 'course' ? 'Course Batch' : 'Single User'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Sent on: {new Date(notif.created_at || Date.now()).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={deletingNotifId === String(notif._id)}
                        onClick={() => handleDeleteNotification(String(notif._id))}
                        className="p-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl transition-all flex items-center gap-1 font-bold text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
                        title="Remove notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingNotifId === String(notif._id) ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))
                )}
                <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowNotificationModal(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {showAssignCourseModal && assigningStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Assign Course Batch</h3>
                  <p className="text-[11px] text-slate-500">Assign or update locked course for student</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignCourseModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignedCourse} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white">{assigningStudent.name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{assigningStudent.email}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Course Batch
                </label>
                <select
                  value={selectedCourseForStudent}
                  onChange={(e) => setSelectedCourseForStudent(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                >
                  <option value="">-- No Course (Pending Selection) --</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      📚 {c.name} {c.category ? `(${c.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {savingCourse ? 'Saving...' : 'Lock Course Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Performance Statistics Modal */}
      {selectedStatsStudentId && (
        <StudentStatsModal
          studentId={selectedStatsStudentId}
          onClose={() => setSelectedStatsStudentId(null)}
        />
      )}
    </div>
  );
}
