import type {EntityManager} from 'typeorm';
import {ConflictException} from '@nestjs/common';
// Writers share this lock; a backup holds it exclusively until dump and files are copied.
export const MEDIA_BACKUP_LOCK = [17955, 20261125] as const;
export async function lockImageChanges(manager:EntityManager):Promise<void> {
  const rows=await manager.query('SELECT pg_try_advisory_xact_lock_shared($1,$2) AS locked',[...MEDIA_BACKUP_LOCK]);
  if(!rows[0]?.locked)throw new ConflictException('Идёт резервное копирование изображений. Повторите сохранение через несколько секунд');
}
