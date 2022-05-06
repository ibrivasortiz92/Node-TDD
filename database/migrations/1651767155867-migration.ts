import { MigrationInterface, QueryRunner } from 'typeorm';

export class migration1651767155867 implements MigrationInterface {
  name = 'migration1651767155867';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "username" text NOT NULL, "email" text NOT NULL, "password" text, "inactive" boolean NOT NULL DEFAULT (1), "activationToken" text, "passwordResetToken" text, "image" text)`
    );
    await queryRunner.query(
      `CREATE TABLE "hoax" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "content" text NOT NULL, "timestamp" bigint NOT NULL, "userId" integer NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "file_attachment" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "filename" varchar NOT NULL, "uploadDate" bigint NOT NULL, "fileType" varchar NOT NULL, "hoaxId" integer, CONSTRAINT "REL_83cb24f21c608a8aaf33199b3b" UNIQUE ("hoaxId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "token" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "token" text NOT NULL, "userId" integer, "lastUsedAt" text NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_hoax" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "content" text NOT NULL, "timestamp" bigint NOT NULL, "userId" integer NOT NULL, CONSTRAINT "FK_f2adc6b9edd79228f32b53436dc" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_hoax"("id", "content", "timestamp", "userId") SELECT "id", "content", "timestamp", "userId" FROM "hoax"`
    );
    await queryRunner.query(`DROP TABLE "hoax"`);
    await queryRunner.query(`ALTER TABLE "temporary_hoax" RENAME TO "hoax"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_file_attachment" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "filename" varchar NOT NULL, "uploadDate" bigint NOT NULL, "fileType" varchar NOT NULL, "hoaxId" integer, CONSTRAINT "REL_83cb24f21c608a8aaf33199b3b" UNIQUE ("hoaxId"), CONSTRAINT "FK_83cb24f21c608a8aaf33199b3bc" FOREIGN KEY ("hoaxId") REFERENCES "hoax" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_file_attachment"("id", "filename", "uploadDate", "fileType", "hoaxId") SELECT "id", "filename", "uploadDate", "fileType", "hoaxId" FROM "file_attachment"`
    );
    await queryRunner.query(`DROP TABLE "file_attachment"`);
    await queryRunner.query(`ALTER TABLE "temporary_file_attachment" RENAME TO "file_attachment"`);
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
    await queryRunner.query(`ALTER TABLE "file_attachment" RENAME TO "temporary_file_attachment"`);
    await queryRunner.query(
      `CREATE TABLE "file_attachment" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "filename" varchar NOT NULL, "uploadDate" bigint NOT NULL, "fileType" varchar NOT NULL, "hoaxId" integer, CONSTRAINT "REL_83cb24f21c608a8aaf33199b3b" UNIQUE ("hoaxId"))`
    );
    await queryRunner.query(
      `INSERT INTO "file_attachment"("id", "filename", "uploadDate", "fileType", "hoaxId") SELECT "id", "filename", "uploadDate", "fileType", "hoaxId" FROM "temporary_file_attachment"`
    );
    await queryRunner.query(`DROP TABLE "temporary_file_attachment"`);
    await queryRunner.query(`ALTER TABLE "hoax" RENAME TO "temporary_hoax"`);
    await queryRunner.query(
      `CREATE TABLE "hoax" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "content" text NOT NULL, "timestamp" bigint NOT NULL, "userId" integer NOT NULL)`
    );
    await queryRunner.query(
      `INSERT INTO "hoax"("id", "content", "timestamp", "userId") SELECT "id", "content", "timestamp", "userId" FROM "temporary_hoax"`
    );
    await queryRunner.query(`DROP TABLE "temporary_hoax"`);
    await queryRunner.query(`DROP TABLE "token"`);
    await queryRunner.query(`DROP TABLE "file_attachment"`);
    await queryRunner.query(`DROP TABLE "hoax"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
