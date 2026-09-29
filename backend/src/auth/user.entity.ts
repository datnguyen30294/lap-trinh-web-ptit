import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id: string;
  @Column({ type: 'varchar', length: 120 }) full_name: string;
  @Column({ type: 'varchar', length: 160, unique: true }) email: string;
  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;
  @Column({ type: 'enum', enum: ['ADMIN', 'USER'] }) role: 'ADMIN' | 'USER';
  @Column({ type: 'boolean' }) is_active: boolean;
}
