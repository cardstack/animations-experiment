import { DBAdapter } from '@cardstack/runtime-common';
import { handlePaymentSucceeded } from './payment-succeeded';
import Stripe from 'stripe';

export type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      [key: string]: any;
    };
  };
};

export type StripeInvoicePaymentSucceededWebhookEvent = StripeEvent & {
  object: 'event';
  type: 'invoice.payment_succeeded';
  data: {
    object: {
      id: string;
      object: 'invoice';
      amount_paid: number;
      billing_reason: 'subscription_create' | 'subscription_cycle';
      period_start: number;
      period_end: number;
      subscription: string;
      customer: string;
      lines: {
        data: Array<{
          price: {
            product: string;
          };
        }>;
      };
    };
  };
};

export default async function stripeWebhookHandler(
  dbAdapter: DBAdapter,
  request: Request,
): Promise<Response> {
  let signature = request.headers.get('stripe-signature');

  if (!signature) {
    throw new Error('No Stripe signature found in request headers');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  let event: StripeEvent;

  try {
    event = Stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    ) as StripeEvent;
  } catch (error) {
    throw new Error(`Error verifying webhook signature: ${error}`);
  }

  let type = event.type;

  // For adding extra credits, we should listen for charge.succeeded, and for
  // subsciptions, we should listen for invoice.payment_succeeded (I discovered this when I was
  // testing which webhooks arrive for both types of payments)
  switch (type) {
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(
        dbAdapter,
        event as StripeInvoicePaymentSucceededWebhookEvent,
      );
  }

  return new Response('ok');
}
