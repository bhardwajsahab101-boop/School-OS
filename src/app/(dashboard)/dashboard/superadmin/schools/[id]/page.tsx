'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../../lib/supabase'
import { useSchool } from '../../../../../../lib/SchoolContext'
import ClientAuth from '../../../../ClientAuth'

type SchoolDetails = {
  id: string
  name: string
  logo_url: string | null
  theme_color: string | null
  address: string | null
  phone: string | null
  email: string | null
  academic_session: string | null
  status: 'pending' | 'approved' | 'suspended'
  subscription_status: 'trial' | 'active' | 'inactive'
  created_at: string
}

export default function SuperAdminSchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { userRole } = useSchool()

  const [school, setSchool] = useState<SchoolDetails | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [academicSession, setAcademicSession] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [themeColor, setThemeColor] = useState('#6366f1')
  const [status, setStatus] = useState<'pending' | 'approved' | 'suspended'>('approved')
  const [subStatus, setSubStatus] = useState<'trial' | 'active' | 'inactive'>('active')

  // Diagnostics
  useEffect(() => {
    console.log("PAGE MOUNTED");
  }, []);

  useEffect(() => {
    console.log("LOGO FILE STATE", logoFile);
  }, [logoFile]);

  // Guard routing for non-SuperAdmins
  useEffect(() => {
    if (userRole && userRole !== 'SuperAdmin') {
      router.push('/dashboard')
    }
  }, [userRole, router])

  async function loadSchoolData() {
    if (!id) return
    try {
      setLoading(true)

      // 1. Fetch School Details
      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools')
        .select('*')
        .eq('id', id)
        .single()

      if (schoolErr) throw schoolErr
      if (schoolData) {
        setSchool(schoolData)
        setName(schoolData.name || '')
        setAcademicSession(schoolData.academic_session || '')
        setPhone(schoolData.phone || '')
        setEmail(schoolData.email || '')
        setAddress(schoolData.address || '')
        setThemeColor(schoolData.theme_color || '#6366f1')
        setStatus(schoolData.status || 'approved')
        setSubStatus(schoolData.subscription_status || 'active')

        // Logo preview - do not overwrite if a file is already selected/previewed locally
        if (!logoFile) {
          if (schoolData.logo_url) {
            if (schoolData.logo_url.startsWith('http')) {
              setLogoPreview(schoolData.logo_url)
            } else {
              const { data: urlData } = await supabase.storage
                .from('student-documents')
                .createSignedUrl(schoolData.logo_url, 3600)
              if (urlData?.signedUrl) {
                setLogoPreview(urlData.signedUrl)
              }
            }
          } else {
            setLogoPreview(null)
          }
        }
      }

    } catch (e: any) {
      console.error('Failed to load school details:', e)
      showNotification('error', `Failed to load details: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userRole === 'SuperAdmin') {
      void loadSchoolData()
    }
  }, [id, userRole])

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("FILE INPUT CHANGED");
    console.log(e.target.files);
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

    console.log("SETTING FILE STATE", file);
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      let uploadedLogoUrl = school?.logo_url || null

      if (logoFile) {
        const logoPath = `school-logos/${id}_${Date.now()}_${logoFile.name}`
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
          name,
          logo_url: uploadedLogoUrl,
          theme_color: themeColor,
          address: address || null,
          phone: phone || null,
          email: email || null,
          academic_session: academicSession || null,
          status,
          subscription_status: subStatus
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      showNotification('success', 'School settings updated successfully!')
      setLogoFile(null)
      void loadSchoolData()
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      showNotification('error', `Error updating settings: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Hidden file uploader - always mounted at DOM root to survive mobile background kills */}
      <input
        type="file"
        accept="image/*"
        id="logo-upload"
        onChange={handleLogoChange}
        className="hidden"
      />

      {userRole !== 'SuperAdmin' ? (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">This module is reserved for platform-wide Super Administrators.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-24 bg-slate-100 rounded-3xl" />
            <div className="h-24 bg-slate-100 rounded-3xl" />
            <div className="h-24 bg-slate-100 rounded-3xl" />
            <div className="h-24 bg-slate-100 rounded-3xl" />
          </div>
          <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-4">
            <div className="h-8 bg-slate-100 rounded w-1/3" />
            <div className="h-44 bg-slate-100 rounded-2xl w-full" />
          </div>
        </div>
      ) : !school ? (
        <div className="max-w-4xl mx-auto p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-black text-slate-800">School Tenant Not Found</h2>
          <p className="text-slate-500 max-w-sm mx-auto text-xs leading-relaxed font-semibold">The school identifier provided in the URL does not exist or has been deleted from the database.</p>
          <Link
            href="/dashboard/superadmin/schools"
            className="inline-flex items-center justify-center font-bold px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs cursor-pointer text-slate-700"
          >
            Return to Schools Directory
          </Link>
        </div>
      ) : (
        <>
          <ClientAuth />

      <div className="max-w-5xl mx-auto space-y-8 relative">
        {/* Floating Notification */}
        {notification && (
          <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-bounce ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
              : 'bg-rose-50 border-rose-250 text-rose-800'
          }`}>
            <span className="text-lg">{notification.type === 'success' ? '✓' : '⚠'}</span>
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
        )}

        {/* Navigation & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <Link
              href="/dashboard/superadmin/schools"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-650 transition-colors cursor-pointer group"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back to directory
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span>{school.name}</span>
              <span className={`text-[10px] font-black uppercase border tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                school.status === 'approved' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : school.status === 'pending'
                  ? 'bg-amber-50 border-amber-200 text-amber-700' 
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {school.status}
              </span>
            </h1>
          </div>
        </div>

        {/* Detailed Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">School Demographics</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Edit this tenant's public configuration profiles. This details populate dynamic reports and receipt structures.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* School Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Session */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Active Academic Session *</label>
                  <input
                    type="text"
                    required
                    value={academicSession}
                    onChange={e => setAcademicSession(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Office Contact Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Official Office Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Theme Color */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Theme Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="w-9 h-9 border-0 outline-none cursor-pointer p-0 bg-transparent rounded"
                    />
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">{themeColor}</span>
                  </div>
                </div>

                {/* Logo Uploader */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Insignia / Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-250 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {logoPreview ? (
                        <img src={logoPreview} alt="School Logo" className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-lg font-black text-slate-350">★</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer border border-indigo-150 shadow-sm active:scale-98"
                      >
                        Change Logo
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physical Campus Address</label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white resize-none font-medium"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-650 hover:from-indigo-750 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Demographics'}
                </button>
              </div>
            </form>
          </div>

          {/* Operational & Subscription Controls */}
          <div className="space-y-6">
            {/* Operational Panel */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Access & Status Control</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Toggle verification flags. Suspended status denies platform logins for all staff associated with this school.</p>
              </div>

              <div className="space-y-4">
                {/* Approval Status select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Verification Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-550/20 transition-all cursor-pointer"
                  >
                    <option value="approved">Approved (Operational)</option>
                    <option value="pending">Pending (Review In Progress)</option>
                    <option value="suspended">Suspended (Blocked Access)</option>
                  </select>
                </div>

                {/* Subscription Status select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subscription Plan State</label>
                  <select
                    value={subStatus}
                    onChange={e => setSubStatus(e.target.value as any)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-550/20 transition-all cursor-pointer"
                  >
                    <option value="trial">Trial Account (Free Tier)</option>
                    <option value="active">Active Subscription (Premium)</option>
                    <option value="inactive">Inactive / Overdue (Grace Lock)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* School Metadata card */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant Registration Info</h3>
              </div>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Tenant Identifier</span>
                  <span className="font-mono text-[10px] text-slate-700 bg-white border border-slate-150 px-1.5 py-0.5 rounded select-all">{school.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Created Date</span>
                  <span className="font-semibold text-slate-700">{new Date(school.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Workspace Accent</span>
                  <span className="font-mono font-semibold text-slate-700 uppercase" style={{ color: themeColor }}>{themeColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </>
  )
}
