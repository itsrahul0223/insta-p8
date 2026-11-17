import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    const redirectUrl = new URL("/", request.url)
    redirectUrl.searchParams.set("error", error)
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
    const redirectUrl = new URL("/", request.url)
    redirectUrl.searchParams.set("code", code)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.json({ error: "Invalid callback" }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 })

    // 1. Env Vars
    const clientId = process.env.INSTAGRAM_APP_ID
    const clientSecret = process.env.INSTAGRAM_APP_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Env Vars: Check INSTAGRAM_APP_ID")
    }

    const G = "https://graph.facebook.com/v24.0"

    // 2. Exchange code for a short-lived user token
    const tokenRes = await fetch(
      `${G}/oauth/access_token?` +
        new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }).toString(),
    )
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error) {
      if (tokenData.error?.message?.includes("has been used")) {
        return NextResponse.json({ error: "Code already used" }, { status: 400 })
      }
      console.error("[auth] token error:", JSON.stringify(tokenData))
      return NextResponse.json({ error: tokenData.error?.message || "Token failed" }, { status: 400 })
    }

    // 3. Long-lived user token (60 days). Page tokens derived from it do not expire.
    const longRes = await fetch(
      `${G}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`,
    )
    const longData = await longRes.json()
    const userToken = longData.access_token || tokenData.access_token

    // 4. Find the Facebook Page linked to an Instagram professional account
    const pagesRes = await fetch(
      `${G}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&limit=50&access_token=${userToken}`,
    )
    const pagesData = await pagesRes.json()
    const page = (pagesData.data || []).find((p: any) => p.instagram_business_account?.id)
    if (!page) {
      return NextResponse.json(
        { error: "No Facebook Page with a linked Instagram professional account was found. Link your Instagram account to a Page and try again." },
        { status: 400 },
      )
    }

    const pageToken: string = page.access_token
    const pageId: string = page.id
    const businessAccountId: string = page.instagram_business_account.id.toString()
    const username: string = page.instagram_business_account.username || `user_${businessAccountId}`
    const profilePic: string | null = page.instagram_business_account.profile_picture_url || null
    const loginUserId = businessAccountId
    const accessToken = pageToken
    const expiresIn = 5184000

    // 5. Subscribe the Page so webhooks (messages, comments) reach us
    try {
      const subRes = await fetch(`${G}/${pageId}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          subscribed_fields: "messages,messaging_postbacks,feed",
          access_token: pageToken,
        }).toString(),
      })
      console.log("[auth] page subscribe:", JSON.stringify(await subRes.json()))
    } catch (e) {
      console.error("[auth] page subscribe failed:", e)
    }

    // 6. Save/Update User
    const supabase = await getSupabaseServerClient()

    const updates: any = {
      username,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      business_account_id: businessAccountId,
      page_id: pageId,
    }

    console.log(`[v0] 💾 Saving user: ${username} | id=${loginUserId} | biz_id=${businessAccountId}`)

    const { error: upsertError } = await supabase
      .from("users")
      .upsert({ id: loginUserId, ...updates }, { onConflict: "id" })

    if (upsertError) throw upsertError

    const response = NextResponse.json({ success: true, username, userId: loginUserId, profilePic })
    response.cookies.set("insta_session", JSON.stringify({ username, userId: loginUserId }), {
      path: "/",
      maxAge: expiresIn,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return response

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
