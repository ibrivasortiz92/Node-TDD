import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Hoax } from './Hoax';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column('text')
  username: string | null;

  @Column('text')
  email: string | null;

  @Column('text', { nullable: true })
  password: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  inactive?: boolean;

  @Column({
    type: 'text',
    nullable: true,
  })
  activationToken?: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  passwordResetToken?: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  image?: string | null;

  @OneToMany(() => Hoax, (hoax) => hoax.user)
  hoaxes?: Hoax[];
}
