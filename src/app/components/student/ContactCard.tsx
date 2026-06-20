import React from 'react'

interface ContactCardProps {
  parentName: string | null
  parentPhone: string | null
  address: string | null
}

export default function ContactCard({
  parentName,
  parentPhone,
  address
}: ContactCardProps) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
      <div>
        <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Primary Contacts
        </h3>

        <div className="space-y-5 mt-5">
          {/* Parent/Guardian Info */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Parent / Guardian</span>
            {parentName ? (
              <p className="text-sm font-semibold text-slate-700">{parentName}</p>
            ) : (
              <p className="text-sm italic text-slate-400 font-medium">No parent name provided</p>
            )}
          </div>

          {/* Phone number Info */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</span>
            {parentPhone ? (
              <div className="flex items-center gap-2.5">
                <p className="text-sm font-semibold text-slate-700">{parentPhone}</p>
                <a
                  href={`tel:${parentPhone}`}
                  title="Call parent"
                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              </div>
            ) : (
              <p className="text-sm italic text-slate-400 font-medium">No contact phone available</p>
            )}
          </div>

          {/* Home Address Info */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Home Address</span>
            {address ? (
              <p className="text-sm font-semibold text-slate-600 leading-relaxed">{address}</p>
            ) : (
              <p className="text-sm italic text-slate-400 font-medium">No address on file</p>
            )}
          </div>
        </div>
      </div>

      {parentPhone && (
        <div className="mt-6 pt-4 border-t border-slate-50">
          <a
            href={`tel:${parentPhone}`}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call Parent
          </a>
        </div>
      )}
    </div>
  )
}
