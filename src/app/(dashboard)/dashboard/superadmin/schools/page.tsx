'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase'
import { useSchool } from '../../../../../lib/SchoolContext'
import ClientAuth from '../../../ClientAuth'

type SchoolItem = {
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

export default function SuperAdminSchoolsPage() {
  const router = useRouter()
  const { userRole } = useSchool()
  const [schools, setSchools] = useState<SchoolItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [subFilter, setSubFilter] = useState<string>('all')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Guard routing for non-SuperAdmins
  useEffect(() => {
    if (userRole && userRole !== 'SuperAdmin') {
      router.push('/dashboard')
    }
  }, [userRole, router])

  async function loadSchools() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setSchools(data || [])
    } catch (e: any) {
      console.error('Failed to load schools list:', e)
      showNotification('error', `Failed to load schools: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userRole === 'SuperAdmin') {
      void loadSchools()
    }
  }, [userRole])

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  // Calculate high-level KPIs
  const stats = useMemo(() => {
    const total = schools.length
    const approved = schools.filter(s => s.status === 'approved').length
    const pending = schools.filter(s => s.status === 'pending').length
    const suspended = schools.filter(s => s.status === 'suspended').length
    const activeSubscription = schools.filter(s => s.subscription_status === 'active').length

    return { total, approved, pending, suspended, activeSubscription }
  }, [schools])

  // Filtered schools
  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      const matchesSearch = 
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.email && school.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (school.phone && school.phone.includes(searchTerm)) ||
        (school.academic_session && school.academic_session.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'all' || school.status === statusFilter
      const matchesSubscription = subFilter === 'all' || school.subscription_status === subFilter

      return matchesSearch && matchesStatus && matchesSubscription
    })
  }, [schools, searchTerm, statusFilter, subFilter])

  if (userRole !== 'SuperAdmin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">This module is reserved for platform-wide Super Administrators.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-7xl mx-auto space-y-8 relative">
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

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Super Admin Platform Directory</h1>
            <p className="text-slate-500 mt-1.5 font-medium">Monitor all registered school tenants, modify operational statuses, and configure SaaS subscriptions.</p>
          </div>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-650 to-violet-650 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-md shadow-indigo-600/15 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Register New School
          </Link>
        </div>

        {/* KPI Summaries */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Schools */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-300 group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Registered</span>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-slate-800 tracking-tight leading-none group-hover:scale-105 transition-transform origin-left">{stats.total}</span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-500 font-bold text-sm">🏣</div>
            </div>
          </div>

          {/* Active (Approved) */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 hover:border-emerald-300 hover:shadow-md transition-all duration-300 group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved / Active</span>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-emerald-600 tracking-tight leading-none group-hover:scale-105 transition-transform origin-left">{stats.approved}</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600 font-bold text-sm">✓</div>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 hover:border-amber-300 hover:shadow-md transition-all duration-300 group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Approval</span>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-amber-600 tracking-tight leading-none group-hover:scale-105 transition-transform origin-left">{stats.pending}</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-600 font-bold text-sm">⌛</div>
            </div>
          </div>

          {/* Suspended */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 hover:border-rose-300 hover:shadow-md transition-all duration-300 group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suspended</span>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-rose-600 tracking-tight leading-none group-hover:scale-105 transition-transform origin-left">{stats.suspended}</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100 text-rose-600 font-bold text-sm">✕</div>
            </div>
          </div>

          {/* Active Subscriptions */}
          <div className="bg-gradient-to-tr from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-5 hover:shadow-md transition-all duration-300 group col-span-2 lg:col-span-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Paid Subscriptions</span>
            <div className="flex items-end justify-between mt-2">
              <span className="text-3xl font-black text-indigo-650 tracking-tight leading-none group-hover:scale-105 transition-transform origin-left">{stats.activeSubscription}</span>
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-indigo-200 text-indigo-650 font-bold text-sm">💳</div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200/50 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400 select-none">🔍</span>
            <input
              type="text"
              placeholder="Search school name, email, phone, session..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-550/20 focus:border-indigo-550 transition-all bg-white"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex w-full md:w-auto gap-3.5 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 flex-1 md:flex-none">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status:</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-550/20"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Subscription Filter */}
            <div className="flex items-center gap-1.5 flex-1 md:flex-none">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">SaaS billing:</label>
              <select
                value={subFilter}
                onChange={e => setSubFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-550/20"
              >
                <option value="all">All Tiers</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schools Listings */}
        {loading ? (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 space-y-6 animate-pulse">
            <div className="h-6 bg-slate-100 rounded w-1/4" />
            <div className="space-y-4">
              <div className="h-14 bg-slate-100 rounded-2xl w-full" />
              <div className="h-14 bg-slate-100 rounded-2xl w-full" />
              <div className="h-14 bg-slate-100 rounded-2xl w-full" />
            </div>
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-16 text-center text-slate-400 italic text-sm font-medium">
            No registered schools found matching the filter parameters.
          </div>
        ) : (
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">School Profile</th>
                    <th className="py-4 px-4">Contact Demographics</th>
                    <th className="py-4 px-4">Session & Region</th>
                    <th className="py-4 px-4">Approval Status</th>
                    <th className="py-4 px-4">Subscription</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSchools.map(school => {
                    return (
                      <tr key={school.id} className="hover:bg-slate-50/30 transition-colors group">
                        {/* School details */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                              {school.logo_url ? (
                                <img src={school.logo_url} alt={school.name} className="object-cover w-full h-full" />
                              ) : (
                                <span className="text-base font-extrabold text-indigo-600">{school.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 text-sm block tracking-tight truncate max-w-[200px]">{school.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 truncate block max-w-[200px]">{school.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Contact details */}
                        <td className="py-4 px-4 text-xs font-semibold">
                          <div className="space-y-0.5">
                            <span className="block text-slate-600 truncate max-w-[180px]">{school.email || 'No email set'}</span>
                            <span className="block text-slate-400 font-medium">{school.phone || 'No phone set'}</span>
                          </div>
                        </td>

                        {/* Session & address */}
                        <td className="py-4 px-4 text-xs font-semibold">
                          <div className="space-y-0.5">
                            <span className="block text-indigo-650 bg-indigo-50/60 border border-indigo-100/50 px-2 py-0.5 rounded-lg text-[10px] font-bold w-fit">
                              {school.academic_session || 'N/A'}
                            </span>
                            <span className="block text-slate-400 truncate max-w-[220px]" title={school.address || ''}>
                              {school.address || 'Address unconfigured'}
                            </span>
                          </div>
                        </td>

                        {/* Approval Status */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase border tracking-wider ${
                            school.status === 'approved' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : school.status === 'pending'
                              ? 'bg-amber-50 border-amber-200 text-amber-700' 
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              school.status === 'approved' 
                                ? 'bg-emerald-500' 
                                : school.status === 'pending'
                                ? 'bg-amber-500' 
                                : 'bg-rose-500'
                            }`} />
                            {school.status}
                          </span>
                        </td>

                        {/* Subscription */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border tracking-wider ${
                            school.subscription_status === 'active' 
                              ? 'bg-indigo-50 border-indigo-150 text-indigo-750' 
                              : school.subscription_status === 'trial'
                              ? 'bg-purple-50 border-purple-200 text-purple-755' 
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}>
                            {school.subscription_status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end">
                            {/* Manage School */}
                            <Link
                              href={`/dashboard/superadmin/schools/${school.id}`}
                              className="inline-flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 shadow-sm"
                              title="Open Management Control"
                            >
                              Manage Settings
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
