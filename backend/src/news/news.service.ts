import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IsNull } from "typeorm";
import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { AppService } from "../app.service";
import { News } from "../entities";
import type { Actor } from "../security";
import {
  detectNewsImage,
  NEWS_COVER_PATH,
  newsSlug,
  newsText,
} from "./news-content";

export const newsUploadsDirectory = () =>
  resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), "uploads"), "news");

@Injectable()
export class NewsService {
  constructor(private readonly app: AppService) {}
  private get repo() {
    return this.app.db.getRepository(News);
  }

  async list(query: Record<string, string>, actor?: Actor) {
    if (actor) this.app.global(actor);
    const page = this.pageNumber(query.page, 1, 100000);
    const limit = this.pageNumber(query.limit, actor ? 20 : 12, 50);
    const builder = this.repo
      .createQueryBuilder("n")
      .where('n."deletedAt" IS NULL');
    if (!actor) builder.andWhere("n.published = true");
    else if (query.status === "published" || query.status === "draft")
      builder.andWhere("n.published = :published", {
        published: query.status === "published",
      });
    if (query.q?.trim())
      builder.andWhere("n.title ILIKE :query", {
        query: `%${query.q
          .trim()
          .slice(0, 200)
          .replace(/[\\%_]/g, "\\$&")}%`,
      });
    builder
      .orderBy(actor ? "n.updatedAt" : "n.publishedAt", "DESC")
      .addOrderBy("n.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit);
    const [items, total] = await builder.getManyAndCount();
    return {
      items: items.map((item) => this.view(item, !!actor, false)),
      total,
      page,
      limit,
    };
  }

  async get(key: string, actor?: Actor) {
    if (actor) this.app.global(actor);
    const where = /^\d+$/.test(key) ? { id: Number(key) } : { slug: key };
    const news = await this.repo.findOneBy({
      ...where,
      deletedAt: IsNull(),
      ...(!actor ? { published: true } : {}),
    });
    if (!news) throw new NotFoundException("Новость не найдена");
    return this.view(news, !!actor);
  }

  async save(actor: Actor, input: any, id?: number) {
    this.app.global(actor);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new BadRequestException("Проверьте поля новости");
    const fields: Partial<News> = {};
    for (const [name, label, min, max] of [
      ["title", "Заголовок", 3, 200],
      ["body", "Текст новости", 1, 50000],
      ["excerpt", "Краткий анонс", 0, 500],
      ["category", "Раздел", 1, 50],
    ] as const) {
      if (input[name] !== undefined)
        fields[name] = newsText(input[name], label, min, max);
    }
    if (!id && (!fields.title || !fields.body))
      throw new BadRequestException("Заполните заголовок и текст новости");
    if (input.published !== undefined && typeof input.published !== "boolean")
      throw new BadRequestException("Некорректный статус публикации");
    if (input.coverUrl !== undefined) {
      if (input.coverUrl !== null && typeof input.coverUrl !== "string")
        throw new BadRequestException("Некорректная обложка");
      const coverUrl = input.coverUrl?.trim() || null;
      if (coverUrl) {
        if (!NEWS_COVER_PATH.test(coverUrl))
          throw new BadRequestException("Загрузите обложку через редактор");
        try {
          await access(resolve(newsUploadsDirectory(), basename(coverUrl)));
        } catch {
          throw new BadRequestException(
            "Обложка не найдена. Загрузите изображение повторно",
          );
        }
      }
      fields.coverUrl = coverUrl;
    }
    return this.app.db.transaction(async (manager) => {
      const repo = manager.getRepository(News);
      // Serialize slug allocation with the unique index as the final safeguard.
      await manager.query("SELECT pg_advisory_xact_lock(1795176000)");
      const news = id
        ? await repo.findOne({
            where: { id, deletedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
          })
        : repo.create({
            published: false,
            category: "Сообщество",
            excerpt: "",
            authorUserId: actor.id,
          });
      if (!news) throw new NotFoundException("Новость не найдена");
      this.checkVersion(news, input);
      Object.assign(news, fields);
      const requestedSlug =
        input.slug === undefined
          ? ""
          : newsText(input.slug, "Адрес статьи", 0, 200);
      if (news.slugLocked && requestedSlug && requestedSlug !== news.slug)
        throw new ConflictException(
          "После первой публикации адрес статьи менять нельзя",
        );
      if (!news.slugLocked && (requestedSlug || !news.slug)) {
        if (
          requestedSlug &&
          !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(requestedSlug)
        )
          throw new BadRequestException(
            "Адрес: латинские буквы, цифры и дефисы; начните с буквы",
          );
        const base = requestedSlug || newsSlug(news.title);
        let candidate = base;
        let suffix = 2;
        while (true) {
          const collision = await repo.findOneBy({ slug: candidate });
          if (!collision || collision.id === news.id) break;
          if (requestedSlug)
            throw new ConflictException("Такой адрес статьи уже используется");
          candidate = `${base}-${suffix++}`;
        }
        news.slug = candidate;
      }
      if (input.published !== undefined) news.published = input.published;
      if (news.published) {
        news.publishedAt ??= new Date();
        news.slugLocked = true;
      }
      news.updatedByUserId = actor.id;
      await repo.save(news);
      await this.app.audit(
        actor,
        id ? "update" : "create",
        "news",
        news.id,
        null,
        { published: news.published },
        manager,
      );
      return this.view(news, true);
    });
  }

  async remove(actor: Actor, id: number, input: any) {
    this.app.global(actor);
    return this.app.db.transaction(async (manager) => {
      const repo = manager.getRepository(News);
      const news = await repo.findOne({
        where: { id, deletedAt: IsNull() },
        lock: { mode: "pessimistic_write" },
      });
      if (!news) throw new NotFoundException("Новость не найдена");
      this.checkVersion(news, input);
      news.deletedAt = new Date();
      news.published = false;
      news.updatedByUserId = actor.id;
      await repo.save(news);
      await this.app.audit(
        actor,
        "delete_news",
        "news",
        id,
        null,
        { title: news.title },
        manager,
      );
      return { ok: true };
    });
  }

  async cover(actor: Actor, file?: { buffer: Buffer; mimetype: string }) {
    this.app.global(actor);
    if (!file || file.buffer.length > 5 * 1024 * 1024)
      throw new BadRequestException("Выберите обложку до 5 МБ");
    const extension = detectNewsImage(file.buffer);
    const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    if (!extension || file.mimetype !== mime)
      throw new BadRequestException("Обложка должна быть PNG, JPEG или WebP");
    const fileName = `${randomUUID()}.${extension}`;
    await mkdir(newsUploadsDirectory(), { recursive: true, mode: 0o755 });
    await writeFile(resolve(newsUploadsDirectory(), fileName), file.buffer, {
      flag: "wx",
      mode: 0o644,
    });
    return { url: `/uploads/news/${fileName}` };
  }

  private pageNumber(value: string | undefined, fallback: number, max: number) {
    const number = value === undefined ? fallback : Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max)
      throw new BadRequestException("Некорректная страница или размер списка");
    return number;
  }
  private checkVersion(news: News, input: any) {
    if (
      input?.expectedUpdatedAt !== undefined &&
      news.id &&
      input.expectedUpdatedAt !== news.updatedAt.toISOString()
    )
      throw new ConflictException(
        "Новость уже изменена другим администратором. Откройте её заново перед сохранением",
      );
  }
  private view(news: News, admin: boolean, full = true) {
    const {
      id,
      title,
      slug,
      excerpt,
      coverUrl,
      category,
      publishedAt,
      createdAt,
    } = news;
    return {
      id,
      title,
      slug: slug || String(id),
      excerpt: excerpt || (full ? "" : news.body.slice(0, 180)),
      coverUrl,
      category,
      publishedAt,
      createdAt,
      ...(full ? { body: news.body } : {}),
      ...(admin
        ? {
            published: news.published,
            slugLocked: news.slugLocked,
            updatedAt: news.updatedAt,
            authorUserId: news.authorUserId,
            updatedByUserId: news.updatedByUserId,
          }
        : {}),
    };
  }
}
