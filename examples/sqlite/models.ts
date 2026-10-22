import type { Account as GeneratedAccount } from 'odb/main';

/** @schema */
export interface Account extends Omit<GeneratedAccount, 'id'> {
  id: number;
}
