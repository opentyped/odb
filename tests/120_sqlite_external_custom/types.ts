export type CustomId = number & { readonly __brand: 'custom' };
export interface Payload {
  name: string;
}
