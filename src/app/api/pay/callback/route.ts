import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    // Africa's Talking sends data as JSON for checkout callbacks
    const body = await req.json();
    const { status, transactionId, value, metadata } = body;

    if (status === 'Success') {
      const amountStr = value.replace('UGX ', '');
      const amount = parseFloat(amountStr);
      const userId = metadata.userId;
      
      // Calculate tokens (Example: 10 UGX = 1 Token, so 2500 UGX = 250 Tokens)
      const tokensToAdd = Math.floor(amount / 10);

      // 1. Log the transaction for safety
      await supabase.from('payment_logs').insert({
        transaction_id: transactionId,
        user_id: userId,
        amount: amount,
        status: 'Success'
      });

      // 2. Update the user's actual token balance
      const { error } = await supabase.rpc('increment_tokens', {
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
