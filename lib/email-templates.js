export function fillTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '')
}

export function emailWrapper({ heading, body, ctaText, ctaUrl, details, footer }) {
  const detailRows = details
    ? Object.entries(details).map(([k, v]) =>
        `<tr>
          <td style="color:#888;padding:5px 0;font-size:13px">${k}</td>
          <td style="font-weight:600;padding:5px 0;font-size:13px;text-align:right">${v}</td>
        </tr>`
      ).join('')
    : ''

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${heading}</title></head>
  <body style="margin:0;padding:20px;background:#f7f6f3;font-family:'Inter',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
    <div style="background:#141414;padding:20px 24px;display:flex;align-items:center;gap:10px">
      <div style="width:10px;height:10px;border-radius:50%;background:#C4724E;display:inline-block"></div>
      <span style="font-family:Georgia,serif;font-style:italic;font-size:16px;color:#fff;margin-left:8px">Purposefields</span>
    </div>
    <div style="padding:28px 28px 20px">
      <h2 style="font-family:Georgia,serif;font-size:20px;font-weight:400;color:#141414;margin:0 0 12px">${heading}</h2>
      ${body}
      ${details ? `<table style="width:100%;background:#f7f6f3;border-radius:6px;padding:12px 16px;margin:16px 0;border-collapse:collapse">${detailRows}</table>` : ''}
      ${ctaUrl ? `<a href="${ctaUrl}" style="display:block;text-align:center;background:#C4724E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;margin:20px 0">${ctaText}</a>` : ''}
      ${footer || ''}
    </div>
    <div style="background:#f7f6f3;padding:14px 24px;font-size:11px;color:#888;text-align:center;border-top:1px solid #e4e3df">
      Purposefields · Career Coaching &amp; Holistic Wellbeing · Online<br>
      <a href="${process.env.NEXT_PUBLIC_URL}/unsubscribe" style="color:#888">Unsubscribe</a> ·
      <a href="${process.env.NEXT_PUBLIC_URL}/privacy" style="color:#888">Privacy Policy</a>
    </div>
  </div></body></html>`
}
