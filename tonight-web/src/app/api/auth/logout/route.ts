import { NextResponse } from 'next/server';
import { getAuthCookieName } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getAuthCookieName(),
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
