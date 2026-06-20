"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "../../../../lib/supabase"

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

type Params = { id?: string }

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

export default function DocumentDetailPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params)
  const docId = resolvedParams.id

  const [loading, setLoading] = useState(true)
  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [documentType, setDocumentType] = useState("Other")
  const [isSaving, setIsSaving] = useState(false)

  async function fetchDocDetails() {
    if (!docId) return
    try {
      setLoading(true)

      // Fetch document metadata
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", docId)
        .single()

      if (docError) throw docError
      setDocument(docData)
      setDocumentType(docData.document_type || "Other")
      setNewFileName(getDocumentName(docData.file_url))

      // Fetch student details
      if (docData?.student_id) {
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("id, full_name, class_name, parent_name, parent_phone")
          .eq("id", docData.student_id)
          .single()

        if (!studentError && studentData) {
          // Check Teacher access
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: staffData } = await supabase
              .from('staff')
              .select('id, role')
              .eq('user_id', session.user.id)
              .single()

            if (staffData && staffData.role === 'Teacher') {
              const { data: classData } = await supabase
                .from('teacher_classes')
                .select('class_name')
                .eq('teacher_id', staffData.id)

              const teacherClasses = classData?.map(c => c.class_name) || []
              if (!teacherClasses.includes(studentData.class_name)) {
                setDocument(null)
                setStudent(null)
                alert('Access Denied: You do not have permission to view documents for this class.')
                window.location.href = '/documents'
                return
              }
            }
          }
          setStudent(studentData)
        }
      }

      // Fetch signed URL for preview/viewing
      if (docData?.file_url) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("student-documents")
          .createSignedUrl(docData.file_url, 3600) // 1 hour token
        
        if (!signedError && signedData) {
          setSignedUrl(signedData.signedUrl)
        }
      }
    } catch (e) {
      console.error("Failed to load document details:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDocDetails()
  }, [docId])

  // Single file download
  const handleDownload = async () => {
    if (!document?.file_url) return
    try {
      const docName = getDocumentName(document.file_url)
      const { data, error } = await supabase.storage
        .from("student-documents")
        .download(document.file_url)
      
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
  const handleDelete = async () => {
    if (!document) return
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this document?")
    if (!confirmDelete) return

    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from("student-documents")
        .remove([document.file_url])

      if (storageError) {
        console.warn("Storage deletion warning:", storageError.message)
      }

      // 2. Delete from Database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id)

      if (dbError) throw dbError

      alert("Document deleted successfully.")
      window.location.href = "/documents"
    } catch (e: any) {
      console.error("Deletion failed:", e)
      alert(`Delete failed: ${e.message}`)
    }
  }

  // Save metadata changes (Type, Name)
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!document || !newFileName.trim()) return

    setIsSaving(true)
    try {
      const oldPath = document.file_url
      const pathParts = oldPath.split('/')
      const originalFileName = pathParts.pop() || ""
      
      // Separate timestamp from original filename
      const timestampMatch = originalFileName.match(/^(\d{13})_/)
      const timestampPrefix = timestampMatch ? `${timestampMatch[1]}_` : ""
      
      // Form new storage filename
      const cleanNewFileName = newFileName.trim().replace(/[\/\\?%*:|"<>]/g, '-')
      const newStorageName = `${timestampPrefix}${cleanNewFileName}`
      
      // Build new storage path
      const newPath = [...pathParts, newStorageName].join('/')

      let finalPath = oldPath

      // If the filename has actually changed, rename it in storage
      if (newPath !== oldPath) {
        const { error: copyError } = await supabase.storage
          .from("student-documents")
          .copy(oldPath, newPath)

        if (copyError) {
          throw new Error(`Failed to copy file in storage: ${copyError.message}`)
        }

        const { error: removeError } = await supabase.storage
          .from("student-documents")
          .remove([oldPath])

        if (removeError) {
          console.warn("Could not delete old storage file during rename:", removeError.message)
        }

        finalPath = newPath
      }

      // Update Database details
      const { error: dbError } = await supabase
        .from("documents")
        .update({
          document_type: documentType,
          file_url: finalPath
        })
        .eq("id", document.id)

      if (dbError) throw dbError

      setIsEditing(false)
      await fetchDocDetails() // reload details
      alert("Document details updated successfully.")
    } catch (e: any) {
      console.error("Rename/Update failed:", e)
      alert(`Update failed: ${e.message || e}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 bg-slate-100 rounded-lg w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-96 bg-slate-100 rounded-2xl" />
          <div className="h-80 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 text-center py-16">
        <h2 className="text-xl font-bold text-slate-800">Document Not Found</h2>
        <p className="text-slate-400 text-sm">The document requested could not be found or has been deleted.</p>
        <Link href="/documents" className="inline-flex items-center text-xs font-bold text-indigo-600 hover:underline">
          Go back to documents directory
        </Link>
      </div>
    )
  }

  const docName = getDocumentName(document.file_url)
  const ext = getFileExtension(docName)
  const isImage = ["png", "jpg", "jpeg"].includes(ext)
  const isPdf = ext === "pdf"

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Back to documents directory
        </Link>
      </div>

      {/* Main Page Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 Columns: Viewer Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {/* Viewer Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Preview</span>
            {signedUrl && (
              <a 
                href={signedUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                Open Original
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Preview Container */}
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/20">
            {signedUrl ? (
              isImage ? (
                <div className="relative max-w-full max-h-[500px] rounded-xl overflow-hidden shadow-sm border border-slate-200/60 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={signedUrl} 
                    alt={docName} 
                    className="object-contain max-w-full max-h-[500px]"
                  />
                </div>
              ) : isPdf ? (
                <iframe 
                  src={`${signedUrl}#toolbar=0`} 
                  className="w-full h-[550px] border border-slate-250/50 rounded-xl shadow-sm"
                  title="PDF Document Preview"
                />
              ) : (
                <div className="p-8 text-center space-y-4 max-w-xs bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <div className="mx-auto p-4 bg-slate-50 border border-slate-100 rounded-2xl w-fit text-slate-500">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Preview Not Available</h4>
                  <p className="text-xs text-slate-400 font-medium">This file type ({ext || "unknown"}) cannot be previewed in the browser.</p>
                  <button 
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Download File
                  </button>
                </div>
              )
            ) : (
              <span className="text-slate-400 text-xs font-semibold">Generating preview...</span>
            )}
          </div>
        </div>

        {/* Right 1 Column: Metadata & Actions Panel */}
        <div className="space-y-6">
          {/* Card 1: Details & Metadata */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100/30 px-2.5 py-0.5 rounded-lg w-fit">
                {document.document_type}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-2 truncate" title={docName}>{docName}</h3>
              <p className="text-[10px] text-slate-400 font-semibold block mt-0.5">Uploaded {new Date(document.created_at).toLocaleDateString()}</p>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Associated Student</span>
              {student ? (
                <div className="flex items-center gap-3 bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-50 to-violet-50 text-indigo-600 font-black flex items-center justify-center border border-indigo-100 shrink-0">
                    {student.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/students/${student.id}`} className="text-xs font-bold text-slate-800 hover:text-indigo-650 block truncate">
                      {student.full_name}
                    </Link>
                    <span className="text-[10px] font-bold text-slate-450 block mt-0.5">Class {student.class_name}</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold text-slate-400">Loading student details...</span>
              )}
            </div>

            {/* Quick Actions list */}
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2.5">
              <button 
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-550 hover:bg-indigo-600 text-white py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm shadow-indigo-550/10 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Document
              </button>

              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Modify File Details
              </button>

              <button 
                onClick={handleDelete}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Document
              </button>
            </div>
          </div>

          {/* Card 2: Inline Editor Panel */}
          {isEditing && (
            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-250">
              <h4 className="text-sm font-bold text-slate-800">Edit Settings</h4>
              <form onSubmit={handleSaveChanges} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">File Name</label>
                  <input 
                    type="text" 
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 text-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-505 transition-all bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category Type</label>
                  <select 
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white cursor-pointer"
                  >
                    <option value="Birth Certificate">Birth Certificate</option>
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Transfer Certificate">Transfer Certificate</option>
                    <option value="Student Photograph">Student Photograph</option>
                    <option value="Medical Record">Medical Record</option>
                    <option value="Admission Form">Admission Form</option>
                    <option value="Report Card">Report Card</option>
                    <option value="Transcript">Transcript</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-2 justify-end border-t border-slate-50">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md transition-all active:scale-[0.98]"
                  >
                    {isSaving ? "Saving..." : "Save Details"}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
