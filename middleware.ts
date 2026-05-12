import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Guard /upload — check for Supabase auth cookie presence
  // Full JWT verification happens in server components; this is just a redirect guard
  if (request.nextUrl.pathname.startsWith('/upload')) {
    const hasCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
    if (!hasCookie) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/auth/login'
      loginUrl.searchParams.set('redirectTo', '/upload')
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/upload/:path*'],
}
