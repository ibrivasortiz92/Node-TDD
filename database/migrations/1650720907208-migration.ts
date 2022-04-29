import { MigrationInterface, QueryRunner } from 'typeorm';

export class migrations1650720907208 implements MigrationInterface {
  name = 'migrations1650720907208';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "username" text NOT NULL, "email" text NOT NULL, "password" text NOT NULL, "inactive" boolean NOT NULL DEFAULT (1), "activationToken" text, "passwordResetToken" text, "image" text)`
    );
    await queryRunner.query(
      `CREATE TABLE "token" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "token" text NOT NULL, "userId" integer, "lastUsedAt" text NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_token" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "token" text NOT NULL, "userId" integer, "lastUsedAt" text NOT NULL, CONSTRAINT "FK_94f168faad896c0786646fa3d4a" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_token"("id", "token", "userId", "lastUsedAt") SELECT "id", "token", "userId", "lastUsedAt" FROM "token"`
    );
    await queryRunner.query(`DROP TABLE "token"`);
    await queryRunner.query(`ALTER TABLE "temporary_token" RENAME TO "token"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "token" RENAME TO "temporary_token"`);
    await queryRunner.query(
      `CREATE TABLE "token" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "token" text NOT NULL, "userId" integer, "lastUsedAt" text NOT NULL)`
    );
    await queryRunner.query(
      `INSERT INTO "token"("id", "token", "userId", "lastUsedAt") SELECT "id", "token", "userId", "lastUsedAt" FROM "temporary_token"`
    );
    await queryRunner.query(`DROP TABLE "temporary_token"`);
    await queryRunner.query(`DROP TABLE "token"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
