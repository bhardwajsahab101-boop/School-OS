'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'
import ClientAuth from '../../../ClientAuth'
import { useSchool } from '../../../../../lib/SchoolContext'

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

type Params = { id?: string }

export default function StaffProfilePage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params)
  const staffId = resolvedParams.id
  const { schoolId } = useSchool()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [member, setMember] = useState<StaffMember | null>(null)

  async function loadProfile() {
    if (!staffId) {
      setLoading(false)
      setErrorMsg('Invalid staff ID URL.')
      return
    }
    if (!schoolId) return

    try {
      setLoading(true)
      setErrorMsg(null)

      // 1. Fetch staff member
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .eq('school_id', schoolId)
        .single()

      if (staffErr) {
        setErrorMsg(staffErr.message)
        setMember(null)
        return
      }

      if (staffData) {
        // 2. Fetch assigned classes using normalized database schema
        const { data: assignments } = await supabase
          .from('teacher_classes')
          .select('classes(name)')
          .eq('teacher_id', staffId)

        const assignedClasses = assignments?.map((a: any) => a.classes?.name).filter(Boolean) || []

        setMember({
          ...staffData,
          assigned_classes: assignedClasses
        })
      }
    } catch (e: any) {
      console.error('Failed to load staff profile:', e)
      setErrorMsg(e.message || 'Unexpected loading error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return
    void loadProfile()
  }, [staffId, schoolId])

  // Initials Avatar
  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Date format
  const joinedDate = member?.created_at
    ? new Date(member.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
    : '—'

  return (
    <>
      <ClientAuth />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href="/dashboard/staff"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back to staff directory
          </Link>
        </div>

        {/* Loader or Error */}
        {loading ? (
          <div className="bg-white border border-slate-200/60 rounded-2xl p-8 space-y-6 animate-pulse">
            <div className="h-24 bg-slate-100 rounded-2xl w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-44 bg-slate-100 rounded-2xl w-full" />
              <div className="h-44 bg-slate-100 rounded-2xl w-full" />
            </div>
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-rose-800 font-semibold shadow-sm">
            Failed to load profile: {errorMsg}
          </div>
        ) : !member ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-slate-500 font-bold shadow-sm">
            Staff profile not found in database.
          </div>
        ) : (
          <div className="space-y-6">

            {/* 1. Profile Header Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                {/* Avatar */}
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-black border border-indigo-200/20 shadow-md shrink-0">
                  {getInitials(member.full_name)}
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-center sm:justify-start">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight truncate">
                      {member.full_name}
                    </h1>

                    <span className={`self-center inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border select-none ${member.role === 'Admin'
                        ? 'bg-violet-50 text-violet-700 border-violet-100/50'
                        : member.role === 'Teacher'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50'
                          : member.role === 'Accountant'
                            ? 'bg-amber-50 text-amber-700 border-amber-100/50'
                            : 'bg-slate-50 text-slate-600 border-slate-200/50'
                      }`}>
                      {member.role}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                    <p className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {member.email}
                    </p>
                    {member.phone && (
                      <>
                        <p className="text-slate-350">|</p>
                        <p className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {member.phone}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

              {/* Left Column: Details */}
              <div className="space-y-6">

                {/* Personal Information */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2">Personal Information</h3>

                  <div className="space-y-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Full Profile Name</span>
                      <strong className="text-slate-700 font-bold">{member.full_name}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Registered Email</span>
                      <strong className="text-slate-700 font-bold">{member.email}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Contact Phone</span>
                      <strong className="text-slate-700 font-bold">{member.phone || '—'}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Joined Directory Date</span>
                      <strong className="text-slate-700 font-bold">{joinedDate}</strong>
                    </div>
                  </div>
                </div>

                {/* Account Credentials status */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2">Account Status</h3>

                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">Credentials Auth Account</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${member.user_id
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                        }`}>
                        {member.user_id ? 'Linked' : 'Not Linked'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">Status</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-bold border ${member.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                          : 'bg-rose-50 text-rose-700 border-rose-100/50'
                        }`}>
                        {member.status}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-normal font-medium mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {member.user_id
                        ? 'This staff member has a portal login account created. They can sign in using their registered email.'
                        : 'No portal credentials configured. You can edit this staff member and input a password to create one.'}
                    </p>
                  </div>
                </div>

              </div>

              {/* Right Column: Class list & logs */}
              <div className="space-y-6">

                {/* Assigned Classes */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2">Class Assignments</h3>

                  {member.role !== 'Teacher' ? (
                    <p className="text-xs text-slate-400 font-medium italic">Assignments are only configured for Teacher roles. This account is registered as a system {member.role}.</p>
                  ) : member.assigned_classes && member.assigned_classes.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400 font-medium">This teacher manages student lists and logs daily attendance for these assigned classes:</p>
                      <div className="flex flex-wrap gap-2.5">
                        {member.assigned_classes.map((cls, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-150/40">
                            Class {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-rose-100 bg-rose-50/20 text-rose-800 text-xs font-semibold rounded-xl text-center">
                      No classes assigned yet. Set classes up in directory list.
                    </div>
                  )}
                </div>

                {/* Activity Summary Log */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2">Portal Audit Log</h3>

                  <div className="space-y-4">
                    <div className="flex gap-3 text-left">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Directory Profile created</span>
                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{joinedDate}</span>
                      </div>
                    </div>

                    {member.user_id && (
                      <div className="flex gap-3 text-left">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Login account registered</span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Auto-configured</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </>
  )
}
