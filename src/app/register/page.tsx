'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useSchool } from '../../lib/SchoolContext';

export default function RegisterPage() {
  const router = useRouter();
  const { userRole } = useSchool();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Redirect non‑SuperAdmin users
  useEffect(() => {
    if (userRole && userRole !== 'SuperAdmin') {
      router.replace('/dashboard');
    }
  }, [userRole, router]);
  // Step 1: Owner Details
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Step 2: School Details
  const [schoolName, setSchoolName] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [academicSession, setAcademicSession] = useState('2026-27 Session')
  const [themeColor, setThemeColor] = useState('#4f46e5')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Hydrate state from sessionStorage to survive Android background process death
  useEffect(() => {
    setFullName(sessionStorage.getItem('edumanage_reg_fullName') || '')
    setEmail(sessionStorage.getItem('edumanage_reg_email') || '')
    setSchoolName(sessionStorage.getItem('edumanage_reg_schoolName') || '')
    setSchoolPhone(sessionStorage.getItem('edumanage_reg_schoolPhone') || '')
    setSchoolEmail(sessionStorage.getItem('edumanage_reg_schoolEmail') || '')
    setSchoolAddress(sessionStorage.getItem('edumanage_reg_schoolAddress') || '')
    setAcademicSession(sessionStorage.getItem('edumanage_reg_academicSession') || '2026-27 Session')
    setThemeColor(sessionStorage.getItem('edumanage_reg_themeColor') || '#4f46e5')
    const savedStep = sessionStorage.getItem('edumanage_reg_step')
    if (savedStep) setStep(Number(savedStep))
  }, [])

  // Sync state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('edumanage_reg_fullName', fullName)
    sessionStorage.setItem('edumanage_reg_email', email)
    sessionStorage.setItem('edumanage_reg_schoolName', schoolName)
    sessionStorage.setItem('edumanage_reg_schoolPhone', schoolPhone)
    sessionStorage.setItem('edumanage_reg_schoolEmail', schoolEmail)
    sessionStorage.setItem('edumanage_reg_schoolAddress', schoolAddress)
    sessionStorage.setItem('edumanage_reg_academicSession', academicSession)
    sessionStorage.setItem('edumanage_reg_themeColor', themeColor)
    sessionStorage.setItem('edumanage_reg_step', String(step))
  }, [fullName, email, schoolName, schoolPhone, schoolEmail, schoolAddress, academicSession, themeColor, step])

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

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !email || !password) {
      alert('Please fill out all user information fields.')
      return
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters.')
      return
    }
    setStep(2)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolName || !academicSession) {
      alert('School Name and Academic Session are required.')
      return
    }

    setLoading(true)

    try {
      // 1. Dispatch registration data to the secure server-side endpoint
      const response = await fetch('/api/register-school', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          schoolName,
          academicSession,
          schoolPhone: schoolPhone || null,
          schoolEmail: schoolEmail || null,
          schoolAddress: schoolAddress || null,
          themeColor
        })
      })

      const apiResult = await response.json()

      if (!response.ok || apiResult.error) {
        throw new Error(apiResult.error || 'Server registration endpoint returned an error.')
      }

      const { schoolId } = apiResult

      // 2. Automatically log in the user on the client to establish session state
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        throw new Error(`School created successfully, but automatic login failed: ${signInError.message}. Please log in manually.`)
      }

      // 3. Upload Logo File if present using client-side auth context
      let finalLogoPath = null
      if (logoFile && schoolId) {
        const logoPath = `school-logos/${schoolId}_${Date.now()}_${logoFile.name}`
        console.log("Upload started")
        console.log("File selected", logoFile)
        console.log("Page visibility", document.visibilityState)
        console.log("Before upload")

        const { error: uploadErr } = await supabase.storage
          .from('student-documents')
          .upload(logoPath, logoFile)

        if (uploadErr) {
          console.warn('Logo upload failed, proceeding without logo:', uploadErr.message)
          console.log("Upload failed")
        } else {
          console.log("Upload success")
          finalLogoPath = logoPath
          // Update logo URL reference in schools table
          const { error: updateErr } = await supabase
            .from('schools')
            .update({ logo_url: finalLogoPath })
            .eq('id', schoolId)

          if (updateErr) {
            console.warn('Failed to update school logo path in database:', updateErr.message)
          }
        }
      }

      alert('School registered successfully!')
      
      // Clear sessionStorage items
      sessionStorage.removeItem('edumanage_reg_fullName')
      sessionStorage.removeItem('edumanage_reg_email')
      sessionStorage.removeItem('edumanage_reg_schoolName')
      sessionStorage.removeItem('edumanage_reg_schoolPhone')
      sessionStorage.removeItem('edumanage_reg_schoolEmail')
      sessionStorage.removeItem('edumanage_reg_schoolAddress')
      sessionStorage.removeItem('edumanage_reg_academicSession')
      sessionStorage.removeItem('edumanage_reg_themeColor')
      sessionStorage.removeItem('edumanage_reg_step')

      // Save active school cached value
      localStorage.setItem('edumanage_active_school_id', schoolId)
      
      // Force reload page to dashboard
      window.location.href = '/dashboard'

    } catch (err) {
      const error = err as Error
      console.error('Registration failed:', error)
      alert(`Registration failed: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  return (


<div className="min-h-screen bg-slate-50/50 text-slate-800 antialiased font-sans flex flex-col">
{/* 
Super admin is not admin of all schools he is owner of EduManage SaaS platform so he should not be able to switch and saw the other users data. he saw say the registered used by him but but nothing else 
*/}
      <header className="border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-md shadow-indigo-500/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 bg-clip-text text-transparent tracking-tight">EduManage SaaS</span>
          </div>
          <span className="text-xs font-semibold text-slate-400">Multi-School Onboarding</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-xl bg-white border border-slate-200/60 rounded-3xl shadow-xl overflow-hidden p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Register Your School</h1>
              <p className="text-xs text-slate-400 font-semibold mt-1">Get started with a secure tenant-isolated ERP space.</p>
            </div>
            <div className="flex items-center bg-indigo-50/80 text-indigo-700 font-bold px-3 py-1.5 rounded-2xl border border-indigo-100/40 text-xs gap-1.5 shrink-0">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${step === 1 ? 'bg-indigo-600 animate-pulse' : 'bg-emerald-500'}`} />
              Step {step} of 2
            </div>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-800">Account Owner Details</h3>
                <p className="text-[11px] text-slate-400 font-medium">These details govern your portal logins and administrative identity.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Administrator Owner"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.com"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm text-sm font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow active:scale-[0.98] cursor-pointer"
                >
                  Configure School Details
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-800">School Details</h3>
                <p className="text-[11px] text-slate-400 font-medium">Configure demographics and layout metadata for the school.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Name *</label>
                    <input
                      type="text"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="e.g. Little Stars Play School"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Email</label>
                    <input
                      type="email"
                      value={schoolEmail}
                      onChange={(e) => setSchoolEmail(e.target.value)}
                      placeholder="info@littlestars.com"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Academic Session *</label>
                    <input
                      type="text"
                      required
                      value={academicSession}
                      onChange={(e) => setAcademicSession(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contact Number</label>
                    <input
                      type="text"
                      value={schoolPhone}
                      onChange={(e) => setSchoolPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Logo / Banner</label>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        {logoPreview ? (
                          <img src={logoPreview} alt="School Logo Preview" className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-lg text-slate-300 font-bold">★</span>
                        )}
                      </div>
                      <label
                        htmlFor="logo-select"
                        className="bg-indigo-50 text-indigo-700 font-bold px-3.5 py-2 rounded-xl text-xs hover:bg-indigo-100 transition cursor-pointer select-none border border-indigo-100/20 active:scale-95"
                      >
                        Upload
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Theme Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="w-8 h-8 rounded border-0 outline-none cursor-pointer p-0"
                      />
                      <span className="text-xs font-bold font-mono text-slate-500 uppercase">{themeColor}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physical Campus Address</label>
                <textarea
                  rows={2}
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="Full campus physical address details..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-500 hover:text-slate-700 font-bold text-xs px-4 py-2.5 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-tr from-indigo-600 to-violet-650 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Creating School Space...' : 'Register & Log In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      {/* Hidden file uploader - always mounted at root of DOM */}
      <input
        type="file"
        accept="image/*"
        id="logo-select"
        onChange={handleLogoChange}
        className="hidden"
      />
    </div>
  )
}
