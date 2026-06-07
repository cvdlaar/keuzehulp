import { NextRequest, NextResponse } from 'next/server'
import { startImport } from '@/lib/importer'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { feedConfigId } = body

  if (!feedConfigId) {
    return NextResponse.json({ error: 'feedConfigId is verplicht' }, { status: 400 })
  }

  try {
    const logId = await startImport(feedConfigId)
    return NextResponse.json({ logId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import mislukt' },
      { status: 500 }
    )
  }
}
