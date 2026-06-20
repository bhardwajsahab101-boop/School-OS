import React, { useMemo } from 'react'

type Student = {
  id: string
  class_name: string | null
  admission_date: string | null
  created_at: string
}

type AttendanceRecord = {
  id: string
  date: string
  status: 'present' | 'absent'
}

type FeeRecord = {
  id: string
  amount: number
  status: string
  month: string
  created_at: string
}

type DocumentRecord = {
  id: string
  file_url: string
  created_at: string
}

interface ActivityTimelineProps {
  student: Student
  attendanceRecords: AttendanceRecord[]
  fees: FeeRecord[]
  documents: DocumentRecord[]
}

type TimelineEvent = {
  id: string
  type: 'enrollment' | 'attendance' | 'fee' | 'document'
  title: string
  description: string
  date: string
  dateLabel: string
}

function getDocumentName(url: string): string {
  try {
    const filename = url.split('/').pop() || 'document.pdf'
    return decodeURIComponent(filename).replace(/^\d{13}_/, '')
  } catch (e) {
    return 'document.pdf'
  }
}

export default function ActivityTimeline({
  student,
  attendanceRecords,
  fees,
  documents
}: ActivityTimelineProps) {

  const events = useMemo(() => {
    const list: TimelineEvent[] = []

    // 1. Enrollment Event
    const enrollDate = student.admission_date || student.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
    list.push({
      id: `enroll-${student.id}`,
      type: 'enrollment',
      title: 'Student Profile Enrolled',
      description: `Registered student into Class ${student.class_name || 'Unassigned'} directory.`,
      date: enrollDate,
      dateLabel: new Date(enrollDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    })

    // 2. Attendance Events (last 5 only to prevent clutter)
    const sortedAttendance = [...attendanceRecords]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)

    sortedAttendance.forEach(a => {
      list.push({
        id: `att-${a.id}`,
        type: 'attendance',
        title: `Attendance: ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`,
        description: `Marked as ${a.status} for school check-in calendar.`,
        date: a.date,
        dateLabel: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })
    })

    // 3. Fee Events
    fees.forEach(f => {
      const isPaid = f.status?.toLowerCase() === 'paid'
      list.push({
        id: `fee-${f.id}`,
        type: 'fee',
        title: isPaid ? `Fee Cleared: ${f.month}` : `Fee Invoice Created: ${f.month}`,
        description: isPaid 
          ? `Cleared tuition payment of ₹{f.amount} for the month of ${f.month}.`
          : `Outstanding tuition invoice of ₹{f.amount} billed for the month of ${f.month}.`,
        date: f.created_at,
        dateLabel: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      })
    })

    // 4. Document Events
    documents.forEach(d => {
      const docName = getDocumentName(d.file_url)
      list.push({
        id: `doc-${d.id}`,
        type: 'document',
        title: 'Document Uploaded',
        description: `Student record updated with attachment: "${docName}".`,
        date: d.created_at,
        dateLabel: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      })
    })

    // Sort all events by date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [student, attendanceRecords, fees, documents])

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity Timeline
        </h3>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Chronological record of student logs & transactions</p>
      </div>

      <div className="relative border-l border-slate-100 pl-6 ml-2.5 space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative group">
            {/* Timeline Dot Icon */}
            <span className={`absolute -left-[35px] top-0.5 w-6.5 h-6.5 rounded-full border bg-white shadow-sm flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform ${
              event.type === 'enrollment' ? 'border-indigo-100 text-indigo-600' :
              event.type === 'attendance' ? 'border-emerald-100 text-emerald-600' :
              event.type === 'fee' ? 'border-amber-100 text-amber-600' :
              'border-purple-100 text-purple-600'
            }`}>
              {event.type === 'enrollment' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              )}
              {event.type === 'attendance' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {event.type === 'fee' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {event.type === 'document' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
            </span>

            {/* Event Content */}
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="text-xs font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                  {event.title}
                </h4>
                <span className="text-[10px] font-bold text-slate-400 shrink-0">
                  {event.dateLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
