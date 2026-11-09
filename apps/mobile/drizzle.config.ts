import { defineConfig } from 'drizzle-kit';

// Las migraciones del cliente se generan en el PC y se empaquetan como texto (ver
// scripts/embed-migrations.mjs); en el celular no corre drizzle-kit.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
