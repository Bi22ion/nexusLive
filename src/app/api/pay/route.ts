import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import AfricasTalking from 'africastalking';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, amount, userId } = await req.json();

    // 1. Initialize the SDK inside the handler to ensure env vars are loaded
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY || '',
      username: process.env.AT_USERNAME || 'sandbox',
    });

    // 2. Access the payments service
    const payments = at.PAYMENTS;

    if (!payments) {
      throw new Error("Africa's Talking Payments service not initialized");
    }

    // 3. Trigger the checkout
    const result = await payments.mobileCheckout({
      productName: 'NexusLiveTokens', // Must match your AT Dashboard product name
      phoneNumber: phoneNumber,
      currencyCode: 'UGX',
      amount: Number(amount),
      metadata: {
        userId: userId,
      },
    });

    console.log('Payment Result:', result);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Payment Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
