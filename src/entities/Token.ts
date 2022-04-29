import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity('token')
export class Token {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  token: string;

  @Column('int', {
    nullable: true,
  })
  userId?: number;

  @Column('text')
  lastUsedAt: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    cascade: true,
  })
  user?: User;
}
