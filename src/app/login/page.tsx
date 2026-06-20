'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 antialiased font-sans">
      {/* Top bar */}
      <header className="border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-md shadow-indigo-500/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 bg-clip-text text-transparent tracking-tight">EduManage</span>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-slate-500 hover:text-indigo-650 uppercase tracking-wider transition-colors"
          >
            Back to landing
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
          <div className="rounded-3xl border border-slate-200/60 bg-white/40 backdrop-blur-sm p-8 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-100/40 w-fit">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              School Admin Portal
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight text-slate-900 tracking-tight">
              Login to manage students, attendance & fees.
            </h1>
            <p className="mt-4 text-slate-500 text-sm font-medium leading-relaxed">
              Keep your school records organized with a professional dashboard UI.
            </p>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/70 border border-slate-200/50 p-4 shadow-sm hover:border-indigo-400/20 transition-all duration-300">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Digital records
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1 pl-6">Student profiles & documents</div>
              </div>
              <div className="rounded-2xl bg-white/70 border border-slate-200/50 p-4 shadow-sm hover:border-indigo-400/20 transition-all duration-300">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Attendance
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1 pl-6">Mark and track easily</div>
              </div>
              <div className="rounded-2xl bg-white/70 border border-slate-200/50 p-4 shadow-sm hover:border-indigo-400/20 transition-all duration-300">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Fees
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1 pl-6">Collected & pending</div>
              </div>
              <div className="rounded-2xl bg-white/70 border border-slate-200/50 p-4 shadow-sm hover:border-indigo-400/20 transition-all duration-300">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Documents
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1 pl-6">Secure and organized</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-8 flex flex-col justify-center shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin Login</h2>
            <p className="text-slate-500 mt-1.5 text-xs font-medium">
              Use your email and password to continue.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@school.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="Your password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-gradient-to-tr from-indigo-600 to-violet-650 hover:from-indigo-750 hover:to-violet-700 text-white px-4 py-3.5 rounded-xl font-bold shadow-md shadow-indigo-500/10 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <div className="text-[10px] text-slate-400 font-semibold text-center mt-2">
                By continuing, you agree to use the admin dashboard for school management.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

