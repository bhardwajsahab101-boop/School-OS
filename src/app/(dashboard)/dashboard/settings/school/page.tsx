'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { useSchool } from '../../../../../lib/SchoolContext'
import ClientAuth from '../../../ClientAuth'
import Link from 'next/link'

export default function SchoolSettingsPage() {
  const { schoolId, schoolDetails, refreshSchool, userRole } = useSchool()
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [academicSession, setAcademicSession] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [themeColor, setThemeColor] = useState('#6366f1')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // Diagnostics
  useEffect(() => {
    console.log("PAGE MOUNTED");
  }, []);

  useEffect(() => {
    console.log("LOGO FILE STATE", logoFile);
  }, [logoFile]);

  useEffect(() => {
    if (schoolDetails) {
      setName(schoolDetails.name || '')
      setAcademicSession(schoolDetails.academic_session || '')
      setPhone(schoolDetails.phone || '')
      setEmail(schoolDetails.email || '')
      setAddress(schoolDetails.address || '')
      setThemeColor(schoolDetails.theme_color || '#6366f1')
      
      // Load logo preview
      if (schoolDetails.logo_url) {
        if (schoolDetails.logo_url.startsWith('http')) {
          setLogoPreview(schoolDetails.logo_url)
        } else {
          // Fetch signed logo URL
          const fetchLogo = async () => {
            const { data } = await supabase.storage
              .from('student-documents')
              .createSignedUrl(schoolDetails.logo_url!, 3600)
            if (data?.signedUrl) {
              setLogoPreview(data.signedUrl)
            }
          }
          void fetchLogo()
        }
      } else {
        setLogoPreview(null)
      }
    }
  }, [schoolDetails])

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolId) {
      alert('No active school loaded.')
      return
    }
    if (userRole !== 'Admin' && userRole !== 'SuperAdmin') {
      alert('Access Denied: Only administrators can update school settings.')
      return
    }

    setSaving(true)

    try {
      let uploadedLogoUrl = schoolDetails?.logo_url || null

      if (logoFile) {
        const logoPath = `school-logos/${schoolId}_${Date.now()}_${logoFile.name}`
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
          academic_session: academicSession || null
        })
        .eq('id', schoolId)

      if (updateErr) throw updateErr

      alert('School settings updated successfully!')
      setLogoFile(null)
      await refreshSchool()
    } catch (err: any) {
      console.error('Failed to update school settings:', err)
      alert(`Error: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  if (!schoolId) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold">
        No active school loaded. Please verify your login credentials or memberships.
      </div>
    )
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-650 transition-colors cursor-pointer group"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back to settings directory
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">School Settings</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Manage corporate identities, logos, and academic metadata of your school.</p>
        </div>

        {/* Settings Panel */}
        <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden p-6 sm:p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">School Demographics</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">This information updates public receipts, student reports, and metadata.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                {/* School Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                    placeholder="e.g. Little Stars Play School"
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
                    placeholder="e.g. 2026-27 Session"
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
                    placeholder="e.g. +91 98765 43210"
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
                        className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer border border-indigo-150 active:scale-95 shadow-sm"
                      >
                        Upload Image
                      </label>
                      <p className="text-[10px] text-slate-400 font-semibold">Supports PNG, JPG, or SVG. Max size 2MB.</p>
                    </div>
                  </div>
                </div>

                {/* Theme Color */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Theme Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="w-10 h-10 border-0 outline-none cursor-pointer p-0 bg-transparent rounded"
                    />
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">{themeColor}</span>
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
                    placeholder="e.g. 123 Education Lane, Sector 4, New Delhi"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving || (userRole !== 'Admin' && userRole !== 'SuperAdmin')}
                className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-650 hover:from-indigo-750 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Hidden file uploader - always mounted at root of DOM */}
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
