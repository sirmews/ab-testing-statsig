import { NextRequest, NextResponse, NextFetchEvent } from 'next/server'
import Statsig from 'statsig-node'
import type { StatsigUser } from 'statsig-node'
import { EdgeConfigDataAdapter } from 'statsig-node-vercel'
import { EXPERIMENT, FEATURE_FLAG, UID_COOKIE, GROUP_PARAM_FALLBACK } from './lib/constants'

// We'll use this to validate a random UUID
const IS_UUID = /^[0-9a-f-]+$/i
const dataAdapter = new EdgeConfigDataAdapter(process.env.EDGE_CONFIG_ITEM_KEY!)

export const config = {
  matcher: '/',
}


export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { cookies, headers } = req

  // Get the user ID from the cookie or get a new one
  let userId = cookies.get(UID_COOKIE)?.value
  let hasUserId = !!userId

  // get some geodata
  const country = headers.get('x-vercel-ip-country') || 'US'
  // real ip address
  const ipAddress = headers.get('x-real-ip') || headers.get('x-forwarded-for') || ''

  // If there's no active user ID in cookies or its value is invalid, get a new one
  if (!userId || !IS_UUID.test(userId)) {
    userId = crypto.randomUUID()
    hasUserId = false
  }

  // Create a Statsig user object with as much data as we have
  const statsigEnvironmentTier = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  const statsigUser: StatsigUser = { userID: userId, country, ip: ipAddress, statsigEnvironment: {tier: statsigEnvironmentTier} }

  await Statsig.initialize(process.env.STATSIG_SERVER_API_KEY!, { dataAdapter })

  const experiment = await Statsig.getExperiment(statsigUser, EXPERIMENT)
  const featureFlag = await Statsig.checkGate(statsigUser, FEATURE_FLAG)
  const bucket = experiment.get<string>('bucket', GROUP_PARAM_FALLBACK)

  // Clone the URL and change its pathname to point to a bucket
  const url = req.nextUrl.clone()
  url.pathname = `/${bucket}`

  // Response that'll rewrite to the selected bucket if the flag returns true
  let response: NextResponse
  if (featureFlag) {
    response = NextResponse.redirect(url.href, 302)
  } else {
    response = NextResponse.rewrite(url)
  }

  // Add the user ID to the response cookies if it's not there or if its value was invalid
  if (!hasUserId) {
    response.cookies.set(UID_COOKIE, userId, {
      maxAge: 60 * 60 * 24, // identify users for 24 hours
    })
  }

  // Flush exposure logs to Statsig
  event.waitUntil(Statsig.flush());

  return response
}
