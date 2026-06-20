import React, { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase-client'
import JSZip from 'jszip'
import Link from 'next/link'

type DocumentRecord = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  file_url: string
  document_type?: string
}


interface DocumentsSectionProps {
  documents: DocumentRecord[]
  onUploadDocument: (file: File, documentType: string) => void
  onDeleteDocument: (docId: string) => void
  studentName?: string
}

const PROFILE_DOC_TYPES = [
  "Birth Certificate",
  "Aadhaar Card",
  "Transfer Certificate",
  "Student Photograph",
  "Medical Record",
  "Other"
]

function getDocumentName(url: string): string {
  try {
    const filename = url.split('/').pop() || 'document.pdf'
    // Remove timestamp prefix like '1712345678901_' if present
    const cleaned = decodeURIComponent(filename).replace(/^\d{13}_/, '')
    return cleaned
  } catch (e) {
    return 'document.pdf'
  }
}

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}

export default function DocumentsSection({
  documents,
  onUploadDocument,
  onDeleteDocument,
  studentName
}: DocumentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadType, setUploadType] = useState<string>("Birth Certificate")
  const [isExporting, setIsExporting] = useState(false)

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

  const handleExportAll = async () => {
    if (documents.length === 0) {
      alert("No documents to export.")
      return
    }

    setIsExporting(true)
    try {
      const zip = new JSZip()
      const nameCounts: Record<string, number> = {}

      for (const doc of documents) {
        const originalName = getDocumentName(doc.file_url)
        let docName = originalName

        // Handle duplicate names in the zip file
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

        if (error) {
          console.error(`Error downloading document ${doc.file_url}:`, error.message)
          continue
        }

        if (data) {
          zip.file(docName, data)
        }
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      
      const link = document.createElement("a")
      const safeStudentName = studentName ? studentName.toLowerCase().replace(/\s+/g, '_') : 'student'
      link.href = url
      link.download = `${safeStudentName}_documents.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error("Failed to export documents:", e)
      alert(`Export failed: ${e.message || e}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0])
    }
  }

  const uploadFile = async (file: File) => {
    // Validate file extension/type
    const allowedExtensions = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'xlsx', 'webp', 'heic', 'heif', 'jfif'];
    const ext = getFileExtension(file.name);
    const isImg = file.type.startsWith('image/');
    if (!allowedExtensions.includes(ext) && !isImg) {
      alert("Invalid file format. Please upload PDF, Word, Excel, or image files only.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (Max 10 MB = 10 * 1024 * 1024 bytes)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`File size exceeds the 10 MB limit. (Selected file: ${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true)
    try {
      await onUploadDocument(file, uploadType)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
      uploadFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Student Documents
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Academic forms, transcripts, and records</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {documents.length > 0 && (
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-650 hover:text-emerald-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-50 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isExporting ? 'Exporting...' : 'Export All'}
            </button>
          )}

          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            disabled={isUploading}
            className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer h-7 select-none"
          >
            {PROFILE_DOC_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 hover:text-indigo-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {isUploading ? 'Uploading...' : 'Upload file'}
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      />

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          fileInputRef.current?.click()
        }}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50/30'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5 text-slate-400">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-xs font-bold text-slate-700">Drag & drop files here</span>
          <span className="text-[10px] font-semibold text-slate-400">or click to browse from device (PDF, JPG, PNG, DOC)</span>
        </div>
      </div>

      {/* Uploaded Documents List */}
      <div className="space-y-2.5">
        {documents.length === 0 ? (
          <div className="p-6 text-center text-slate-400 italic text-xs font-medium border border-slate-100 rounded-xl">
            No documents uploaded yet.
          </div>
        ) : (
          documents.map((doc) => {
            const docName = getDocumentName(doc.file_url)
            const ext = getFileExtension(docName)
            const createdDate = new Date(doc.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl hover:border-slate-200 bg-slate-50/20 hover:bg-slate-50/50 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* File Type Icon */}
                  <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm shrink-0 text-slate-500 group-hover:text-indigo-600 transition-colors">
                    {ext === 'pdf' ? (
                      <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V8h2v4z"/>
                      </svg>
                    ) : ['png', 'jpg', 'jpeg'].includes(ext) ? (
                      <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors truncate block"
                      title={docName}
                    >
                      {docName}
                    </Link>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5 select-none">
                      <span className="text-[9px] font-bold text-slate-400">Uploaded on {createdDate}</span>
                      <span className="text-[9px] font-bold text-slate-300">•</span>
                      <span className="text-[8px] font-black text-indigo-650 bg-indigo-50 border border-indigo-150/30 px-1.5 py-0.2 rounded-md uppercase tracking-wide">
                        {doc.document_type || 'Other'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleView(doc.file_url)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="View Document"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => {
                      const confirmDelete = window.confirm(`Are you sure you want to permanently delete document "${docName}"?`)
                      if (confirmDelete) {
                        onDeleteDocument(doc.id)
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Delete Document"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
