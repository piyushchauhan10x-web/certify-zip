import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { imageBase64 } = await req.json();
  return NextResponse.json({
    detected: false,
    message: 'AI auto-detect not wired yet. Use manual click placement.',
  });
}