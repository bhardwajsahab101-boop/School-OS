import React, { useMemo } from 'react'

type AttendanceRecord = {
  id: string
  date: string
  status: 'present' | 'absent'
}

type AttendanceHistoryItem = {
  dateStr: string
  dayName: string
  dayNum: number
  status: 'present' | 'absent' | 'weekend' | 'unmarked'
}

interface AttendanceSectionProps {
  attendanceRecords: AttendanceRecord[]
  attendanceHistory: AttendanceHistoryItem[]
  attendanceSummary: {
    present: number
    totalMarked: number
    rate: number
  }
  exportToCSV: () => void
}

export default function AttendanceSection({
  attendanceRecords,
  attendanceHistory,
  attendanceSummary,
  exportToCSV
}: AttendanceSectionProps) {
  
  // Calculate attendance streak (longest consecutive present markings)
  const stats = useMemo(() => {
    const sorted = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date))
    let longestStreak = 0
    let currentStreak = 0
    let absents = 0
    let presents = 0

    for (const record of sorted) {
      if (record.status === 'present') {
        presents++
        currentStreak++
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak
        }
      } else if (record.status === 'absent') {
        absents++
        currentStreak = 0
      }
    }

    return {
      longestStreak,
      presents,
      absents
    }
  }, [attendanceRecords])

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Attendance History
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">30-day tracking history & analytics</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {attendanceRecords.length > 0 && (
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Mini Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attendance Rate</span>
          <p className="text-xl font-black text-indigo-600 mt-1">{attendanceSummary.rate}%</p>
        </div>

        {/* Present Days */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Days Present</span>
          <p className="text-xl font-black text-emerald-600 mt-1">{stats.presents}</p>
        </div>

        {/* Absent Days */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Days Absent</span>
          <p className="text-xl font-black text-rose-600 mt-1">{stats.absents}</p>
        </div>

        {/* Attendance Streak */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present Streak</span>
          <p className="text-xl font-black text-amber-500 mt-1 flex items-center justify-center gap-1">
            {stats.longestStreak}
            <svg className="w-4.5 h-4.5 text-amber-500 fill-current animate-pulse" viewBox="0 0 24 24">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3.5">
          Recent 30 Days Check-in Log
        </span>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
          {attendanceHistory.map((item, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col items-center p-2 rounded-xl border relative group cursor-default transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                item.status === 'present' ? 'bg-emerald-50/10 border-emerald-100' :
                item.status === 'absent' ? 'bg-rose-50/10 border-rose-100' :
                item.status === 'unmarked' ? 'bg-slate-50/20 border-slate-200 border-dashed' :
                'bg-slate-50/30 border-slate-100'
              }`}
              title={item.status === 'unmarked' ? `Unmarked (${item.dateStr})` : `${item.status.toUpperCase()} (${item.dateStr})`}
            >
              <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">{item.dayName}</span>
              
              {/* Status Circle */}
              <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm ${
                item.status === 'present' ? 'bg-emerald-500' :
                item.status === 'absent' ? 'bg-rose-500' :
                item.status === 'unmarked' ? 'bg-white border border-slate-300' :
                'bg-slate-300'
              }`} />

              <span className="text-[11px] font-bold text-slate-700 mt-1">{item.dayNum}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Legends */}
      <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 border-t border-slate-50 pt-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Weekend / Break
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300"></span> Unmarked
        </span>
      </div>
    </div>
  )
}
