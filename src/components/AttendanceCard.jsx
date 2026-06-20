'use client'

export default function AttendanceCard({
  student,
  displayId,
  currentStatus,
  savingId,
  markAttendance
}) {
  const isSaving = savingId === student.id

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-300 relative overflow-hidden group">
      {/* Saving Loader Overlay */}
      {isSaving && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all">
          <div className="w-5 h-5 border-2.5 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 text-indigo-700 font-bold flex items-center justify-center border border-indigo-200/20 shadow-sm shrink-0 transition-transform group-hover:scale-105">
            {student.full_name ? student.full_name.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
              {student.full_name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
                Class {student.class_name}
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-[10px] text-indigo-550 font-bold">{displayId}</span>
            </div>
          </div>
        </div>

        <div>
          {currentStatus === 'present' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
              Present
            </span>
          )}

          {currentStatus === 'absent' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider">
              Absent
            </span>
          )}

          {!currentStatus && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100 uppercase tracking-wider">
              Unmarked
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => markAttendance(student.id, 'present')}
          disabled={isSaving}
          className={`
            flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer border
            ${
              currentStatus === 'present'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                : 'bg-emerald-50/50 border-emerald-100/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-100'
            }
          `}
        >
          Present
        </button>

        <button
          onClick={() => markAttendance(student.id, 'absent')}
          disabled={isSaving}
          className={`
            flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer border
            ${
              currentStatus === 'absent'
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm hover:bg-rose-700'
                : 'bg-rose-50/50 border-rose-100/40 text-rose-700 hover:bg-rose-50 hover:border-rose-100'
            }
          `}
        >
          Absent
        </button>
      </div>
    </div>
  )
}