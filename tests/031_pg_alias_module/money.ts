export type Decimal = string & { readonly precision: unique symbol };
export interface Input {
  value: string;
}
export default class Money {
  declare readonly value: Decimal;
}
throw new Error('Do not execute imported type modules');
