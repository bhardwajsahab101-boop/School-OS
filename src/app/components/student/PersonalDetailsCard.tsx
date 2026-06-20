import React from 'react'

interface PersonalDetailsCardProps {
  gender: string | null
  dateOfBirth: string | null
  admissionDate: string | null
  className: string | null
}

export default function PersonalDetailsCard({
  gender,
  dateOfBirth,
  admissionDate,
  className
}: PersonalDetailsCardProps) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2 mb-5">
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Personal Information
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Gender */}
        <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl">
          <div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gender</span>
            <p className="text-sm font-semibold text-slate-700 capitalize truncate">
              {gender || 'Not Specified'}
            </p>
          </div>
        </div>

        {/* Date of Birth */}
        <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl">
          <div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date of Birth</span>
            <p className="text-sm font-semibold text-slate-700 truncate">
              {dateOfBirth || 'Not Recorded'}
            </p>
          </div>
        </div>

        {/* Admission Date */}
        <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl">
          <div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admission Date</span>
            <p className="text-sm font-semibold text-slate-700 truncate">
              {admissionDate || 'Not Available'}
            </p>
          </div>
        </div>

        {/* Class Assigned */}
        <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl">
          <div className="p-2 bg-white rounded-lg text-slate-500 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Assigned</span>
            <p className="text-sm font-semibold text-slate-700 truncate">
              Class {className || 'Unassigned'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
