import React from 'react'
import Link from 'next/link'

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 antialiased font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 h-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-md shadow-indigo-500/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 bg-clip-text text-transparent tracking-tight">EduManage</span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <a href="#features" className="hover:text-indigo-650 transition-colors">Features</a>
            <a href="#trust" className="hover:text-indigo-655 transition-colors">Workflows</a>
            <a href="#pricing" className="hover:text-indigo-650 transition-colors">Pricing</a>
            <a href="#demo" className="hover:text-indigo-655 transition-colors">Demo</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4.5 py-2 text-xs font-bold transition-all border border-indigo-150/30 active:scale-[0.98]"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white px-4.5 py-2 text-xs font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-500/10 active:scale-[0.98]"
            >
              Start Demo
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-24">
        {/* Hero */}
        <section className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-100/40">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                Next-Gen School Digitization
              </div>

              <h1 className="text-4xl sm:text-5xl font-black leading-tight text-slate-900 tracking-tight">
                Spend less time on paperwork.
                <span className="block bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 bg-clip-text text-transparent mt-2">
                  Manage everything from one dashboard.
                </span>
              </h1>
              
              <p className="text-slate-500 text-base sm:text-lg font-medium leading-relaxed max-w-xl">
                Track student demographics, mark and review daily attendance logs, coordinate billing & monthly fees, and upload files in minutes.
              </p>

              <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white px-6 py-3.5 font-bold shadow-md shadow-indigo-500/10 hover:from-indigo-700 hover:to-violet-700 transition-all active:scale-[0.98]"
                >
                  Start Demo Now
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-6 py-3.5 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]"
                >
                  Admin Login
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6">
                <div className="rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm p-4 text-center">
                  <div className="text-xl font-black text-indigo-600">Fast</div>
                  <div className="text-[11px] text-slate-400 font-bold uppercase mt-1">Setup in minutes</div>
                </div>
                <div className="rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm p-4 text-center">
                  <div className="text-xl font-black text-indigo-600">Simple</div>
                  <div className="text-[11px] text-slate-400 font-bold uppercase mt-1">Intuitive UX</div>
                </div>
                <div className="rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm p-4 text-center">
                  <div className="text-xl font-black text-indigo-600">Secure</div>
                  <div className="text-[11px] text-slate-400 font-bold uppercase mt-1">Cloud Protected</div>
                </div>
              </div>
            </div>

            {/* Screenshots Mockup Frame */}
            <div className="flex-1">
              <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-b from-indigo-50/50 to-white/20 p-4 shadow-sm">
                <div className="rounded-2xl bg-white border border-slate-200/50 p-4 shadow-sm">
                  {/* Browser Window Bar */}
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-400 block" />
                      <span className="w-3 h-3 rounded-full bg-amber-400 block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400 block" />
                    </div>
                    <div className="text-xs font-bold text-slate-400">edumanage.com/dashboard</div>
                    <span className="w-4 h-4 text-slate-300 block" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group hover:border-indigo-400/40 transition-colors">
                      <div className="w-full h-32 bg-indigo-50/50 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                        <img
                          src="/dashboard-students.png"
                          alt="Student page screenshot"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-2.5 text-xs font-bold text-slate-800 text-center">Directory page</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group hover:border-indigo-400/40 transition-colors">
                      <div className="w-full h-32 bg-indigo-50/50 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                        <img
                          src="/dashboard-attendance.png"
                          alt="Attendance page screenshot"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-2.5 text-xs font-bold text-slate-800 text-center">Attendance logs</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group hover:border-indigo-400/40 transition-colors">
                      <div className="w-full h-32 bg-indigo-50/50 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                        <img
                          src="/dashboard-fees.png"
                          alt="Fee page screenshot"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-2.5 text-xs font-bold text-slate-800 text-center">Billing & Fees</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50/60 border border-slate-200/50 p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Students</span>
                        <span className="text-xl font-black text-slate-800">120+</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    </div>
                    <div className="rounded-xl bg-slate-50/60 border border-slate-200/50 p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Attendance Today</span>
                        <span className="text-xl font-black text-emerald-600">96.4%</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Core Platform Features</h2>
            <p className="text-slate-550 text-sm font-medium">Everything you need to run a school smoothly—without messy paperwork and registers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 hover:shadow-md hover:border-indigo-400/20 transition-all duration-300 group cursor-default">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 bg-indigo-50/60 text-indigo-700 border border-indigo-100/30 rounded-xl group-hover:scale-105 transition-transform shadow-sm">
                  <IconUser className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Student Directory</h4>
                  <p className="mt-1.5 text-xs text-slate-400 font-medium leading-relaxed">Store comprehensive student files, parent details, contact information, and address records.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 hover:shadow-md hover:border-indigo-400/20 transition-all duration-300 group cursor-default">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 bg-indigo-50/60 text-indigo-700 border border-indigo-100/30 rounded-xl group-hover:scale-105 transition-transform shadow-sm">
                  <IconCalendar className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Attendance Manager</h4>
                  <p className="mt-1.5 text-xs text-slate-400 font-medium leading-relaxed">Quickly record check-ins with Present/Absent selectors, track 30-day matrices, and compute streaks.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 hover:shadow-md hover:border-indigo-400/20 transition-all duration-300 group cursor-default">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 bg-indigo-50/60 text-indigo-700 border border-indigo-100/30 rounded-xl group-hover:scale-105 transition-transform shadow-sm">
                  <IconWallet className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Monthly Fees</h4>
                  <p className="mt-1.5 text-xs text-slate-400 font-medium leading-relaxed">Monitor billed, paid, and outstanding balances. Record invoices, pay bills in bulk, and review history.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 hover:shadow-md hover:border-indigo-400/20 transition-all duration-300 group cursor-default">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 bg-indigo-50/60 text-indigo-700 border border-indigo-100/30 rounded-xl group-hover:scale-105 transition-transform shadow-sm">
                  <IconFile className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Document Vault</h4>
                  <p className="mt-1.5 text-xs text-slate-400 font-medium leading-relaxed">Attach admission certificates, PDFs, and photos directly to student profiles with clean dropzones.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Workflows */}
        <section id="trust" className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Built with real school workflows</h2>
            <p className="text-slate-500 text-sm font-medium">EduManage is designed around the daily operations of real admins, principals, and teachers.</p>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200/50 bg-slate-50/30 p-5 space-y-2">
                <span className="text-indigo-650 font-black text-base">01. Practical UX</span>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Built & tested in schools</p>
                <p className="text-xs text-slate-550 leading-relaxed">No complex forms or abstract settings. Only clean tables, status toggle switches, and quick actions.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/50 bg-slate-50/30 p-5 space-y-2">
                <span className="text-indigo-650 font-black text-base">02. Administrative Speed</span>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Less typing, faster logs</p>
                <p className="text-xs text-slate-550 leading-relaxed">Mark whole class rosters present with a single click. Select multiple invoice months on an interactive month grid.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/50 bg-slate-50/30 p-5 space-y-2">
                <span className="text-indigo-650 font-black text-base">03. Transparent Metrics</span>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Real-time status</p>
                <p className="text-xs text-slate-550 leading-relaxed">Automatic calculation of attendance percentages, streaks, billed ratios, and pending balances in Rupees (₹).</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Simple Pricing</h2>
            <p className="text-slate-550 text-sm font-medium">Currently in beta. Start exploring all features with our guided demo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Starter Plan</span>
                <div className="text-3xl font-black text-slate-900">₹0 <span className="text-xs font-semibold text-slate-400">/ month</span></div>
                <p className="text-xs text-slate-500 font-medium">For small schools and play branches up to 50 students.</p>
              </div>
              <button disabled className="w-full mt-6 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 px-4 py-2 text-xs font-bold uppercase tracking-wider select-none">Coming Soon</button>
            </div>

            <div className="rounded-2xl border-2 border-indigo-500 bg-white p-6 flex flex-col justify-between hover:shadow-md transition-shadow relative">
              <span className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-white shadow-sm">Popular Choice</span>
              <div className="space-y-3">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Standard Plan</span>
                <div className="text-3xl font-black text-slate-900">₹999 <span className="text-xs font-semibold text-slate-400">/ month</span></div>
                <p className="text-xs text-slate-500 font-medium">For growing schools up to 300 students. Includes reports and vault.</p>
              </div>
              <button disabled className="w-full mt-6 rounded-xl bg-indigo-55 bg-indigo-50 border border-indigo-100 text-indigo-750 px-4 py-2 text-xs font-bold uppercase tracking-wider select-none">Coming Soon</button>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Premium / Franchise</span>
                <div className="text-3xl font-black text-slate-900">₹2,499 <span className="text-xs font-semibold text-slate-400">/ month</span></div>
                <p className="text-xs text-slate-500 font-medium">For large schools and multi-branch systems. Unlimited students.</p>
              </div>
              <button disabled className="w-full mt-6 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 px-4 py-2 text-xs font-bold uppercase tracking-wider select-none">Coming Soon</button>
            </div>
          </div>
        </section>

        {/* Guided Demo CTA */}
        <section id="demo" className="relative">
          <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-tr from-indigo-50/50 to-violet-50/50 p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-lg">
                <h3 className="text-xl font-bold text-slate-900">Get a guided demo in 2 seconds</h3>
                <p className="text-xs text-slate-450 font-medium leading-relaxed">
                  Sign in immediately with the admin credentials to view the student profile pages, track active logs, mark rosters, and configure month-billing options.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto shrink-0">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white px-6 py-3 font-bold shadow-md shadow-indigo-500/10 hover:from-indigo-700 hover:to-violet-700 transition-all active:scale-[0.98] text-center"
                >
                  Start Demo
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98] text-center"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Mock Preview */}
        <section id="dashboard" className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Interactive Preview</h2>
            <p className="text-slate-500 text-sm font-medium">Take a look at how real-time attendance and fee data look inside the dashboard.</p>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-slate-50/40 border border-slate-200/50 p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Students</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">120</span>
              </div>
              <div className="rounded-2xl bg-slate-50/40 border border-slate-200/50 p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Today’s Attendance</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">94.8%</span>
              </div>
              <div className="rounded-2xl bg-slate-50/40 border border-slate-200/50 p-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Fees Billed</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">₹57,000</span>
              </div>
              <div className="rounded-2xl bg-slate-50/40 border border-slate-200/50 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pending Balance</span>
                  <span className="text-2xl font-black text-rose-500 mt-1 block">₹12,000</span>
                </div>
                <span className="text-[10px] text-rose-600 font-semibold block mt-1">5 Unpaid Invoices</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl bg-slate-50/40 border border-slate-200/50 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">Attendance Trend</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Weekly average ratios</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Updated live</span>
                </div>

                <div className="flex items-end gap-3 h-32 border-b border-slate-250/30 pb-2">
                  <div className="flex-1 rounded-t-lg bg-indigo-500/10 border border-indigo-150/30 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[92%]">Mon</div>
                  <div className="flex-1 rounded-t-lg bg-indigo-500/10 border border-indigo-150/30 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[96%]">Tue</div>
                  <div className="flex-1 rounded-t-lg bg-indigo-500/10 border border-indigo-150/30 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[94%]">Wed</div>
                  <div className="flex-1 rounded-t-lg bg-indigo-500/10 border border-indigo-150/30 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[98%]">Thu</div>
                  <div className="flex-1 rounded-t-lg bg-indigo-500/10 border border-indigo-150/30 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[90%]">Fri</div>
                  <div className="flex-1 rounded-t-lg bg-indigo-500/10 border border-indigo-150/30 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[92%]">Sat</div>
                  <div className="flex-1 rounded-t-lg bg-indigo-55 bg-indigo-500/20 border border-indigo-400 flex items-end justify-center pb-2 text-[10px] text-indigo-700 font-bold h-[95%]">Sun</div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/60 p-5 space-y-4">
                <h5 className="text-sm font-bold text-slate-800">Recent Registrations</h5>
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 text-indigo-700 font-bold flex items-center justify-center border border-indigo-200/20 text-xs">A</div>
                      <div>
                        <span className="text-xs font-bold text-slate-850 block">Ayush Kumar</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Class 1</span>
                      </div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 text-indigo-700 font-bold flex items-center justify-center border border-indigo-200/20 text-xs">K</div>
                      <div>
                        <span className="text-xs font-bold text-slate-850 block">Khushi Sharma</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Class 12</span>
                      </div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-10 border-t border-slate-200/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-1.5 rounded-lg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
                <span className="text-base font-bold bg-gradient-to-r from-indigo-700 to-indigo-850 bg-clip-text text-transparent">EduManage</span>
              </div>
              <p className="text-xs text-slate-400 font-medium max-w-md">School operations—students, attendance registers, monthly billing, and cloud documents—digitized cleanly without paper.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 text-xs font-bold border border-indigo-150/30 active:scale-[0.98] text-center"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white px-5 py-2.5 text-xs font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-500/10 active:scale-[0.98] text-center"
              >
                Sign In As Admin
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
            © {new Date().getFullYear()} EduManage School ERP. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  )
}
