import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Setting from '@/models/Setting'

export async function GET() {
  await connectDB()
  const all = await Setting.find({ key: { $in: ['demo_enabled', 'demo_flow_id', 'demo_shop_name'] } }).lean()
  const map = Object.fromEntries(all.map(s => [s.key, s.value]))
  return NextResponse.json({
    enabled: map['demo_enabled'] === '1',
    flowId: map['demo_flow_id'] ?? '',
    shopName: map['demo_shop_name'] ?? 'DemoShop',
  })
}
