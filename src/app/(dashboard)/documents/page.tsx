'use client'

import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import JSZip from 'jszip'
import { useSchool } from '../../../lib/SchoolContext'

type Student = {
  id: string
  full_name: string
  class_name: string
  parent_name?: string
  parent_phone?: string
}  

type DocumentRecord = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  file_url: string
  document_type: string
}

const REQUIRED_TYPES = [
  "Birth Certificate",
  "Aadhaar Card",
  "Transfer Certificate",
  "Student Photograph"
]

function getDocumentName(url: string): string {
  try {
    const filename = url.split('/').pop() || 'document.pdf'
    const cleaned = decodeURIComponent(filename).replace(/^\d{13}_/, '')
    return cleaned
  } catch (e) {
    return 'document.pdf'
  }
}

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}

export default function DocumentsDashboardPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<string[]>([])

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('all')
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState('all')
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'uploaded' | 'missing'>('all')

  // Row expansion state
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  // Upload modal/form states
  const [uploadStudentId, setUploadStudentId] = useState('')
  const [uploadDocType, setUploadDocType] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bulk exporting loader
  const [isExporting, setIsExporting] = useState<string | null>(null)

  // Load data
  async function loadData() {
    if (!schoolId) return
    try {
      setLoading(true)

      // Get user session and role
      const { data: { session } } = await supabase.auth.getSession()
      let isTeacher = false
      let assigned: string[] = []

      if (session?.user) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, role')
          .eq('user_id', session.user.id)
          .eq('school_id', schoolId)
          .single()

        if (staffData) {
          setUserRole(staffData.role)
          if (staffData.role === 'Teacher') {
            isTeacher = true
            const { data: classData } = await supabase
              .from('teacher_classes')
              .select('classes(name)')
              .eq('teacher_id', staffData.id)

            if (classData) {
              assigned = classData.map((c: any) => c.classes?.name).filter(Boolean)
              setTeacherClasses(assigned)
            }
          }
        }
      }

      // 1. Fetch students
      let studentQuery = supabase
        .from('students')
        .select('id, full_name, class_name, parent_name, parent_phone')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true })

      if (isTeacher) {
        if (assigned.length > 0) {
          studentQuery = studentQuery.in('class_name', assigned)
        } else {
          setStudents([])
          setDocuments([])
          setLoading(false)
          return
        }
      }

      const { data: studentsData, error: studentsError } = await studentQuery
      if (studentsError) throw studentsError
      setStudents(studentsData || [])

      const teacherStudentIds = (studentsData || []).map(s => s.id)

      // 2. Fetch documents
      let docsQuery = supabase
        .from('documents')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (isTeacher) {
        docsQuery = docsQuery.in('student_id', teacherStudentIds)
      }

      const { data: docsData, error: docsError } = await docsQuery
      if (docsError) throw docsError
      setDocuments(docsData || [])
    } catch (e) {
      console.error('Failed to load compliance data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return
    void loadData()
  }, [schoolId])

  // Derived list of classes
  const availableClasses = useMemo(() => {
    return Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
  }, [students])

  // Helper matching function for standard document types
  const getDocumentForType = (studentDocs: DocumentRecord[], type: string) => {
    return studentDocs.find(d => {
      const dt = d.document_type || "";
      const cleanType = type.toLowerCase();
      
      if (cleanType === "birth certificate") {
        return dt.toLowerCase() === "birth certificate";
      }
      if (cleanType === "aadhaar card") {
        return dt.toLowerCase() === "aadhaar card" || dt.toLowerCase() === "aadhaar";
      }
      if (cleanType === "transfer certificate") {
        return dt.toLowerCase() === "transfer certificate" || dt.toLowerCase() === "tc";
      }
      if (cleanType === "student photograph") {
        return dt.toLowerCase() === "student photograph" || dt.toLowerCase() === "student photo" || dt.toLowerCase() === "passport photo" || dt.toLowerCase() === "photo";
      }
      return false;
    });
  }

  // Pre-calculated stats
  const stats = useMemo(() => {
    const totalDocs = documents.length
    
    // Unique students covered (having at least one document)
    const uniqueCovered = new Set(documents.map(d => d.student_id)).size

    // Calculate missing documents
    let missingDocsCount = 0
    students.forEach(student => {
      const studentDocs = documents.filter(d => d.student_id === student.id)
      REQUIRED_TYPES.forEach(type => {
        const hasDoc = getDocumentForType(studentDocs, type)
        if (!hasDoc) {
          missingDocsCount++
        }
      })
    })

    // Recent Uploads (past 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentUploadsCount = documents.filter(d => new Date(d.created_at) >= sevenDaysAgo).length

    return {
      totalDocs,
      coveredStudents: uniqueCovered,
      missingDocs: missingDocsCount,
      recentUploads: recentUploadsCount
    }
  }, [documents, students])

  // Map students with their compliance status
  const studentsCompliance = useMemo(() => {
    return students.map(student => {
      const studentDocs = documents.filter(d => d.student_id === student.id)
      
      const checklist = REQUIRED_TYPES.map(type => {
        const doc = getDocumentForType(studentDocs, type)
        return {
          type,
          uploaded: !!doc,
          document: doc || null
        }
      })

      const uploadedCount = checklist.filter(item => item.uploaded).length
      const missingList = checklist.filter(item => !item.uploaded).map(item => item.type === "Transfer Certificate" ? "TC" : item.type === "Student Photograph" ? "Photo" : item.type)

      return {
        ...student,
        checklist,
        uploadedCount,
        totalRequired: REQUIRED_TYPES.length,
        missingList,
        isFullyUploaded: uploadedCount === REQUIRED_TYPES.length
      }
    })
  }, [students, documents])

  // Filtered compliance records
  const filteredRecords = useMemo(() => {
    return studentsCompliance.filter(record => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = record.full_name.toLowerCase().includes(search)
      const matchesClass = selectedClass === 'all' || record.class_name === selectedClass

      // Filter by compliance status tabs
      let matchesStatus = true
      if (selectedStatusTab === 'uploaded') {
        matchesStatus = record.isFullyUploaded
      } else if (selectedStatusTab === 'missing') {
        matchesStatus = !record.isFullyUploaded
      }

      // Filter by having specific document type uploaded
      let matchesDocType = true
      if (selectedDocTypeFilter !== 'all') {
        const item = record.checklist.find(i => i.type === selectedDocTypeFilter)
        matchesDocType = !!item?.uploaded
      }

      return matchesSearch && matchesClass && matchesStatus && matchesDocType
    })
  }, [studentsCompliance, searchTerm, selectedClass, selectedStatusTab, selectedDocTypeFilter])

  // Get view URL
  const handleView = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("student-documents")
        .createSignedUrl(fileUrl, 60)
      
      if (error) {
        console.error("Error creating signed URL:", error.message)
        alert(`Failed to get view link: ${error.message}`)
        return
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (e) {
      console.error("Error signing URL:", e)
    }
  }

  // Download single doc
  const handleDownload = async (fileUrl: string) => {
    try {
      const docName = getDocumentName(fileUrl)
      const { data, error } = await supabase.storage
        .from("student-documents")
        .download(fileUrl)
      
      if (error) throw error
      
      if (data) {
        const url = URL.createObjectURL(data)
        const link = window.document.createElement("a")
        link.href = url
        link.download = docName
        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (e: any) {
      console.error("Download failed:", e)
      alert(`Download failed: ${e.message}`)
    }
  }

  // Delete document
  const handleDelete = async (docId: string, fileUrl: string) => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this document?")
    if (!confirmDelete) return

    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from("student-documents")
        .remove([fileUrl])

      if (storageError) {
        console.warn("Storage deletion warning:", storageError.message)
      }

      // 2. Delete from Database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId)

      if (dbError) throw dbError

      alert("Document deleted successfully.")
      await loadData() // reload
    } catch (e: any) {
      console.error("Deletion failed:", e)
      alert(`Delete failed: ${e.message}`)
    }
  }

  // Direct upload handlers
  const openUploadModal = (studentId: string, type: string) => {
    setUploadStudentId(studentId)
    setUploadDocType(type)
    setIsUploadModalOpen(true)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadStudentId || !uploadDocType || !selectedFile) {
      alert("All fields are required.")
      return
    }
    if (!schoolId) {
      alert("No active school selected.")
      return
    }

    setIsUploading(true)
    const filePath = `${schoolId}/${uploadStudentId}/${Date.now()}_${selectedFile.name}`

    try {
      // 1. Storage upload
      const { error: uploadError } = await supabase.storage
        .from("student-documents")
        .upload(filePath, selectedFile)

      if (uploadError) throw uploadError

      // 2. DB Insert
      const { error: insertError } = await supabase
        .from("documents")
        .insert({
          school_id: schoolId,
          student_id: uploadStudentId,
          document_type: uploadDocType,
          file_url: filePath
        })

      if (insertError) throw insertError

      alert("Document uploaded successfully!")
      setIsUploadModalOpen(false)
      setSelectedFile(null)
      setUploadStudentId('')
      setUploadDocType('')
      await loadData() // refresh list
    } catch (err: any) {
      console.error("Upload failed:", err)
      alert(`Upload failed: ${err.message || err}`)
    } finally {
      setIsUploading(false)
    }
  }

  // Export ZIP package for a specific student
  const handleExportZIP = async (studentId: string, studentName: string) => {
    const studentDocs = documents.filter(d => d.student_id === studentId)
    if (studentDocs.length === 0) {
      alert(`No documents uploaded for student: ${studentName}`)
      return
    }

    setIsExporting(studentId)
    try {
      const zip = new JSZip()
      const nameCounts: Record<string, number> = {}

      for (const doc of studentDocs) {
        const originalName = getDocumentName(doc.file_url)
        let docName = originalName

        if (nameCounts[originalName] !== undefined) {
          nameCounts[originalName]++
          const dotIndex = originalName.lastIndexOf('.')
          if (dotIndex !== -1) {
            const base = originalName.slice(0, dotIndex)
            const ext = originalName.slice(dotIndex)
            docName = `${base} (${nameCounts[originalName]})${ext}`
          } else {
            docName = `${originalName} (${nameCounts[originalName]})`
          }
        } else {
          nameCounts[originalName] = 0
        }

        const { data, error } = await supabase.storage
          .from("student-documents")
          .download(doc.file_url)

        if (!error && data) {
          zip.file(docName, data)
        }
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const link = window.document.createElement("a")
      link.href = url
      link.download = `${studentName.toLowerCase().replace(/\s+/g, '_')}_compliance_documents.zip`
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error("ZIP export failed:", e)
      alert(`ZIP package export failed: ${e.message}`)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200/60">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Documents Vault</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Compliance tracker for student certifications, Aadhaar cards, TCs, and photos.</p>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Documents Card */}
        <div className="bg-white hover:shadow-md hover:border-slate-350/50 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Documents</span>
            {loading ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalDocs}</h3>
            )}
            <span className="text-[10px] font-semibold text-slate-400">Total uploaded files</span>
          </div>
          <div className="bg-indigo-50/60 text-indigo-650 p-3.5 rounded-xl border border-indigo-100/30 shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        {/* Students Covered Card */}
        <div className="bg-white hover:shadow-md hover:border-slate-350/50 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Students Covered</span>
            {loading ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.coveredStudents}</h3>
            )}
            <span className="text-[10px] font-semibold text-indigo-650 bg-indigo-50/60 border border-indigo-100/30 px-2 py-0.5 rounded">
              {students.length > 0 ? Math.round((stats.coveredStudents / students.length) * 100) : 0}% compliance rate
            </span>
          </div>
          <div className="bg-emerald-50/60 text-emerald-600 p-3.5 rounded-xl border border-emerald-100/30 shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Missing Documents Card */}
        <div className="bg-white hover:shadow-md hover:border-slate-350/50 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Missing Documents</span>
            {loading ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <h3 className="text-3xl font-black text-rose-600 tracking-tight">{stats.missingDocs}</h3>
            )}
            <span className="text-[10px] font-semibold text-rose-600">Pending submissions</span>
          </div>
          <div className="bg-rose-50/60 text-rose-600 p-3.5 rounded-xl border border-rose-100/30 shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Recent Uploads Card */}
        <div className="bg-white hover:shadow-md hover:border-slate-350/50 transition-all rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recent Uploads</span>
            {loading ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <h3 className="text-3xl font-black text-amber-600 tracking-tight">{stats.recentUploads}</h3>
            )}
            <span className="text-[10px] font-semibold text-slate-400 font-medium">Uploaded past 7 days</span>
          </div>
          <div className="bg-amber-50/60 text-amber-600 p-3.5 rounded-xl border border-amber-100/30 shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

      </div>

      {/* Main compliance section */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Filter Bar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/25 space-y-6">
          <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
            
            {/* Search and class select */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search student by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white placeholder-slate-400 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>

              {/* Document Type Dropdown */}
              <select
                value={selectedDocTypeFilter}
                onChange={(e) => setSelectedDocTypeFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-655 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
              >
                <option value="all">Document Type: All</option>
                {REQUIRED_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {/* Class Dropdown */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-655 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
              >
                <option value="all">Class: All</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            {/* Compliance Status Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl self-start md:self-auto shadow-inner">
              <button
                onClick={() => setSelectedStatusTab('all')}
                className={`px-4.5 py-1.8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  selectedStatusTab === 'all'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatusTab('uploaded')}
                className={`px-4.5 py-1.8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  selectedStatusTab === 'uploaded'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                All Uploaded
              </button>
              <button
                onClick={() => setSelectedStatusTab('missing')}
                className={`px-4.5 py-1.8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  selectedStatusTab === 'missing'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Missing
              </button>
            </div>

          </div>
        </div>

        {/* Main Table */}
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-20 text-center space-y-4 max-w-md mx-auto">
            <div className="mx-auto h-12 w-12 text-slate-400 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">No matching students found</h3>
            <p className="text-xs text-slate-400 font-medium">Verify your filter settings, class selection, or search queries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 pl-6">Student</th>
                  <th className="py-4">Class</th>
                  <th className="py-4">Documents</th>
                  <th className="py-4">Missing</th>
                  <th className="py-4 text-right pr-6">Bulk Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map(record => {
                  const isExpanded = expandedStudentId === record.id
                  const isFractionGreen = record.uploadedCount === record.totalRequired
                  const isFractionYellow = record.uploadedCount > 0 && record.uploadedCount < record.totalRequired
                  
                  return (
                    <Fragment key={record.id}>
                      {/* Interactive Row */}
                      <tr 
                        key={record.id} 
                        onClick={() => setExpandedStudentId(isExpanded ? null : record.id)}
                        className={`group cursor-pointer transition-all hover:bg-slate-50/40 select-none ${
                          isExpanded ? 'bg-indigo-50/10 border-l-2 border-indigo-600' : ''
                        }`}
                      >
                        {/* Student Name */}
                        <td className="py-4.5 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 border border-indigo-100 text-indigo-600 font-black flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-[1.03]">
                              {record.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600 transition-colors">
                                {record.full_name}
                              </span>
                              <Link 
                                href={`/students/${record.id}`}
                                onClick={(e) => e.stopPropagation()} // don't toggle expansion when profile link clicked
                                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 mt-0.5 block hover:underline"
                              >
                                View ERP Profile
                              </Link>
                            </div>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="py-4.5 text-xs font-bold text-slate-700">
                          Class {record.class_name || 'Unassigned'}
                        </td>

                        {/* Documents fraction progress */}
                        <td className="py-4.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black border select-none ${
                              isFractionGreen
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                                : isFractionYellow
                                  ? 'bg-amber-50 text-amber-700 border-amber-100/50'
                                  : 'bg-rose-50 text-rose-700 border-rose-100/50'
                            }`}>
                              {record.uploadedCount} / {record.totalRequired}
                            </span>
                            
                            {/* Visual mini-bar */}
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isFractionGreen ? 'bg-emerald-500' : isFractionYellow ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${(record.uploadedCount / record.totalRequired) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Missing badge list */}
                        <td className="py-4.5">
                          {record.isFullyUploaded ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/30 select-none">
                              None
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-xs md:max-w-md">
                              {record.missingList.map((m, idx) => (
                                <span 
                                  key={`${m}-${idx}`}
                                  className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100/30 select-none"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Export Action */}
                        <td className="py-4.5 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleExportZIP(record.id, record.full_name)}
                            disabled={isExporting !== null || record.uploadedCount === 0}
                            className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 p-2.5 rounded-xl font-bold text-xs transition-all shadow-sm shrink-0 active:scale-95 disabled:opacity-50"
                            title="Export All to ZIP"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="hidden sm:inline">
                              {isExporting === record.id ? 'Exporting...' : 'ZIP'}
                            </span>
                          </button>
                        </td>

                      </tr>

                      {/* Expanded compliance checklist details drawer */}
                      {isExpanded && (
                        <tr key={`${record.id}-details`} className="bg-slate-50/35 border-l-2 border-indigo-650">
                          <td colSpan={5} className="py-6 px-8 border-b border-slate-100">
                            
                            {/* Inner Header */}
                            <div className="flex items-center justify-between mb-4.5 pb-2.5 border-b border-slate-150/50">
                              <div>
                                <h4 className="text-xs font-black text-slate-800 tracking-wide">Required Documents Compliance Checklist</h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Double check submissions or upload missing file categories</p>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 select-none">
                                Student ID: <span className="font-mono text-slate-600">{record.id}</span>
                              </span>
                            </div>

                            {/* Checklist Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {record.checklist.map((item, idx) => {
                                return (
                                  <div 
                                    key={`${item.type}-${idx}`} 
                                    className={`p-4.5 rounded-2xl border transition-all flex flex-col justify-between h-36 ${
                                      item.uploaded
                                        ? 'bg-white border-emerald-150/60 shadow-sm'
                                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    
                                    {/* Checklist Top Status info */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-800 tracking-wide truncate max-w-[130px]" title={item.type}>
                                          {item.type}
                                        </span>
                                        <span className={`h-2 w-2 rounded-full ${
                                          item.uploaded ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} />
                                      </div>
                                      <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                                        item.uploaded ? 'text-emerald-700' : 'text-rose-700'
                                      }`}>
                                        {item.uploaded ? 'Uploaded' : 'Missing'}
                                      </span>
                                    </div>

                                    {/* Action Links */}
                                    {item.uploaded && item.document ? (
                                      <div className="space-y-2 pt-2 border-t border-slate-50 flex flex-col">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <Link 
                                            href={`/documents/${item.document.id}`}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline block truncate max-w-[100px]"
                                            title={getDocumentName(item.document.file_url)}
                                          >
                                            {getDocumentName(item.document.file_url)}
                                          </Link>
                                          
                                          {/* Delete icon */}
                                          <button
                                            onClick={() => handleDelete(item.document!.id, item.document!.file_url)}
                                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded hover:bg-slate-50 cursor-pointer"
                                            title="Delete file"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => handleView(item.document!.file_url)}
                                            className="flex-1 text-center py-1 text-[9px] font-black uppercase text-indigo-650 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                          >
                                            View
                                          </button>
                                          <button
                                            onClick={() => handleDownload(item.document!.file_url)}
                                            className="flex-1 text-center py-1 text-[9px] font-black uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                          >
                                            Get
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="pt-2 border-t border-slate-100/50">
                                        <button
                                          onClick={() => openUploadModal(record.id, item.type)}
                                          className="w-full text-center py-1.5 text-[9px] font-black uppercase text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border border-rose-100/40"
                                        >
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                          </svg>
                                          Upload
                                        </button>
                                      </div>
                                    )}

                                  </div>
                                )
                              })}
                            </div>

                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ================= UPLOAD MULTIPART COMPLIANCE MODAL ================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity bg-slate-900/45 backdrop-blur-sm" 
              onClick={() => {
                if (!isUploading) setIsUploadModalOpen(false)
              }} 
            />
            
            <div className="relative inline-block w-full max-w-sm p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                <div>
                  <h3 className="text-base font-black text-slate-900">Upload Compliance File</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Attach specific checklist file record</p>
                </div>
                <button 
                  onClick={() => {
                    if (!isUploading) setIsUploadModalOpen(false)
                  }} 
                  className="text-slate-400 hover:text-slate-650 focus:outline-none p-1 rounded hover:bg-slate-50"
                  disabled={isUploading}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Form Info */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150/40 mb-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Target Student</span>
                <span className="text-xs font-black text-slate-800 block">
                  {students.find(s => s.id === uploadStudentId)?.full_name || 'Loading...'}
                </span>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Document Type:</span>
                  <span className="text-[10px] font-bold text-indigo-750 bg-indigo-50 border border-indigo-150/30 px-2 py-0.5 rounded-md">
                    {uploadDocType}
                  </span>
                </div>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                
                {/* Drag & drop or browse area */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Student File</label>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-indigo-500 bg-indigo-50/30'
                        : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/30'
                    }`}
                  >
                    <svg className="w-6 h-6 mx-auto text-slate-400 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {selectedFile ? (
                      <span className="text-xs font-bold text-indigo-650 truncate block max-w-[220px] mx-auto" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Click to browse or drag & drop files here
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx"
                    required
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 flex gap-3.5 justify-end border-t border-slate-50 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setIsUploadModalOpen(false)
                    }}
                    disabled={isUploading}
                    className="px-4.5 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !selectedFile}
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-650 hover:from-indigo-750 hover:to-violet-700 rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Submit File'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
