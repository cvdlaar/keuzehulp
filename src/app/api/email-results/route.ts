import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSettingOrEnv } from '@/lib/settings'

interface ProductItem {
  title: string
  brand?: string
  imageLink?: string
  link: string
  price: number
  salePrice?: number | null
  lowestPrice?: number | null
}

function formatPrice(p: number) {
  return `€ ${p.toFixed(2).replace('.', ',')}`
}

function priceDisplay(p: ProductItem) {
  if (p.lowestPrice && p.lowestPrice < p.price) return `vanaf ${formatPrice(p.lowestPrice)}`
  if (p.salePrice) return `<span style="color:#16a34a;font-weight:700">${formatPrice(p.salePrice)}</span> <span style="text-decoration:line-through;color:#9ca3af;font-size:13px">${formatPrice(p.price)}</span>`
  if (p.price > 0) return `<span style="font-weight:700">${formatPrice(p.price)}</span>`
  return ''
}

function buildEmail(flowName: string, emailSubject: string, products: ProductItem[], primaryColor: string) {
  const rows = products.map(p => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #f3f4f6">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${p.imageLink ? `<td width="80" style="padding-right:16px;vertical-align:top">
              <img src="${p.imageLink}" width="72" height="72" style="object-fit:contain;border-radius:8px;border:1px solid #e5e7eb" alt="" />
            </td>` : ''}
            <td style="vertical-align:top">
              <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#111827">${p.title}</p>
              ${p.brand ? `<p style="margin:0 0 6px;font-size:13px;color:#6b7280">${p.brand}</p>` : ''}
              <p style="margin:0 0 10px;font-size:14px;color:#374151">${priceDisplay(p)}</p>
              <a href="${p.link}" style="display:inline-block;padding:8px 18px;background:${primaryColor};color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
                Bekijk product →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:${primaryColor};padding:28px 32px">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${flowName}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px">Jouw aanbevolen producten</p>
        </td></tr>
        <tr><td style="padding:24px 32px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows}
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center">
            Deze aanbevelingen zijn gegenereerd op basis van jouw antwoorden.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const { email, flowName, emailSubject, products, primaryColor } = await req.json()

  if (!email || !products?.length) {
    return NextResponse.json({ error: 'E-mail en producten zijn verplicht.' }, { status: 400 })
  }

  const [smtpUser, smtpPass, smtpHost, smtpPort, smtpFrom] = await Promise.all([
    getSettingOrEnv('smtp_user', 'SMTP_USER'),
    getSettingOrEnv('smtp_pass', 'SMTP_PASS'),
    getSettingOrEnv('smtp_host', 'SMTP_HOST'),
    getSettingOrEnv('smtp_port', 'SMTP_PORT'),
    getSettingOrEnv('smtp_from', 'SMTP_FROM'),
  ])

  if (!smtpUser || !smtpPass) {
    return NextResponse.json({ error: 'SMTP niet geconfigureerd.' }, { status: 503 })
  }

  const port = Number(smtpPort || 587)
  const transporter = nodemailer.createTransport({
    host: smtpHost || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  const subject = emailSubject || `Jouw aanbevolen producten — ${flowName}`
  const html = buildEmail(flowName, subject, products, primaryColor ?? '#2563eb')

  await transporter.sendMail({
    from: smtpFrom || smtpUser,
    to: email,
    subject,
    html,
  })

  return NextResponse.json({ ok: true })
}
