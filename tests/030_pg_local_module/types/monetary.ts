export interface Monetary {
  amount: string;
  currency: 'USD' | 'EUR';
}
export interface MonetaryInput {
  amount: string | bigint;
  currency: 'USD' | 'EUR';
}
throw new Error('Type source must never execute');
