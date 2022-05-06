import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Hoax } from './Hoax';

@Entity('file_attachment')
export class FileAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column('bigint')
  uploadDate: number;

  @Column()
  fileType: string;

  @OneToOne(() => Hoax, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  hoax: Hoax;

  @Column({ nullable: true })
  hoaxId?: number;
}
