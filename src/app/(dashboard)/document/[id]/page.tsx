import { redirect } from "next/navigation"

type Params = { id?: string }

export default async function DocumentRedirectPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = await params
  if (resolvedParams.id) {
    redirect(`/documents/${resolvedParams.id}`)
  } else {
    redirect('/documents')
  }
}
