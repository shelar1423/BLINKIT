// Sends one email when the shared link is opened by a visitor.
// Deliberately records nothing about the visitor: no IP, no location, no
// device details. The email says only that the page was opened, and when.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Missing config shouldn't break the page for the visitor.
    res.status(200).json({ ok: false, reason: 'no-key' });
    return;
  }

  const when = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Race It Home <onboarding@resend.dev>',
        to: ['digvijayshelar@gmail.com'],
        subject: 'Someone opened the Race It Home link',
        text: `The link was opened at ${when} (IST).`,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      res.status(200).json({ ok: false, reason: 'send-failed', status: r.status, detail });
      return;
    }
  } catch {
    res.status(200).json({ ok: false, reason: 'error' });
    return;
  }

  res.status(200).json({ ok: true });
}
