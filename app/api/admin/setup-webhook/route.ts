import { NextRequest, NextResponse } from "next/server"

// One-time helper: registers this app's webhook callback with Meta using the
// app secret that lives only in the server environment.
// Protected by the webhook verify token passed as ?key=...
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key")
  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!verifyToken || !key || key !== verifyToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "missing env" }, { status: 500 })
  }
  const callback = `${req.nextUrl.origin}/api/instagram/webhook`
  const appToken = `${appId}|${appSecret}`
  const subs = [
    { object: "instagram", fields: "comments,messages,messaging_postbacks,messaging_seen" },
    { object: "page", fields: "messages,messaging_postbacks,feed" },
  ]
  const results: unknown[] = []
  for (const s of subs) {
    const body = new URLSearchParams({
      object: s.object,
      callback_url: callback,
      fields: s.fields,
      verify_token: verifyToken,
      access_token: appToken,
    })
    const r = await fetch(`https://graph.facebook.com/v24.0/${appId}/subscriptions`, { method: "POST", body })
    results.push({ object: s.object, status: r.status, body: await r.json().catch(() => null) })
  }
  const current = await fetch(
    `https://graph.facebook.com/v24.0/${appId}/subscriptions?access_token=${encodeURIComponent(appToken)}`
  ).then((r) => r.json()).catch(() => null)
  return NextResponse.json({ callback, results, current })
}
