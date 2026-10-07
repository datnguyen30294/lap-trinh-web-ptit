import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stations')
export class Station {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    unsigned: true,
  })
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 160,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
