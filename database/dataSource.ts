import { DataSource } from 'typeorm';
import config from 'config';

const DBConfig: string = config.get('database');

let db: DataSource;
if (DBConfig === 'test') {
  db = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    dropSchema: true,
    entities: ['src/entities/*.ts'],
  });
} else if (DBConfig === 'development') {
  db = new DataSource({
    type: 'sqlite',
    database: 'database.sqlite',
    entities: ['src/entities/*.ts'],
    migrations: ['database/migrations/*migration.ts', 'database/seeders/*seeds.ts'],
    migrationsRun: true,
    dropSchema: true,
  });
} else if (DBConfig === 'staging') {
  db = new DataSource({
    type: 'sqlite',
    database: 'staging.sqlite',
    synchronize: true,
    dropSchema: true,
    entities: ['src/entities/*.ts'],
    migrations: ['database/migrations/*migration.ts'],
    migrationsRun: true,
  });
} else if (DBConfig === 'production') {
  db = new DataSource({
    type: 'sqlite',
    database: 'prod-db.sqlite',
    entities: ['src/entities/*.ts'],
    migrations: ['database/migrations/*migration.ts'],
    migrationsRun: true,
  });
} else {
  db = new DataSource({
    type: 'sqlite',
    database: 'prod-db.sqlite',
    entities: ['src/entities/*.ts'],
    migrations: ['database/migrations/*migration.ts'],
    migrationsRun: true,
  });
}

export default db;
