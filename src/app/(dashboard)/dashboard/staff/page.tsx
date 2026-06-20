'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../../../lib/supabase'
import ClientAuth from '../../ClientAuth'
import { useSchool } from '../../../../lib/SchoolContext'

type StaffMember = {
  id: string
  school_id: string
  user_id: string | null
  full_name: string
  email: string
  phone: string | null
  role: 'Teacher' | 'Admin' | 'Accountant' | 'Receptionist'
  status: 'Active' | 'Inactive'
  created_at: string
  assigned_classes?: string[]
}

type ClassItem = {
  id: string
  name: string
}

// Separate client for staff registration to avoid logging out the administrator
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
})

export default function StaffPage() {
  const { schoolId } = useSchool()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [classesList, setClassesList] = useState<ClassItem[]>([])
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

  // Add Staff Form State
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'Teacher' as 'Teacher' | 'Admin' | 'Accountant' | 'Receptionist',
    status: 'Active' as 'Active' | 'Inactive',
    password: '',
    assignedClasses: [] as string[]
  })

  // Edit Staff Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'Teacher' as 'Teacher' | 'Admin' | 'Accountant' | 'Receptionist',
    status: 'Active' as 'Active' | 'Inactive',
    assignedClasses: [] as string[]
  })

  // Load staff & classes
  async function loadData() {
    if (!schoolId) return
    try {
      setLoading(true)

      // 1. Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })
      
      setClassesList(classesData || [])

      // 2. Fetch staff members
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (staffErr) throw staffErr

      if (staffData) {
        // 3. Fetch teacher class assignments with normalized classes(name)
        const { data: assignmentsData } = await supabase
          .from('teacher_classes')
          .select('id, teacher_id, class_id, classes(name)')

        const mappedStaff = staffData.map((member: any) => {
          const assignments = assignmentsData
            ?.filter((a: any) => a.teacher_id === member.id)
            .map((a: any) => a.classes?.name)
            .filter(Boolean) || []

          return {
            ...member,
            assigned_classes: assignments
          }
        })

        setStaff(mappedStaff)
      }
    } catch (e) {
      console.error('Failed to load staff list:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return
    void loadData()
  }, [schoolId])

  // Create Staff Member Callback
  async function handleAddStaffSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.fullName || !addForm.email) {
      alert('Full Name and Email are required.')
      return
    }
    if (!schoolId) {
      alert('No active school selected.')
      return
    }

    setSaving(true)
    try {
      let createdUserId: string | null = null

      // Create Login credentials in Supabase Auth if password is set
      if (addForm.password) {
        if (addForm.password.length < 6) {
          alert('Password must be at least 6 characters.')
          setSaving(false)
          return
        }

        const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
          email: addForm.email,
          password: addForm.password,
          options: {
            data: {
              full_name: addForm.fullName,
              school_id: schoolId,
              role: addForm.role
            }
          }
        })

        if (signUpError) throw signUpError
        createdUserId = signUpData.user?.id || null
      }

      // Insert record into staff table
      const { data: newStaff, error: insertError } = await supabase
        .from('staff')
        .insert({
          school_id: schoolId,
          user_id: createdUserId,
          full_name: addForm.fullName,
          email: addForm.email,
          phone: addForm.phone || null,
          role: addForm.role,
          status: addForm.status
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Also create profile and school membership if user account was created
      if (createdUserId) {
        // 1. Create profile
        const { error: profileErr } = await supabase
          .from('profiles')
          .insert({
            id: createdUserId,
            full_name: addForm.fullName
          })
        if (profileErr) {
          console.warn('Failed to create profile for staff member:', profileErr.message)
        }

        // 2. Create school membership
        const { error: membershipErr } = await supabase
          .from('school_memberships')
          .insert({
            user_id: createdUserId,
            school_id: schoolId,
            role: addForm.role
          })
        if (membershipErr) {
          console.warn('Failed to create school membership for staff member:', membershipErr.message)
        }
      }

      // Insert teacher classes if roles match using normalized class_id lookup
      if (addForm.role === 'Teacher' && addForm.assignedClasses.length > 0 && newStaff) {
        const insertRows = addForm.assignedClasses.map(className => {
          const cls = classesList.find(c => c.name === className)
          return {
            teacher_id: newStaff.id,
            class_id: cls ? cls.id : null
          }
        }).filter(row => row.class_id !== null)

        if (insertRows.length > 0) {
          const { error: classesErr } = await supabase
            .from('teacher_classes')
            .insert(insertRows)

          if (classesErr) throw classesErr
        }
      }

      alert('Staff member created successfully!')
      setIsAddModalOpen(false)
      setAddForm({
        fullName: '',
        email: '',
        phone: '',
        role: 'Teacher',
        status: 'Active',
        password: '',
        assignedClasses: []
      })
      void loadData()

    } catch (err: any) {
      console.error(err)
      alert(`Error creating staff member: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Open edit modal helper
  function openEditModal(member: StaffMember) {
    setEditingStaff(member)
    setEditForm({
      fullName: member.full_name,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
      status: member.status,
      assignedClasses: member.assigned_classes || []
    })
    setIsEditModalOpen(true)
  }

  // Save Edit Staff Callback
  async function handleEditStaffSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingStaff) return

    setSaving(true)
    try {
      // 1. Update staff table
      const { error: updateError } = await supabase
        .from('staff')
        .update({
          full_name: editForm.fullName,
          email: editForm.email,
          phone: editForm.phone || null,
          role: editForm.role,
          status: editForm.status
        })
        .eq('id', editingStaff.id)

      if (updateError) throw updateError

      // 2. Refresh class assignments
      // First, delete old ones
      const { error: deleteClsError } = await supabase
        .from('teacher_classes')
        .delete()
        .eq('teacher_id', editingStaff.id)

      if (deleteClsError) throw deleteClsError

      // Insert new ones if role is Teacher using normalized class_id lookup
      if (editForm.role === 'Teacher' && editForm.assignedClasses.length > 0) {
        const insertRows = editForm.assignedClasses.map(className => {
          const cls = classesList.find(c => c.name === className)
          return {
            teacher_id: editingStaff.id,
            class_id: cls ? cls.id : null
          }
        }).filter(row => row.class_id !== null)

        if (insertRows.length > 0) {
          const { error: insertClsError } = await supabase
            .from('teacher_classes')
            .insert(insertRows)

          if (insertClsError) throw insertClsError
        }
      }

      alert('Staff profile updated successfully!')
      setIsEditModalOpen(false)
      setEditingStaff(null)
      void loadData()

    } catch (err: any) {
      console.error(err)
      alert(`Failed to save changes: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Delete Staff Callback
  async function handleDeleteStaff(memberId: string, name: string) {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently remove "${name}" from staff registers? This will clear all their class links.`
    )
    if (!confirmDelete) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      alert('Staff member deleted successfully.')
      void loadData()
    } catch (err: any) {
      console.error(err)
      alert(`Failed to delete staff: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Toggle checklist multi-select class helper
  const handleToggleAddClass = (className: string) => {
    setAddForm(prev => {
      const isAssigned = prev.assignedClasses.includes(className)
      const list = isAssigned
        ? prev.assignedClasses.filter(c => c !== className)
        : [...prev.assignedClasses, className]
      return { ...prev, assignedClasses: list }
    })
  }

  const handleToggleEditClass = (className: string) => {
    setEditForm(prev => {
      const isAssigned = prev.assignedClasses.includes(className)
      const list = isAssigned
        ? prev.assignedClasses.filter(c => c !== className)
        : [...prev.assignedClasses, className]
      return { ...prev, assignedClasses: list }
    })
  }

  // Overview stats cards memoization
  const stats = useMemo(() => {
    const total = staff.length
    const teachers = staff.filter(s => s.role === 'Teacher').length
    const active = staff.filter(s => s.status === 'Active').length

    // Count unique class assignments
    const assignedSet = new Set<string>()
    staff.forEach(s => {
      s.assigned_classes?.forEach(c => assignedSet.add(c))
    })

    return {
      total,
      teachers,
      active,
      assignedClasses: assignedSet.size
    }
  }, [staff])

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const normalizedSearch = searchTerm.toLowerCase()
      const matchesSearch =
        s.full_name.toLowerCase().includes(normalizedSearch) ||
        (s.phone && s.phone.includes(normalizedSearch)) ||
        s.email.toLowerCase().includes(normalizedSearch)

      const matchesRole = selectedRole === 'all' || s.role === selectedRole
      const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [staff, searchTerm, selectedRole, selectedStatus])

  // Initials calculation helper
  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Title & Action Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Staff Management</h1>
            <p className="text-slate-500 mt-1.5 font-medium">Manage teacher accounts, assign classes, and config roles.</p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-[0.98] whitespace-nowrap cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Add Staff Member
          </button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Staff */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Staff</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.total}</h3>
              )}
              <span className="text-[10px] font-semibold text-slate-400">Registered employees</span>
            </div>
            <div className="bg-indigo-50/60 text-indigo-600 p-3.5 rounded-xl border border-indigo-100/30 shrink-0">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>

          {/* Card 2: Total Teachers */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Teachers</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.teachers}</h3>
              )}
              <span className="text-[10px] font-semibold text-slate-400">Class educators</span>
            </div>
            <div className="bg-violet-50/60 text-violet-600 p-3.5 rounded-xl border border-violet-100/30 shrink-0">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
          </div>

          {/* Card 3: Active Staff */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Status</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{stats.active}</h3>
              )}
              <span className="text-[10px] font-semibold text-slate-400">Working profiles</span>
            </div>
            <div className="bg-emerald-50/60 text-emerald-600 p-3.5 rounded-xl border border-emerald-100/30 shrink-0">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Card 4: Assigned Classes */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Classes</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.assignedClasses}</h3>
              )}
              <span className="text-[10px] font-semibold text-slate-400">Covered directories</span>
            </div>
            <div className="bg-teal-50/60 text-teal-600 p-3.5 rounded-xl border border-teal-100/30 shrink-0">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white placeholder-slate-400 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>

          {/* Filtering selectors */}
          <div className="flex flex-wrap gap-3">
            {/* Role Filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-655 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="Teacher">Teacher</option>
              <option value="Admin">Admin</option>
              <option value="Accountant">Accountant</option>
              <option value="Receptionist">Receptionist</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-655 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Staff Table Card */}
        <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-20 text-center space-y-4 max-w-md mx-auto">
              <div className="mx-auto h-12 w-12 text-slate-400 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">No staff members found</h3>
              <p className="text-xs text-slate-400 font-medium">Verify your filters or start by creating a new account profile.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 pl-6">Profile</th>
                    <th className="py-4">Role</th>
                    <th className="py-4">Contact</th>
                    <th className="py-4">Assigned Classes</th>
                    <th className="py-4">Status</th>
                    <th className="py-4 text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map(member => (
                    <tr key={member.id} className="group hover:bg-slate-50/20 transition-colors">
                      {/* Initials & Full Name */}
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 border border-indigo-100 text-indigo-650 font-black flex items-center justify-center shadow-sm shrink-0">
                            {getInitials(member.full_name)}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/staff/${member.id}`}
                              className="text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors block truncate"
                            >
                              {member.full_name}
                            </Link>
                            <span className="text-[10px] text-slate-400 font-semibold truncate block mt-0.5" title={member.email}>
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                          member.role === 'Admin'
                            ? 'bg-violet-50 text-violet-700 border-violet-100/50'
                            : member.role === 'Teacher'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50'
                              : member.role === 'Accountant'
                                ? 'bg-amber-50 text-amber-700 border-amber-100/50'
                                : 'bg-slate-50 text-slate-600 border-slate-200/50'
                        }`}>
                          {member.role}
                        </span>
                      </td>

                      {/* Phone Contact */}
                      <td className="py-4 text-xs font-semibold text-slate-700">
                        {member.phone || '—'}
                      </td>

                      {/* Assigned Classes */}
                      <td className="py-4">
                        {member.role !== 'Teacher' ? (
                          <span className="text-[10px] font-bold text-slate-405 italic">N/A</span>
                        ) : member.assigned_classes && member.assigned_classes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {member.assigned_classes.map((cls, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50/50 text-indigo-700 border border-indigo-100/20">
                                {cls}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100/30">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-bold border select-none ${
                          member.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                            : 'bg-rose-50 text-rose-700 border-rose-100/50'
                        }`}>
                          <span className={`w-1.2 h-1.2 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {member.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/dashboard/staff/${member.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Profile"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Profile"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDeleteStaff(member.id, member.full_name)}
                            disabled={member.email === 'admin@school.com'} // Protected admin deletion
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                            title="Delete Account"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================= ADD STAFF MODAL ================= */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
            
            <div className="relative w-full max-w-xl bg-white shadow-xl rounded-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden transition-all transform">
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
                <h3 className="text-lg font-bold text-slate-900">Add New Staff Member</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-full hover:bg-slate-100 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
                </button>
              </div>

              <form onSubmit={handleAddStaffSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={addForm.fullName}
                      onChange={e => setAddForm({ ...addForm, fullName: e.target.value })}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={addForm.email}
                      onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="e.g. priya@school.com"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={addForm.phone}
                      onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Portal Password (For Logins)</label>
                    <input
                      type="password"
                      value={addForm.password}
                      onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Role */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Role *</label>
                    <select
                      value={addForm.role}
                      onChange={e => setAddForm({ ...addForm, role: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-semibold"
                    >
                      <option value="Teacher">Teacher</option>
                      <option value="Admin">Admin</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Receptionist">Receptionist</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status *</label>
                    <select
                      value={addForm.status}
                      onChange={e => setAddForm({ ...addForm, status: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-semibold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Assigned Classes Multi-select */}
                {addForm.role === 'Teacher' && (
                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Class Assignments (Multi-select)</label>
                    
                    {classesList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No classes loaded. Set classes up in settings page first.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {classesList.map(cls => {
                          const isAssigned = addForm.assignedClasses.includes(cls.name)
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => handleToggleAddClass(cls.name)}
                              className={`py-2 px-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer select-none active:scale-[0.97] flex items-center justify-between ${
                                isAssigned
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <span>{cls.name}</span>
                              {isAssigned && <span className="text-indigo-600">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end shrink-0 bg-slate-50/10">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4.5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Creating...' : 'Create Staff'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* ================= EDIT STAFF MODAL ================= */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
            
            <div className="relative w-full max-w-xl bg-white shadow-xl rounded-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden transition-all transform">
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
                <h3 className="text-lg font-bold text-slate-900">Edit Staff Profile</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-full hover:bg-slate-100 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
                </button>
              </div>

              <form onSubmit={handleEditStaffSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.fullName}
                      onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="e.g. priya@school.com"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status *</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-semibold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Role selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Role *</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value as any })}
                    disabled={editingStaff?.email === 'admin@school.com'} // Protected admin role
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-semibold disabled:opacity-40"
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="Admin">Admin</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Receptionist">Receptionist</option>
                  </select>
                </div>

                {/* Assigned Classes Selection */}
                {editForm.role === 'Teacher' && (
                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Class Assignments (Multi-select)</label>
                    
                    {classesList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No classes loaded. Set classes up in settings page first.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {classesList.map(cls => {
                          const isAssigned = editForm.assignedClasses.includes(cls.name)
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => handleToggleEditClass(cls.name)}
                              className={`py-2 px-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer select-none active:scale-[0.97] flex items-center justify-between ${
                                isAssigned
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <span>{cls.name}</span>
                              {isAssigned && <span className="text-indigo-600">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end shrink-0 bg-slate-50/10">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4.5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
