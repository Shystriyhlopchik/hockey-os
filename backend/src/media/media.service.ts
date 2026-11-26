import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

export type ImageKind = 'players' | 'teams';
export interface ImageUpload { buffer: Buffer; mimetype: string; }
export interface ImageChange { url: string | null; previous: string | null; created?: string; }
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const mediaRoot = () => resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads'));
export const mediaDirectory = (kind: ImageKind) => resolve(mediaRoot(), kind);

export function mediaBody(body: any): any {
  if (typeof body?.data !== 'string') return body;
  try {
    const parsed = JSON.parse(body.data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
    return parsed;
  } catch { throw new BadRequestException('Некорректные данные карточки'); }
}

export function ownedImagePath(url: string | null, kind: ImageKind): string | null {
  if (!url) return null;
  const match = /^\/uploads\/(players|teams)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp)$/.exec(url);
  return match?.[1] === kind ? resolve(mediaDirectory(kind), match[2]) : null;
}

export async function normalizeImage(file: ImageUpload, kind: ImageKind): Promise<Buffer> {
  if (!file.buffer?.length || file.buffer.length > MAX_IMAGE_BYTES) throw new BadRequestException('Выберите изображение размером до 5 МБ');
  try {
    const image = sharp(file.buffer, {limitInputPixels: 25_000_000, failOn: 'warning', animated: false});
    const metadata = await image.metadata();
    const mime = ({jpeg:'image/jpeg',png:'image/png',webp:'image/webp'} as Record<string,string>)[metadata.format || ''];
    if (!mime || mime !== file.mimetype || (metadata.pages || 1) > 1 || !metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32) throw Error();
    return await image.rotate().resize({width:kind === 'players' ? 800 : 512,height:kind === 'players' ? 1000 : 512,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  } catch { throw new BadRequestException('Нужен корректный JPEG, PNG или WebP размером не менее 32×32 пикселей; анимация не поддерживается'); }
}

@Injectable()
export class MediaService {
  async prepare(kind: ImageKind, current: string | null | undefined, input: any, file?: ImageUpload): Promise<ImageChange | null> {
    if (input.imageAction === undefined) {
      if (file) throw new BadRequestException('Укажите действие с изображением');
      return null;
    }
    if (!['replace','remove'].includes(input.imageAction)) throw new BadRequestException('Неизвестное действие с изображением');
    if (input.expectedImageUrl !== (current ?? null)) throw new ConflictException('Изображение уже изменено в другом окне. Откройте карточку повторно');
    if (input.imageAction === 'remove') {
      if (file) throw new BadRequestException('Удаление изображения не должно содержать файл');
      return {url:null,previous:current ?? null};
    }
    if (!file) throw new BadRequestException('Выберите изображение');
    const bytes = await normalizeImage(file, kind);
    await mkdir(mediaDirectory(kind), {recursive:true, mode:0o755});
    const url = `/uploads/${kind}/${randomUUID()}.webp`, created = ownedImagePath(url,kind)!;
    try { await writeFile(created, bytes, {flag:'wx',mode:0o644}); }
    catch(error) { await this.removeFile(created); throw error; }
    return {url,created,previous:current ?? null};
  }
  async discard(change: ImageChange | null): Promise<void> {
    if (change?.created) await this.removeFile(change.created);
  }
  async retire(kind: ImageKind, change: ImageChange | null): Promise<void> {
    const previous = change && ownedImagePath(change.previous,kind);
    if (previous && change?.previous !== change?.url) await this.removeFile(previous);
  }
  private async removeFile(file: string): Promise<void> {
    try { await unlink(file); }
    catch (error:any) { if (error.code !== 'ENOENT') console.error('Не удалось очистить файл изображения:',error.code); }
  }
}
