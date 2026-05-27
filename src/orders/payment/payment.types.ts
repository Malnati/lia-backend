export type PaymentIntentStatus = 'mock_pending' | 'paid' | 'failed';

export type CreatePaymentIntentInput = {
  orderId: string;
  amount: number;
  currency: 'PYG' | 'USD';
};

export type PaymentIntent = {
  id: string;
  provider: 'mock';
  orderId: string;
  amount: number;
  currency: 'PYG' | 'USD';
  status: PaymentIntentStatus;
  checkoutUrl: string;
  createdAt: string;
};

export interface PaymentProvider {
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
}
