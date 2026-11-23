import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type UserRole = 'ODONTOLOGO';

@Index('UQ_users_email', ['email'], { unique: true })
@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: 'ODONTOLOGO' })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
    insert: false,
    update: false,
  })
  updatedAt: Date;
}
