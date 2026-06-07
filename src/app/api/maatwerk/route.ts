import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'
import MaatwerkSubmission from '@/models/MaatwerkSubmission'
import { getSettingOrEnv } from '@/lib/settings'

interface SubmitField    { label: string; type: string; value: string }
interface SubmitFile     { label: string; filename: string; url: string }
interface SubmitSelection { questionText: string; answerText: string }
interface Contact        { naam: string; email: string; telefoon: string; straat: string; postcode: string; plaats: string }

function buildEmailHtml(
  flowName: string,
  answerText: string,
  selections: SubmitSelection[],
  fields: SubmitField[],
  files: SubmitFile[],
  contact: Contact,
  primaryColor: string
) {
  const selectionRows = selections.map(s => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;width:40%">
        <span style="font-size:13px;color:#6b7280">${s.questionText}</span>
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top">
        <span style="font-size:14px;color:#111827">${s.answerText}</span>
      </td>
    </tr>`).join('')

  const fieldRows = fields.map(f => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;width:40%">
        <span style="font-size:13px;color:#6b7280">${f.label}</span>
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top">
        <span style="font-size:14px;color:#111827;white-space:pre-wrap">${f.value || '—'}</span>
      </td>
    </tr>`).join('')

  const fileRows = files.map(f => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;width:40%">
        <span style="font-size:13px;color:#6b7280">${f.label}</span>
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top">
        <a href="${f.url}" style="font-size:14px;color:${primaryColor}">${f.filename}</a>
      </td>
    </tr>`).join('')

  const contactRows = [
    { label: 'Naam',     val: contact.naam },
    { label: 'E-mail',   val: contact.email },
    { label: 'Telefoon', val: contact.telefoon },
    { label: 'Straat',   val: contact.straat },
    { label: 'Postcode', val: contact.postcode },
    { label: 'Plaats',   val: contact.plaats },
  ].filter(r => r.val).map(r => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;width:40%">
        <span style="font-size:13px;color:#6b7280">${r.label}</span>
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top">
        <span style="font-size:14px;color:#111827">${r.val}</span>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:${primaryColor};padding:28px 32px">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">Maatwerkverzoek — ${flowName}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px">Via antwoord: ${answerText}</p>
        </td></tr>
        <tr><td style="padding:24px 32px">
          ${selections.length ? `
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Ingevulde keuzehulp</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            ${selectionRows}
          </table>` : ''}
          ${fields.length || files.length ? `
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Aanvraagdetails</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            ${fieldRows}${fileRows}
          </table>` : ''}
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Contactgegevens</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${contactRows}
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  await connectDB()

  const body = await req.json() as {
    flowId: string
    answerId: string
    selections: SubmitSelection[]
    fields: SubmitField[]
    files: SubmitFile[]
    contact: Contact
  }

  const { flowId, answerId, selections, fields, files, contact } = body

  if (!flowId || !answerId) {
    return NextResponse.json({ error: 'flowId en answerId zijn verplicht.' }, { status: 400 })
  }
  if (!contact?.email) {
    return NextResponse.json({ error: 'E-mailadres contactpersoon is verplicht.' }, { status: 400 })
  }

  const flow = await Flow.findById(flowId).lean()
  if (!flow) return NextResponse.json({ error: 'Flow niet gevonden.' }, { status: 404 })

  const answer = flow.questions.flatMap(q => q.answers).find(a => a.id === answerId)
  const answerText    = answer?.text ?? ''
  const emailTo       = flow.maatwerkEmailTo ?? ''
  const primaryColor  = flow.widgetStyle?.primaryColor ?? '#2563eb'

  await MaatwerkSubmission.create({
    flowId,
    flowName: flow.name,
    answerId,
    answerText,
    selections: selections ?? [],
    fields: fields ?? [],
    files: files ?? [],
    contact,
  })

  if (emailTo) {
    const [smtpUser, smtpPass, smtpHost, smtpPort, smtpFrom] = await Promise.all([
      getSettingOrEnv('smtp_user', 'SMTP_USER'),
      getSettingOrEnv('smtp_pass', 'SMTP_PASS'),
      getSettingOrEnv('smtp_host', 'SMTP_HOST'),
      getSettingOrEnv('smtp_port', 'SMTP_PORT'),
      getSettingOrEnv('smtp_from', 'SMTP_FROM'),
    ])

    if (smtpUser && smtpPass) {
      const port = Number(smtpPort || 587)
      const transporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      })

      const html = buildEmailHtml(flow.name, answerText, selections ?? [], fields ?? [], files ?? [], contact, primaryColor)

      await transporter.sendMail({
        from: smtpFrom || smtpUser,
        to: emailTo,
        replyTo: contact.email,
        subject: `Maatwerkverzoek — ${flow.name}`,
        html,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
