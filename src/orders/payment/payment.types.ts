export type PaymentIntentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'cancelled';

export type PaymentIntent = {
  id: string;
  provider: 'pending_gateway' | 'external_gateway';
  orderId: string;
  amount: number;
  currency: 'PYG' | 'USD';
  status: PaymentIntentStatus;
  checkoutUrl?: string;
  createdAt: string;
};
