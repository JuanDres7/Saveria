import type { Repositories, UnitOfWork } from '../../../application/ports/repositories';
import type { Database } from '../client';
import { DrizzleAccountRepository } from './account-repository';
import type { DbExecutor } from './executor';
import { DrizzleOneTimeTokenRepository } from './one-time-token-repository';
import { DrizzleProfileRepository } from './profile-repository';
import { DrizzleSessionRepository } from './session-repository';
import { DrizzleTransactionRepository } from './transaction-repository';
import { DrizzleUserRepository } from './user-repository';

export function createRepositories(db: DbExecutor): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    profiles: new DrizzleProfileRepository(db),
    sessions: new DrizzleSessionRepository(db),
    oneTimeTokens: new DrizzleOneTimeTokenRepository(db),
    accounts: new DrizzleAccountRepository(db),
    transactions: new DrizzleTransactionRepository(db),
  };
}

/** Si el trabajo lanza un error, Drizzle deshace toda la transacción. */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(createRepositories(tx)));
  }
}
