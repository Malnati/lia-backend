import type { CreatePaymentIntentInput, PaymentIntent, PaymentProvider } from './payment.types';

export class MockPaymentProvider implements PaymentProvider {
  async createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const id = `mock_pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      id,
      provider: 'mock',
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status: 'mock_pending',
      checkoutUrl: `mock://lia/payments/${id}`,
      createdAt: new Date().toISOString()
    };
  }
}
