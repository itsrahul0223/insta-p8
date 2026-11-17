import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

// Lists the connected Facebook Page's latest videos/reels (id, text, time) so a rule can be tied to one reel.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    const supabase = await getSupabaseServerClient()
    const { data: user } = await supabase.from("users").select("access_token, page_id").eq("id", userId).single()
    if (!user?.access_token || !user?.page_id) return NextResponse.json({ error: "Page not connected" }, { status: 401 })
    const url = `https://graph.facebook.com/v24.0/${user.page_id}/videos?fields=id,description,created_time&limit=8&access_token=${encodeURIComponent(user.access_token)}`
    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 })
    return NextResponse.json({ data: (data.data || []).map((v: any) => ({ id: v.id, created_time: v.created_time, description: (v.description || "").slice(0, 60) })) })
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
