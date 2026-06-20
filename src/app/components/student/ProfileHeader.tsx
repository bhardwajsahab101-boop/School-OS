import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useSchool } from '../../../lib/SchoolContext'

type Student = {
  id: string
  displayId?: string
  full_name: string | null
  class_name: string | null
  parent_name: string | null
  parent_phone: string | null
  address: string | null
  gender: string | null
  date_of_birth: string | null
  admission_date: string | null
}

interface ProfileHeaderProps {
  student: Student
  attendanceRate: number
  feeStatus: 'Paid' | 'Outstanding'
  onUpdateStudent: (updated: Partial<Student>) => Promise<void>
  onAddFee: (months: string[], amount: number, status: 'paid' | 'pending') => void
  onOpenUploadDoc: () => void
  onExportReport: () => void
  onDeleteStudent: () => void
}

export default function ProfileHeader({
  student,
  attendanceRate,
  feeStatus,
  onUpdateStudent,
  onAddFee,
  onOpenUploadDoc,
  onExportReport,
  onDeleteStudent
}: ProfileHeaderProps) {
  // Modal states
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddFeeOpen, setIsAddFeeOpen] = useState(false)
  
  // Loading state
  const [isSaving, setIsSaving] = useState(false)
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([])
  const { schoolId, userRole } = useSchool()

  useEffect(() => {
    async function fetchClasses() {
      if (!schoolId) return
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: true })
        if (!error && data) {
          setClassesList(data)
        }
      } catch (e) {
        console.error('Failed to fetch classes:', e)
      }
    }
    void fetchClasses()
  }, [schoolId])

  // Edit form states
  const [editForm, setEditForm] = useState({
    full_name: student.full_name || '',
    class_name: student.class_name || '',
    parent_name: student.parent_name || '',
    parent_phone: student.parent_phone || '',
    address: student.address || '',
    gender: student.gender || '',
    date_of_birth: student.date_of_birth || '',
    admission_date: student.admission_date || ''
  })

  // Fee form states
  const [feeForm, setFeeForm] = useState({
    months: [] as string[],
    amount: 250,
    status: 'pending' as 'pending' | 'paid'
  })

  const toggleMonthSelection = (m: string) => {
    setFeeForm(prev => {
      const months = prev.months.includes(m)
        ? prev.months.filter(x => x !== m)
        : [...prev.months, m]
      return { ...prev, months }
    })
  }



  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onUpdateStudent(editForm)
      setIsEditOpen(false)
    } catch (err) {
      alert('Failed to update student profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddFeeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (feeForm.months.length === 0) {
      alert('Please select at least one month.')
      return
    }
    if (!feeForm.amount || feeForm.amount <= 0) {
      alert('Please enter a valid amount.')
      return
    }
    onAddFee(feeForm.months, feeForm.amount, feeForm.status)
    setFeeForm(prev => ({ ...prev, months: [] }))
    setIsAddFeeOpen(false)
  }



  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Student Info Group */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
          {/* Initials Avatar */}
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-black border border-indigo-200/20 shadow-md shadow-indigo-500/10 shrink-0">
            {student.full_name?.charAt(0).toUpperCase() || '?'}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-center sm:justify-start">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                {student.full_name}
              </h1>
              <span className="self-center inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/40">
                Class {student.class_name || 'Unassigned'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs text-slate-500 font-semibold">
              <p className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="10" r="4"/></svg>
                Parent: <strong className="text-slate-700 font-semibold">{student.parent_name || 'Not Listed'}</strong>
              </p>
              <p className="text-slate-300">|</p>
              <p className="uppercase tracking-wider">
                ID: {student.displayId || student.id.slice(0, 8)}
              </p>
            </div>

            {/* Status Badges Row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              {/* Attendance percentage badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                attendanceRate >= 90 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                  : attendanceRate >= 75 
                    ? 'bg-amber-50 text-amber-700 border-amber-100/50'
                    : 'bg-rose-50 text-rose-700 border-rose-100/50'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  attendanceRate >= 90 ? 'bg-emerald-500' : attendanceRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
                {attendanceRate}% Attendance
              </span>

              {/* Fee status badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                feeStatus === 'Paid'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                  : 'bg-amber-50 text-amber-700 border-amber-100/50'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  feeStatus === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                {feeStatus} Fees
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Dropdown/Menu */}
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3.5 shrink-0 border-t border-slate-50 pt-4 lg:pt-0 lg:border-t-0">
          {/* Edit Student */}
          <button
            type="button"
            onClick={() => {
              setEditForm({
                full_name: student.full_name || '',
                class_name: student.class_name || '',
                parent_name: student.parent_name || '',
                parent_phone: student.parent_phone || '',
                address: student.address || '',
                gender: student.gender || '',
                date_of_birth: student.date_of_birth || '',
                admission_date: student.admission_date || ''
              })
              setIsEditOpen(true)
            }}
            className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Profile
          </button>

          {/* Add Fee */}
          <button
            type="button"
            onClick={() => setIsAddFeeOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Add Fee
          </button>

          {/* Upload Document */}
          <button
            type="button"
            onClick={onOpenUploadDoc}
            className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4.5 py-2 rounded-xl font-bold text-xs shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Doc
          </button>

          {/* Export Report */}
          <button
            type="button"
            onClick={onExportReport}
            className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report
          </button>

          {/* Delete Student */}
          {userRole !== 'Teacher' && (
            <button
              type="button"
              onClick={() => {
                const confirmDelete = window.confirm(`Are you sure you want to permanently delete student ${student.full_name}? This will remove all their academic, attendance, and fee history.`)
                if (confirmDelete) {
                  onDeleteStudent()
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 hover:text-rose-750 px-4 py-2 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Student
            </button>
          )}
        </div>

      </div>

      {/* ================= EDIT MODAL ================= */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditOpen(false)} />
            
            <div className="relative inline-block w-full max-w-lg p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Edit Student Profile</h3>
                <button type="button" onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Student Full Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={editForm.full_name}
                      onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Class / Grade *</label>
                    <select
                      required
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
                      value={editForm.class_name || ''}
                      onChange={e => setEditForm({ ...editForm, class_name: e.target.value })}
                    >
                      <option value="">Select Class...</option>
                      {classesList.map(cls => (
                        <option key={cls.id} value={cls.name}>
                          Class {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Parent/Guardian Name</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={editForm.parent_name}
                      onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Parent Phone Number</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={editForm.parent_phone}
                      onChange={e => setEditForm({ ...editForm, parent_phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Gender</label>
                    <select
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={editForm.gender}
                      onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={editForm.date_of_birth}
                      onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Admission Date</label>
                    <input
                      type="date"
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={editForm.admission_date}
                      onChange={e => setEditForm({ ...editForm, admission_date: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Home Address</label>
                    <textarea
                      rows={2}
                      className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-slate-50 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-4.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 focus:outline-none transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD FEE MODAL ================= */}
      {isAddFeeOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddFeeOpen(false)} />
            
            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Bill Tuition Fee</h3>
                <button type="button" onClick={() => setIsAddFeeOpen(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleAddFeeSubmit} className="space-y-5">
                {/* Multi-month Grid Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Billed Months *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Jan', value: 'January' },
                      { label: 'Feb', value: 'February' },
                      { label: 'Mar', value: 'March' },
                      { label: 'Apr', value: 'April' },
                      { label: 'May', value: 'May' },
                      { label: 'Jun', value: 'June' },
                      { label: 'Jul', value: 'July' },
                      { label: 'Aug', value: 'August' },
                      { label: 'Sep', value: 'September' },
                      { label: 'Oct', value: 'October' },
                      { label: 'Nov', value: 'November' },
                      { label: 'Dec', value: 'December' }
                    ].map(m => {
                      const isSelected = feeForm.months.includes(m.value)
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => toggleMonthSelection(m.value)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer select-none active:scale-95 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tuition Fee Amount per Month (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    value={feeForm.amount}
                    onChange={e => setFeeForm({ ...feeForm, amount: parseInt(e.target.value) || 0 })}
                  />
                </div>

                {/* Payment Status Radio Cards */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Initial Status *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFeeForm(prev => ({ ...prev, status: 'pending' }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all active:scale-[0.98] flex flex-col justify-between h-20 ${
                        feeForm.status === 'pending'
                          ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                          feeForm.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                            : 'bg-slate-50 text-slate-500 border-slate-200/50'
                        }`}>
                          Pending
                        </span>
                        {feeForm.status === 'pending' && (
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold mt-1">Invoice billed, unpaid.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFeeForm(prev => ({ ...prev, status: 'paid' }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all active:scale-[0.98] flex flex-col justify-between h-20 ${
                        feeForm.status === 'paid'
                          ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                          feeForm.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                            : 'bg-slate-50 text-slate-500 border-slate-200/50'
                        }`}>
                          Paid
                        </span>
                        {feeForm.status === 'paid' && (
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold mt-1">Cleared instantly.</span>
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 flex gap-3 justify-end border-t border-slate-50 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setFeeForm(prev => ({ ...prev, months: [] }))
                      setIsAddFeeOpen(false)
                    }}
                    className="px-4.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 focus:outline-none transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Generate {feeForm.months.length > 0 ? `${feeForm.months.length} Bills` : 'Bill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
