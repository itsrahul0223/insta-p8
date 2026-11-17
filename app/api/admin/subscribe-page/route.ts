import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

// Protected diagnostic: tries to subscribe the connected Page with different field sets.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const G = "https://graph.facebook.com/v24.0"
  const supabase = await getSupabaseServerClient()
  const { data: users } = await supabase.from("users").select("id,username,page_id,access_token")
  const out: any[] = []
  for (const u of users || []) {
    if (!u.page_id || !u.access_token) continue
    const attempts: any = {}
    const sets = (request.nextUrl.searchParams.get("sets") || "name;feed;messages;messaging_postbacks;instagram_comments;instagram_manage_comments;mention;comments").split(";")
    for (const fields of sets) {
      const r = await fetch(`${G}/${u.page_id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ subscribed_fields: fields, access_token: u.access_token }).toString(),
      })
      attempts[fields] = (await r.text()).slice(0, 200)
    }
    const cur = await fetch(`${G}/${u.page_id}/subscribed_apps?access_token=${u.access_token}`)
    const perms = await fetch(`${G}/me/permissions?access_token=${u.access_token}`)
    out.push({ user: u.username, page_id: u.page_id, attempts, current: await cur.text(), perms: (await perms.text()).slice(0, 600) })
  }
  return NextResponse.json(out)
}
