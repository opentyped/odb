/** An application-owned type; odb never imports this module while generating. */
export class Monetary {
  readonly amount: string;
  readonly currency: 'USD' | 'EUR';

  constructor(amount: string, currency: 'USD' | 'EUR') {
    this.amount = amount;
    this.currency = currency;
  }

  toPostgres(): string {
    return `(${this.amount},${this.currency})`;
  }

  static fromPostgres(value: string): Monetary {
    const [amount, currency] = value.slice(1, -1).split(',');
    if (!amount || (currency !== 'USD' && currency !== 'EUR'))
      throw new Error('Unexpected monetary representation');
    return new Monetary(amount, currency);
  }
}
