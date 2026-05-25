declare module "paystack" {
  type PaystackCallback<T> = (err: Error | null, body: T) => void;

  export interface PaystackClient {
    transaction: {
      initialize: (params: Record<string, unknown>, cb: PaystackCallback<{ data: { authorization_url: string; access_code: string } }>) => void;
    };
    misc: {
      list_banks: (params: Record<string, unknown>, cb: PaystackCallback<{ data: unknown[] }>) => void;
    };
  }

  function Paystack(secret: string): PaystackClient;
  export = Paystack;
}
