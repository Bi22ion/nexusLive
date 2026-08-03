import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

let supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { status, transactionId, value, metadata } = body;

    if (status === 'Success') {
      const amountStr = value.replace('UGX ', '');
      const amount = parseFloat(amountStr);
      const userId = metadata.userId;

      const tokensToAdd = Math.floor(amount / 10);

      const client = getSupabase();

      await client.from('payment_logs').insert({
        transaction_id: transactionId,
        user_id: userId,
        amount: amount,
        status: 'Success'
      });

      const { error } = await client.rpc('increment_tokens', {
        row_id: userId,
        token_count: tokensToAdd
      });

      if (error) throw error;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('CRITICAL: Callback Processing Failed:', error);
    return Response.json({ error: 'Internal Error' }, { status: 500 });
  }
}
