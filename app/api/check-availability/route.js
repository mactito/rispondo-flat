export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { tenant_id, booking_time } = body;

    if (!tenant_id || !booking_time) {
      return NextResponse.json({ available: true }); // don't block if missing
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ available: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if there is already a booking at that exact time for same tenant
    const { data, error } = await supabase
      .from('calls')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('booking_time', booking_time)
      .limit(1);

    if (error) {
      console.error(error);
      return NextResponse.json({ available: true });
    }

    const isAvailable = !data || data.length === 0;
    
    return NextResponse.json({ available: isAvailable });
    
  } catch (err) {
    console.error('check-availability error', err);
    // Never block booking on error
    return NextResponse.json({ available: true });
  }
}

// Also allow GET for testing
export async function GET() {
  return NextResponse.json({ available: true, message: 'Use POST with tenant_id and booking_time' });
}