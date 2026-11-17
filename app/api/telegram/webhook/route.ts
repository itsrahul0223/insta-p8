import { type NextRequest, NextResponse } from "next/server"

// Lumina Telegram bot: menu with programs / consultation / Plus links, keyword replies, start deep-links.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN

const LINKS = {
  programs: "https://luminamedical.in/programs/?utm_source=telegram&utm_medium=bot&utm_campaign=common",
  consult: "https://app.luminamedical.in/?utm_source=telegram#consult",
  plus: "https://app.luminamedical.in/?utm_source=telegram#account",
  instagram: "https://www.instagram.com/luminamedical.in/",
  youtube: "https://www.youtube.com/@LuminaMedicalandAesthetics",
  site: "https://luminamedical.in/",
}

const DISCLAIMER = "This is educational lifestyle guidance, not a diagnosis or a prescription."

function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "📚 See all programs", url: LINKS.programs }],
      [{ text: "👨‍⚕️ Book a doctor consultation", url: LINKS.consult }],
      [{ text: "✨ Get Lumina Plus", url: LINKS.plus }],
      [
        { text: "Instagram", url: LINKS.instagram },
        { text: "YouTube", url: LINKS.youtube },
      ],
    ],
  }
}

async function tg(method: string, body: any) {
  if (!TOKEN) return
  await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e) => console.error("[telegram]", method, e))
}

const TOPICS: Record<string, string> = {
  bp: "blood pressure", pressure: "blood pressure", sugar: "sugar", diabetes: "sugar", pcos: "PCOS", thyroid: "thyroid",
  weight: "weight", cholesterol: "cholesterol", liver: "fatty liver", fatty: "fatty liver",
}

export async function POST(request: NextRequest) {
  if (!TOKEN) return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN not set" }, { status: 200 })
  if (SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const update = await request.json().catch(() => null)
  const msg = update?.message
  if (!msg?.chat?.id) return NextResponse.json({ ok: true })
  const chatId = msg.chat.id
  const text: string = (msg.text || "").trim().toLowerCase()
  const first = msg.from?.first_name ? ` ${msg.from.first_name}` : ""

  if (text.startsWith("/start") || text === "hi" || text === "hello" || text === "menu" || text === "/menu") {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `Hello${first}! Welcome to Lumina Medical & Aesthetics.\n\nWe have doctor-designed 12-week programs (blood pressure, fatty liver, sugar, cholesterol, PCOS, thyroid, weight and more), Lumina Plus, and paid 1:1 doctor video consultations.\n\nChoose below, or type a topic like "sugar" or "PCOS".\n\n${DISCLAIMER}`,
      reply_markup: mainMenu(),
    })
    return NextResponse.json({ ok: true })
  }

  const hit = Object.keys(TOPICS).find((k) => text.includes(k))
  if (hit) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `For ${TOPICS[hit]}, Lumina has a doctor-designed 12-week program. Answer 2 quick questions on the programs page and it will point you to the right one. If you want a doctor to look at your own case, a paid video consultation is available.\n\n${DISCLAIMER}`,
      reply_markup: mainMenu(),
    })
    return NextResponse.json({ ok: true })
  }
  if (text.includes("consult") || text.includes("doctor") || text.includes("appointment")) {
    await tg("sendMessage", { chat_id: chatId, text: "You can book a paid 1:1 video consultation with a doctor here:", reply_markup: { inline_keyboard: [[{ text: "👨‍⚕️ Book a consultation", url: LINKS.consult }]] } })
    return NextResponse.json({ ok: true })
  }
  if (text.includes("plus") || text.includes("subscription")) {
    await tg("sendMessage", { chat_id: chatId, text: "Lumina Plus gives you extra tools inside the Lumina Care app:", reply_markup: { inline_keyboard: [[{ text: "✨ Get Lumina Plus", url: LINKS.plus }]] } })
    return NextResponse.json({ ok: true })
  }
  await tg("sendMessage", { chat_id: chatId, text: `Thanks for your message${first}. Here is everything in one place:\n\n${DISCLAIMER}`, reply_markup: mainMenu() })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, bot: "lumina telegram webhook", configured: Boolean(TOKEN) })
}
