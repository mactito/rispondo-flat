export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
export async function POST(req){ return NextResponse.json({ ok:true }) }
export async function GET(){ return NextResponse.json({ ok:true }) }