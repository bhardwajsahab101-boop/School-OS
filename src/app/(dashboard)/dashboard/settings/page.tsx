'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../../lib/supabase'
import ClientAuth from '../../ClientAuth'
import { useSchool } from '../../../../lib/SchoolContext'

type SchoolInfo = {
  id: string
  name: string
  logo_url: string | null
  theme_color: string | null
  address: string | null
  phone: string | null
  email: string | null
  academic_session: string | null
}

type ClassItem = {
  id: string
  name: string
  monthly_fee?: number | null
  fee_id?: string | null
}

export default function SettingsPage() {
  const { schoolId, refreshSchool } = useSchool()

  // Tab state: 'school' | 'classes' | 'fees' | 'profile' | 'backup'
  const [activeTab, setActiveTab] = useState<'school' | 'classes' | 'fees' | 'profile' | 'backup'>('school')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 1. School Info Form State
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    id: schoolId || '',
    name: '',
    logo_url: null,
    theme_color: '#6366f1',
    address: '',
    phone: '',
    email: '',
    academic_session: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // 2. Classes Management State
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [newClassName, setNewClassName] = useState('')

  // 3. Fees Configuration State
  const [feeSettings, setFeeSettings] = useState<{ [classId: string]: string }>({})

  // 4. User Profile State
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Load All Data
  async function loadSettingsData() {
    if (!schoolId) return
    try {
      setLoading(true)

      // Fetch School Details
      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single()

      if (!schoolErr && schoolData) {
        setSchoolInfo({
          id: schoolData.id,
          name: schoolData.name || '',
          logo_url: schoolData.logo_url || null,
          theme_color: schoolData.theme_color || '#6366f1',
          address: schoolData.address || '',
          phone: schoolData.phone || '',
          email: schoolData.email || '',
          academic_session: schoolData.academic_session || ''
        })

        // Fetch Logo signed URL if present
        if (schoolData.logo_url) {
          const { data: urlData } = await supabase.storage
            .from('student-documents')
            .createSignedUrl(schoolData.logo_url, 3600) // 1 hour preview
          if (urlData?.signedUrl) {
            setLogoPreview(urlData.signedUrl)
          }
        }
      }

      // Fetch Classes & Fee Structures
      const { data: classesData, error: classesErr } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })

      if (!classesErr && classesData) {
        // Fetch fee structures
        const { data: feesData } = await supabase
          .from('fee_structure')
          .select('*')

        const mappedClasses = classesData.map((cls: any) => {
          const fee = feesData?.find((f: any) => f.class_id === cls.id)
          return {
            id: cls.id,
            name: cls.name,
            monthly_fee: fee ? Number(fee.monthly_fee) : null,
            fee_id: fee ? fee.id : null
          }
        })

        setClasses(mappedClasses)

        // Initialize Fee Settings Input Form Map
        const feeMap: { [classId: string]: string } = {}
        mappedClasses.forEach(c => {
          feeMap[c.id] = c.monthly_fee !== null && c.monthly_fee !== undefined ? String(c.monthly_fee) : ''
        })
        setFeeSettings(feeMap)
      }

      // Fetch Admin Auth Profile
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (!userErr && user) {
        setProfileEmail(user.email || '')
        setProfileName(user.user_metadata?.full_name || 'Admin User')
      }

    } catch (e) {
      console.error('Failed to load settings page:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (schoolId) {
      void loadSettingsData()
    }
  }, [schoolId])

  // 1. Save School Info Callback
  async function handleSaveSchoolInfo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      let uploadedLogoUrl = schoolInfo.logo_url

      if (logoFile) {
        const logoPath = `school-logos/${schoolInfo.id}_${Date.now()}_${logoFile.name}`
        console.log("Upload started")
        console.log("File selected", logoFile)
        console.log("Page visibility", document.visibilityState)
        console.log("Before upload")

        const { error: uploadErr } = await supabase.storage
          .from('student-documents')
          .upload(logoPath, logoFile, { upsert: true })

        if (uploadErr) {
          console.log("Upload failed")
          throw new Error(`Logo upload failed: ${uploadErr.message}`)
        }
        console.log("Upload success")
        uploadedLogoUrl = logoPath
      }

      const { error: updateErr } = await supabase
        .from('schools')
        .update({
          name: schoolInfo.name,
          logo_url: uploadedLogoUrl,
          theme_color: schoolInfo.theme_color,
          address: schoolInfo.address || null,
          phone: schoolInfo.phone || null,
          email: schoolInfo.email || null,
          academic_session: schoolInfo.academic_session || null
        })
        .eq('id', schoolInfo.id)

      if (updateErr) throw updateErr

      alert('School information updated successfully!')
      setLogoFile(null)
      // Refresh
      await refreshSchool()
      void loadSettingsData()
    } catch (err: any) {
      console.error(err)
      alert(`Error updating school info: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 2. Add Class Callback
  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault()
    if (!newClassName.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('classes')
        .insert({
          school_id: schoolId,
          name: newClassName.trim()
        })

      if (error) {
        if (error.code === '23505') {
          alert('A class with this name already exists.')
        } else {
          throw error
        }
      } else {
        setNewClassName('')
        alert('Class added successfully!')
        void loadSettingsData()
      }
    } catch (err: any) {
      console.error(err)
      alert(`Failed to add class: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Delete Class Callback
  async function handleDeleteClass(classId: string, className: string) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${className}"? This will remove all student mappings and configurations for this class.`
    )
    if (!confirmDelete) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)

      if (error) throw error

      alert('Class deleted successfully!')
      void loadSettingsData()
    } catch (err: any) {
      console.error(err)
      alert(`Failed to delete class: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 3. Save Fee Configuration Callback
  async function handleSaveFees(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const promises = Object.keys(feeSettings).map(async (classId) => {
        const feeStr = feeSettings[classId]
        const amount = feeStr !== '' ? Number(feeStr) : 0
        if (isNaN(amount) || amount < 0) return

        // Check if fee structure exists
        const matched = classes.find(c => c.id === classId)
        if (matched?.fee_id) {
          // Update
          return supabase
            .from('fee_structure')
            .update({ monthly_fee: amount })
            .eq('id', matched.fee_id)
        } else {
          // Insert
          return supabase
            .from('fee_structure')
            .insert({
              class_id: classId,
              monthly_fee: amount
            })
        }
      })

      await Promise.all(promises)
      alert('Fee configuration saved successfully!')
      void loadSettingsData()
    } catch (err: any) {
      console.error(err)
      alert(`Failed to save fee structure: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 4. Save User Profile Callback
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        email: profileEmail,
        data: { full_name: profileName }
      })

      if (error) throw error

      alert('User profile updated successfully! You may need to verify your email if you changed it.')
      void loadSettingsData()
    } catch (err: any) {
      console.error(err)
      alert(`Profile update failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Change Password Callback
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!password) {
      alert('Password cannot be empty.')
      return
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      alert('Password updated successfully!')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      console.error(err)
      alert(`Password update failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Logo file change handler
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("FILE CHANGE FIRED")

    const file = e.target.files?.[0]

    console.log("FILE:", file)

    if (!file) {
      console.log("NO FILE SELECTED")
      return
    }

    console.log("NAME:", file.name)
    console.log("TYPE:", file.type)
    console.log("SIZE:", file.size)

    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  // 5. BACKUP & EXPORTS
  // Clean values helper
  const esc = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`

  // Export Students CSV
  async function exportStudentsCSV() {
    if (!schoolId) return
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) {
        alert('No student records found to export.')
        return
      }

      const headers = [
        'ID',
        'Full Name',
        'Class Name',
        'Parent Name',
        'Parent Phone',
        'Gender',
        'Date of Birth',
        'Admission Date',
        'Address',
        'Created At'
      ]

      const rows = data.map(st => [
        esc(st.id),
        esc(st.full_name),
        esc(st.class_name),
        esc(st.parent_name),
        esc(st.parent_phone),
        esc(st.gender),
        esc(st.date_of_birth),
        esc(st.admission_date),
        esc(st.address),
        esc(st.created_at)
      ])

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
      triggerCSVDownload(csvContent, 'students_backup')
    } catch (e: any) {
      alert(`Failed to export students: ${e.message}`)
    }
  }

  // Export Attendance CSV
  async function exportAttendanceCSV() {
    if (!schoolId) return
    try {
      // Fetch attendance and join student info locally
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: false })

      if (attError) throw attError

      const { data: studentsData, error: studError } = await supabase
        .from('students')
        .select('id, full_name, class_name')
        .eq('school_id', schoolId)

      if (studError) throw studError

      if (!attendanceData || attendanceData.length === 0) {
        alert('No attendance logs found to export.')
        return
      }

      const headers = ['Attendance ID', 'Student Name', 'Class Name', 'Student ID', 'Date', 'Status']

      const rows = attendanceData.map(log => {
        const student = studentsData?.find(s => s.id === log.student_id)
        return [
          esc(log.id),
          esc(student?.full_name || 'Deleted Student'),
          esc(student?.class_name || 'N/A'),
          esc(log.student_id),
          esc(log.date),
          esc(log.status)
        ]
      })

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
      triggerCSVDownload(csvContent, 'attendance_backup')
    } catch (e: any) {
      alert(`Failed to export attendance: ${e.message}`)
    }
  }

  // Export Fees CSV
  async function exportFeesCSV() {
    if (!schoolId) return
    try {
      const { data: feesData, error: feesError } = await supabase
        .from('fees')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (feesError) throw feesError

      const { data: studentsData, error: studError } = await supabase
        .from('students')
        .select('id, full_name, class_name')
        .eq('school_id', schoolId)

      if (studError) throw studError

      if (!feesData || feesData.length === 0) {
        alert('No billing invoices found to export.')
        return
      }

      const headers = ['Fee Invoice ID', 'Student Name', 'Class Name', 'Student ID', 'Month', 'Amount (₹)', 'Status', 'Paid At', 'Created At']

      const rows = feesData.map(fee => {
        const student = studentsData?.find(s => s.id === fee.student_id)
        return [
          esc(fee.id),
          esc(student?.full_name || 'Deleted Student'),
          esc(student?.class_name || 'N/A'),
          esc(fee.student_id),
          esc(fee.month),
          fee.amount,
          esc(fee.status),
          esc(fee.paid_at),
          esc(fee.created_at)
        ]
      })

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
      triggerCSVDownload(csvContent, 'billing_fees_backup')
    } catch (e: any) {
      alert(`Failed to export fees: ${e.message}`)
    }
  }

  // Browser download trigger
  function triggerCSVDownload(csvContent: string, fileNamePrefix: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Configure school profile metadata, manage classes, fee charts, and export backups.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-white/70 backdrop-blur border border-slate-200/50 p-1.5 rounded-2xl shadow-sm overflow-x-auto gap-1">
          {[
            { id: 'school', label: 'School Information' },
            { id: 'classes', label: 'Classes Management' },
            { id: 'fees', label: 'Fee Configuration' },
            { id: 'profile', label: 'Admin Profile' },
            { id: 'backup', label: 'Backup & Export' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow shadow-indigo-550/25'
                  : 'text-slate-655 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loader Panel */}
        {loading ? (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 space-y-6 animate-pulse">
            <div className="h-6 bg-slate-100 rounded w-1/4" />
            <div className="space-y-3">
              <div className="h-11 bg-slate-100 rounded-xl w-full" />
              <div className="h-11 bg-slate-100 rounded-xl w-full" />
              <div className="h-11 bg-slate-100 rounded-xl w-full" />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">

              {/* 1. School Info Panel */}
              {activeTab === 'school' && (
                <form onSubmit={handleSaveSchoolInfo} className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">School Demographics</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">This data populates document headings, fee invoices, and attendance logs.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      {/* Name */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Name *</label>
                        <input
                          type="text"
                          required
                          value={schoolInfo.name}
                          onChange={e => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          placeholder="e.g. Little Stars Play School"
                        />
                      </div>

                      {/* Session */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Active Academic Session *</label>
                        <input
                          type="text"
                          required
                          value={schoolInfo.academic_session || ''}
                          onChange={e => setSchoolInfo({ ...schoolInfo, academic_session: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          placeholder="e.g. 2026-27 Session"
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Office Contact Number</label>
                        <input
                          type="text"
                          value={schoolInfo.phone || ''}
                          onChange={e => setSchoolInfo({ ...schoolInfo, phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          placeholder="e.g. +91 98765 43210"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Official Office Email</label>
                        <input
                          type="email"
                          value={schoolInfo.email || ''}
                          onChange={e => setSchoolInfo({ ...schoolInfo, email: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          placeholder="e.g. contact@littlestars.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-5">
                      {/* Logo Uploader */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Insignia / Logo</label>
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200/60 shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview ? (
                              <img src={logoPreview} alt="School Logo" className="object-cover w-full h-full" />
                            ) : (
                              <span className="text-2xl font-black text-slate-350">★</span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <label
                              htmlFor="logo-upload"
                              className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              Upload Image
                            </label>
                            <p className="text-[10px] text-slate-400 font-semibold">Supports PNG, JPG, or SVG. Max size 2MB.</p>
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physical Campus Address</label>
                        <textarea
                          rows={4}
                          value={schoolInfo.address || ''}
                          onChange={e => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white resize-none"
                          placeholder="e.g. 123 Education Lane, Sector 4, New Delhi"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-550/15 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Demographics'}
                    </button>
                  </div>
                </form>
              )}

              {/* 2. Classes Management Panel */}
              {activeTab === 'classes' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Class Directories</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Define student sections. This list feeds dropdown selectors inside adding/editing modals.</p>
                  </div>

                  {/* Add Class Form */}
                  <form onSubmit={handleAddClass} className="flex gap-3 max-w-md items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Class Identifier</label>
                      <input
                        type="text"
                        required
                        value={newClassName}
                        onChange={e => setNewClassName(e.target.value)}
                        placeholder="e.g. Nursery or Class 3"
                        className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving || !newClassName.trim()}
                      className="h-10 px-5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      Add Class
                    </button>
                  </form>

                  {/* Class Listing */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Active Registered Classes ({classes.length})</label>
                    
                    {classes.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 italic text-xs font-medium border border-slate-100 rounded-2xl bg-slate-50/20">
                        No custom classes set up yet. Define one above.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {classes.map(cls => (
                          <div
                            key={cls.id}
                            className="flex items-center justify-between p-4 border border-slate-150 rounded-2xl bg-slate-50/20 hover:bg-slate-50/50 hover:border-slate-250 transition-all group"
                          >
                            <span className="text-xs font-bold text-slate-750">Class {cls.name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(cls.id, cls.name)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1 hover:bg-white border border-transparent hover:border-slate-100 rounded-lg cursor-pointer"
                              title="Delete Class"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Fee Configuration Panel */}
              {activeTab === 'fees' && (
                <form onSubmit={handleSaveFees} className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Tuition Fee structures</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Establish standard monthly tuition amounts for each school grade. Helps automate single-click student invoice additions.</p>
                  </div>

                  {classes.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-xs font-medium border border-slate-100 rounded-2xl bg-slate-50/20">
                      Please register class directories first in the "Classes Management" tab.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                        <span>Class Directory</span>
                        <span>Monthly Standard Fee (₹)</span>
                      </div>

                      <div className="divide-y divide-slate-100 space-y-3.5">
                        {classes.map(cls => (
                          <div key={cls.id} className="grid grid-cols-2 items-center pt-3.5 first:pt-0">
                            <span className="text-xs font-bold text-slate-700">Class {cls.name}</span>
                            <div className="relative max-w-[180px]">
                              <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-slate-400 select-none">₹</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={feeSettings[cls.id] || ''}
                                onChange={e => setFeeSettings({ ...feeSettings, [cls.id]: e.target.value })}
                                className="w-full pl-7 pr-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-5 border-t border-slate-100 flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Fee Configuration'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* 4. Admin Profile Panel */}
              {activeTab === 'profile' && (
                <div className="space-y-8">
                  {/* Account settings */}
                  <form onSubmit={handleSaveProfile} className="space-y-5 pb-8 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Account Settings</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Manage administrative names and access emails.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Name */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Admin Full Name</label>
                        <input
                          type="text"
                          required
                          value={profileName}
                          onChange={e => setProfileName(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Login Email</label>
                        <input
                          type="email"
                          required
                          value={profileEmail}
                          onChange={e => setProfileEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {saving ? 'Updating...' : 'Update Account'}
                      </button>
                    </div>
                  </form>

                  {/* Password Reset */}
                  <form onSubmit={handleChangePassword} className="space-y-5">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Security & Credentials</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Ensure accounts use strong, unique authentication passes.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Password */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                        />
                      </div>

                      {/* Confirm */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 5. Backup & Export Panel */}
              {activeTab === 'backup' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Database Backups</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Export direct copies of key tables for storage, analytical mapping, or imports in spreadsheets.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    {/* Students backup */}
                    <div className="p-5 border border-slate-150 rounded-3xl bg-slate-50/20 flex flex-col justify-between h-44 shadow-sm hover:border-indigo-200/50 hover:bg-slate-50/50 transition-all group">
                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-slate-800 block">Students Directory Export</span>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">Full list of enrolled students containing names, birthdays, parents, addresses, and admission IDs.</p>
                      </div>
                      <button
                        type="button"
                        onClick={exportStudentsCSV}
                        className="w-full py-2 bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-98 cursor-pointer text-center"
                      >
                        Export Students CSV
                      </button>
                    </div>

                    {/* Attendance backup */}
                    <div className="p-5 border border-slate-150 rounded-3xl bg-slate-50/20 flex flex-col justify-between h-44 shadow-sm hover:border-indigo-200/50 hover:bg-slate-50/50 transition-all group">
                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-slate-800 block">Attendance History Export</span>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">Raw historical daily registration logs mapped with student names, classes, dates, and check-in statuses.</p>
                      </div>
                      <button
                        type="button"
                        onClick={exportAttendanceCSV}
                        className="w-full py-2 bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-98 cursor-pointer text-center"
                      >
                        Export Attendance CSV
                      </button>
                    </div>

                    {/* Fees backup */}
                    <div className="p-5 border border-slate-150 rounded-3xl bg-slate-50/20 flex flex-col justify-between h-44 shadow-sm hover:border-indigo-200/50 hover:bg-slate-50/50 transition-all group">
                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-slate-800 block">Billing & Receipts Export</span>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">All generated tuition invoices containing billed months, invoice amounts, paid dates, and payment status details.</p>
                      </div>
                      <button
                        type="button"
                        onClick={exportFeesCSV}
                        className="w-full py-2 bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-98 cursor-pointer text-center"
                      >
                        Export Fees CSV
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
      {/* Hidden logo file uploader - always mounted at DOM root */}
      <input
        type="file"
        accept="image/*"
        id="logo-upload"
        onChange={handleLogoChange}
        className="hidden"
      />
    </>
  )
}
