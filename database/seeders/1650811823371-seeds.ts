import { MigrationInterface, QueryRunner } from 'typeorm';
import { User } from '../../src/entities/User';
import bcrypt from 'bcrypt';

export class seeds1650811823371 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hash = await bcrypt.hash('P4ssword', 10);
    const users: User[] = [];
    for (let i = 0; i < 25; i++) {
      users.push({
        username: `user${i + 1}`,
        email: `user${i + 1}@email.com`,
        password: hash,
        inactive: false,
      });
    }
    await queryRunner.manager.save(User, users);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.clear(User);
  }
}
