'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'

type FeeDetails = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  paid_at?: string | null
  amount: number
  status: string
  month: string
}

type StudentDetails = {
  id: string
  full_name: string | null
  parent_name: string | null
  parent_phone: string | null
  class_name: string | null
}

type SchoolDetails = {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  academic_session: string | null
}

export default function ReceiptPage({ params }: { params: Promise<{ feeId: string }> }) {
  const router = useRouter()
  const { feeId } = React.use(params)
  const { schoolId } = useSchool()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [fee, setFee] = useState<FeeDetails | null>(null)
  const [student, setStudent] = useState<StudentDetails | null>(null)
  const [school, setSchool] = useState<SchoolDetails | null>(null)
  const [displayId, setDisplayId] = useState<string>('Stu-?')

  useEffect(() => {
    if (!schoolId) return

    async function loadReceipt() {
      try {
        setLoading(true)
        setError(null)

        // 1. Fetch fee details (Supabase first, then fallback to localStorage)
        let loadedFee: FeeDetails | null = null
        let studentId: string | null = null

        const { data: dbFee } = await supabase
          .from('fees')
          .select('*')
          .eq('id', feeId)
          .eq('school_id', schoolId)
          .maybeSingle()

        if (dbFee) {
          loadedFee = dbFee
          studentId = dbFee.student_id
        } else {
          // Check localStorage fallback
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('edumanage_fees_')) {
              try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]')
                const matched = parsed.find((f: any) => f.id === feeId && f.school_id === schoolId)
                if (matched) {
                  loadedFee = {
                    id: matched.id,
                    student_id: key.replace('edumanage_fees_', ''),
                    school_id: schoolId as string,
                    created_at: matched.created_at || new Date().toISOString(),
                    paid_at: matched.paid_at,
                    amount: matched.amount || 0,
                    status: matched.status || 'pending',
                    month: matched.month
                  }
                  studentId = loadedFee.student_id
                  break
                }
              } catch (e) {
                console.error('Error scanning localStorage key:', key, e)
              }
            }
          }
        }

        if (!loadedFee || !studentId) {
          setError('Fee record not found.')
          setLoading(false)
          return
        }

        setFee(loadedFee)

        // 2. Fetch Student details
        const { data: dbStudent } = await supabase
          .from('students')
          .select('id, full_name, parent_name, parent_phone, class_name')
          .eq('id', studentId)
          .eq('school_id', schoolId)
          .maybeSingle()

        if (dbStudent) {
          setStudent(dbStudent)
        } else {
          setStudent({
            id: studentId,
            full_name: 'Unknown Student',
            parent_name: 'N/A',
            parent_phone: null,
            class_name: 'N/A'
          })
        }

        // 3. Generate Display roll ID
        const { data: allStudents } = await supabase
          .from('students')
          .select('id, created_at')
          .eq('school_id', schoolId)

        if (allStudents) {
          const sorted = [...allStudents].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
            if (timeA !== timeB) return timeA - timeB
            return a.id.localeCompare(b.id)
          })

          const idx = sorted.findIndex(s => s.id === studentId)
          if (idx !== -1) {
            setDisplayId(`Stu-${idx + 1}`)
          }
        }

        // 4. Fetch School demographics details
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name, address, phone, email, academic_session')
          .eq('id', schoolId)
          .maybeSingle()

        if (schoolData) {
          setSchool(schoolData)
        } else {
          setSchool({
            name: 'EduManage School ERP',
            address: 'Main Campus, School Road',
            phone: '+91 98765 43210',
            email: 'admin@school.com',
            academic_session: '2026-27'
          })
        }

      } catch (err: any) {
        console.error('Error loading receipt details:', err)
        setError(err.message || 'Failed to compile receipt details.')
      } finally {
        setLoading(false)
      }
    }

    void loadReceipt()
  }, [feeId, schoolId])

  const formatINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatReceiptDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return '-'
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return '-'
    }
  }

  const cleanPhone = (phone: string | null) => {
    if (!phone) return ''
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned
    }
    return cleaned
  }

  const handleWhatsAppShare = () => {
    if (!fee || !student || !school) return

    const parentPhone = cleanPhone(student.parent_phone)
    const paidDate = formatReceiptDate(fee.paid_at || fee.created_at)
    const formattedAmount = formatINR(fee.amount)

    const message = `*FEE PAYMENT RECEIPT*\n` +
      `--------------------------------\n` +
      `*School:* ${school.name}\n` +
      `*Receipt No:* REC-${fee.month.substring(0, 3).toUpperCase()}-${fee.id.substring(0, 8).toUpperCase()}\n` +
      `*Student:* ${student.full_name}\n` +
      `*Roll / ID:* ${displayId}\n` +
      `*Class:* Class ${student.class_name}\n` +
      `*Description:* Tuition Fee for ${fee.month}\n` +
      `*Amount Paid:* ${formattedAmount}\n` +
      `*Status:* PAID\n` +
      `*Payment Date:* ${paidDate}\n\n` +
      `Thank you for the payment!\n` +
      `- ${school.name}`

    const url = `https://api.whatsapp.com/send?phone=${parentPhone}&text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleBackNavigation = () => {
    // If there is history to go back to, use router.back(), otherwise fallback to /fees dashboard
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/fees')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[300px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Compiling Receipt details...</p>
        </div>
      </div>
    )
  }

  if (error || !fee || !student || !school) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-605 flex items-center justify-center mx-auto border border-rose-100">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800">Failed to load Receipt</h3>
        <p className="text-sm text-slate-505">{error || 'An unexpected error occurred.'}</p>
        <button
          onClick={handleBackNavigation}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-all cursor-pointer"
        >
          Go Back
        </button>
      </div>
    )
  }

  const receiptNo = `REC-${fee.month.substring(0, 3).toUpperCase()}-${fee.id.substring(0, 8).toUpperCase()}`

  return (
    <div className="max-w-2xl mx-auto space-y-6 print:py-0 print:px-0">
      
      {/* Action Navigation Header */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 print:hidden animate-in fade-in duration-200">
        <button
          onClick={handleBackNavigation}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-650 transition-colors cursor-pointer group"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Back
        </button>

        <div className="flex items-center gap-2.5">
          {student.parent_phone && (
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-100/50 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.588 2.022 14.12 1 11.5 1c-5.44 0-9.866 4.372-9.87 9.802 0 1.698.459 3.355 1.328 4.866l-.99 3.614 3.74-.969c1.472.793 2.946 1.156 4.49 1.156h-.002zm9.667-6.715c-.263-.13-1.554-.755-1.792-.841-.237-.086-.41-.13-.582.13-.172.26-.665.841-.814 1.01-.148.172-.297.19-.56.06-.263-.13-1.11-.402-2.114-1.287-.782-.688-1.31-1.538-1.464-1.798-.154-.26-.016-.401.116-.531.118-.117.262-.303.394-.455.132-.152.176-.26.263-.433.088-.173.044-.325-.022-.455-.066-.13-.582-1.383-.797-1.897-.21-.499-.418-.43-.582-.43-.15 0-.323-.007-.495-.007-.172 0-.452.064-.688.319-.237.256-.904.871-.904 2.124 0 1.252.923 2.459 1.05 2.632.129.172 1.815 2.73 4.398 3.824.614.26 1.094.416 1.468.534.618.192 1.18.165 1.625.099.496-.073 1.554-.626 1.773-1.229.219-.603.219-1.121.154-1.23-.066-.109-.239-.172-.502-.302z" />
              </svg>
              Send on WhatsApp
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Print Receipt
          </button>
        </div>
      </div>

      {/* The Printable Receipt Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0 relative overflow-hidden flex flex-col justify-between min-h-[600px] print:min-h-0">
        
        {/* Top Watermark Badge */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-50 rounded-full flex items-center justify-center opacity-40 select-none pointer-events-none print:hidden">
          <div className="w-24 h-24 border-8 border-dashed border-indigo-200 rounded-full" />
        </div>

        <div>
          {/* School Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-105">
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2.5">
                <div className="bg-indigo-600 p-2 rounded-xl text-white">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{school.name}</h1>
              </div>
              <p className="text-xs text-slate-500 font-medium max-w-sm">{school.address}</p>
            </div>
            
            <div className="text-center sm:text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold uppercase tracking-wider">
                Session {school.academic_session}
              </span>
              <div className="text-[10px] text-slate-405 font-semibold space-y-0.5 pt-1">
                {school.phone && <p>Tel: {school.phone}</p>}
                {school.email && <p>Email: {school.email}</p>}
              </div>
            </div>
          </div>

          {/* Receipt Title & Status Bar */}
          <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">Fee Payment Receipt</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Receipt No: <span className="text-slate-655 font-black">{receiptNo}</span></p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-700 uppercase tracking-wider animate-fade-in">
                Paid
              </span>
            </div>
          </div>

          {/* Student details Grid */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 mb-8">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3.5 select-none">Student Demographics</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-150/40">
                <span className="text-slate-450 font-semibold">Student Name</span>
                <strong className="text-slate-800 font-bold">{student.full_name}</strong>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-150/40">
                <span className="text-slate-450 font-semibold">Roll ID / Display ID</span>
                <strong className="text-slate-800 font-bold">{displayId}</strong>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 sm:border-b-0 border-b border-slate-150/40 sm:pb-0">
                <span className="text-slate-450 font-semibold">Class / Section</span>
                <strong className="text-slate-800 font-bold">Class {student.class_name}</strong>
              </div>
              <div className="flex justify-between items-center text-xs sm:pb-0">
                <span className="text-slate-450 font-semibold">Parent/Guardian</span>
                <strong className="text-slate-800 font-bold">{student.parent_name}</strong>
              </div>
            </div>
          </div>

          {/* Payment Particulars Table */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden mb-8">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-wider border-b border-slate-250/30">
                  <th className="px-5 py-3">Description / Particulars</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-5 py-4 font-bold text-slate-705">
                    Tuition Fee
                    <span className="block text-[10px] text-slate-400 font-medium mt-0.5">Billed for the month of {fee.month}</span>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-800 font-extrabold text-sm">{formatINR(fee.amount)}</td>
                </tr>
                <tr className="bg-slate-50/30 font-bold text-slate-800">
                  <td className="px-5 py-3.5 text-right font-black uppercase text-[10px] tracking-wider text-slate-400">Total Paid (INR)</td>
                  <td className="px-5 py-3.5 text-right text-indigo-700 font-black text-base">{formatINR(fee.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Verification Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block select-none">Payment Date & Time</span>
              <span className="font-bold text-slate-600 block">{formatReceiptDate(fee.paid_at || fee.created_at)}</span>
            </div>
            
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block select-none">Billed On</span>
              <span className="font-bold text-slate-600 block">{formatReceiptDate(fee.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Receipt Footer */}
        <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-400 font-semibold select-none">
          <p className="text-center sm:text-left">This is an electronically generated receipt. No signature is required.</p>
          <p className="font-bold uppercase tracking-wider text-indigo-650">Powered by EduManage ERP</p>
        </div>

      </div>

    </div>
  )
}
