import React, { useMemo, useState } from 'react'
import Link from 'next/link'

type FeeRecord = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  paid_at?: string | null
  amount: number
  status: string
  month: string
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  } catch (e) {
    return '-'
  }
}

interface FeesSectionProps {
  fees: FeeRecord[]
  onPayFee: (feeId: string) => void
  onPayMultipleFees: (feeIds: string[]) => void
  onOpenAddFeeModal: () => void
  studentName?: string
}

export default function FeesSection({
  fees,
  onPayFee,
  onPayMultipleFees,
  onOpenAddFeeModal,
  studentName
}: FeesSectionProps) {
  const [selectedFees, setSelectedFees] = useState<string[]>([])

  const exportFeesToCSV = () => {
    if (fees.length === 0) return

    const headers = 'Fee Month,Amount (INR),Status,Billing Date\r\n'
    const rows = [...fees]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(f => {
        const dateStr = f.created_at ? new Date(f.created_at).toLocaleDateString() : 'N/A'
        return `"${f.month.replace(/"/g, '""')}",${f.amount},"${f.status || 'Pending'}","${dateStr}"`
      })
      .join('\r\n')

    const csvContent = headers + rows
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    
    const formattedName = studentName ? studentName.toLowerCase().replace(/\s+/g, '_') : 'student'
    const filename = `${formattedName}_fees_history.csv`
    
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const summary = useMemo(() => {
    let total = 0
    let paid = 0
    let pending = 0

    fees.forEach(f => {
      const amt = Number(f.amount) || 0
      total += amt
      if (f.status?.toLowerCase() === 'paid') {
        paid += amt
      } else {
        pending += amt
      }
    })

    return { total, paid, pending }
  }, [fees])

  // Get all pending fees
  const pendingFees = useMemo(() => {
    return fees.filter(f => f.status?.toLowerCase() !== 'paid')
  }, [fees])

  // Check if all pending fees are selected
  const allPendingSelected = useMemo(() => {
    if (pendingFees.length === 0) return false
    return pendingFees.every(f => selectedFees.includes(f.id))
  }, [pendingFees, selectedFees])

  // Toggle single fee selection
  const toggleSelect = (id: string) => {
    setSelectedFees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Toggle select all pending
  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      // Remove all pending fees from selected list
      setSelectedFees(prev => prev.filter(id => !pendingFees.some(f => f.id === id)))
    } else {
      // Add all pending fees to selected list
      setSelectedFees(prev => {
        const otherSelected = prev.filter(id => !pendingFees.some(f => f.id === id))
        return [...otherSelected, ...pendingFees.map(f => f.id)]
      })
    }
  }

  // Calculate sum of selected fees
  const selectedAmount = useMemo(() => {
    return fees
      .filter(f => selectedFees.includes(f.id))
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
  }, [fees, selectedFees])

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fees Summary
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Manage and track student tuition payments</p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedFees.length > 0 && (
            <button
              onClick={() => {
                onPayMultipleFees(selectedFees)
                setSelectedFees([])
              }}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Pay Selected (₹{selectedAmount})
            </button>
          )}

          {fees.length > 0 && (
            <button
              onClick={exportFeesToCSV}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}

          <button
            onClick={onOpenAddFeeModal}
            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Fee
          </button>
        </div>
      </div>

      {/* Financial Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Fees */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed</span>
            <p className="text-xl font-black text-slate-800">₹{summary.total}</p>
          </div>
          <div className="p-2.5 bg-white rounded-xl text-slate-400 border border-slate-100 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Paid Amount */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Paid</span>
            <p className="text-xl font-black text-emerald-600">₹{summary.paid}</p>
          </div>
          <div className="p-2.5 bg-white rounded-xl text-emerald-500 border border-slate-100 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Pending Amount */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Balance</span>
            <div className="flex items-center gap-2">
              <p className="text-xl font-black text-rose-500">₹{summary.pending}</p>
              {summary.pending > 0 && (
                <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">
                  Outstanding
                </span>
              )}
            </div>
          </div>
          <div className="p-2.5 bg-white rounded-xl text-rose-400 border border-slate-100 shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Invoice/Fees List Table */}
      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        {fees.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic font-medium text-sm">
            No fee schedules created for this student yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3 w-10">
                    {pendingFees.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={toggleSelectAllPending}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    )}
                  </th>
                  <th className="px-5 py-3">Fee Month</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Paid On</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...fees]
                  .sort((a, b) => {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  })
                  .map((fee) => {
                    const isPaid = fee.status?.toLowerCase() === 'paid'
                    return (
                      <tr key={fee.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-5 py-3.5">
                          {!isPaid ? (
                            <input
                              type="checkbox"
                              checked={selectedFees.includes(fee.id)}
                              onChange={() => toggleSelect(fee.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          ) : (
                            <div className="w-3.5 h-3.5 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800">{fee.month}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-600">₹{fee.amount}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {fee.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs font-semibold">{formatDate(fee.paid_at)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {!isPaid ? (
                            <button
                              onClick={() => onPayFee(fee.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          ) : (
                            <Link
                              href={`/receipt/${fee.id}`}
                              target="_blank"
                              className="bg-emerald-50 hover:bg-emerald-105 border border-emerald-250/35 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-emerald-605" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                              </svg>
                              Receipt
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
