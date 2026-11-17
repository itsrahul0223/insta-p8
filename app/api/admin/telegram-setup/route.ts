import { type NextRequest, NextResponse } from "next/server"

// Protected: registers the Telegram webhook + command menu using TELEGRAM_BOT_TOKEN from env.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN env var is not set" }, { status: 400 })
  const api = `https://api.telegram.org/bot${token}`
  const hook = await fetch(`${api}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${request.nextUrl.origin}/api/telegram/webhook`,
      secret_token: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
      allowed_updates: ["message"],
    }),
  }).then((r) => r.json())
  const cmds = await fetch(`${api}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: [{ command: "start", description: "Programs, Plus and consultation" }, { command: "menu", description: "Show the menu" }] }),
  }).then((r) => r.json())
  const me = await fetch(`${api}/getMe`).then((r) => r.json())
  return NextResponse.json({ webhook: hook, commands: cmds, bot: me?.result?.username })
}
