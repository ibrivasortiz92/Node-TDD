import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity('hoax')
export class Hoax {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  content: string;

  @Column('bigint')
  timestamp: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.hoaxes, {
    onDelete: 'CASCADE',
    cascade: true,
  })
  user: User;
}
