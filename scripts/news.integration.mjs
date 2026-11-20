import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
const root = process.cwd(),
  require = createRequire(resolve("backend/package.json"));
const { Client } = require("pg"),
  { DataSource } = require("typeorm");
const { Initial1794139200000 } = require("./dist/migrations/initial.js");
const {
  PlayerIdentity1794614400000,
} = require("./dist/migrations/player-identity.js");
const sourceUrl = new URL(process.env.NEWS_TEST_DATABASE_URL || "");
assert.ok(
  ["localhost", "127.0.0.1"].includes(sourceUrl.hostname),
  "Use an explicitly isolated local test PostgreSQL",
);
assert.equal(sourceUrl.port, "55443");
const name = "hockey_news_test_" + Date.now();
assert.match(name, /^hockey_news_test_\d+$/);
sourceUrl.pathname = "/postgres";
const admin = new Client({ connectionString: sourceUrl.href });
await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
const url = new URL(sourceUrl);
url.pathname = "/" + name;
const temp = await mkdtemp(join(tmpdir(), "hockey-news-test-"));
const uploadDir = join(temp, "uploads");
let server,
  log = "",
  passed = 0;
const sessions = {};
const port = 4120,
  base = `http://127.0.0.1:${port}/`;
function start() {
  server = spawn(process.execPath, [resolve(root, "backend/dist/main.js")], {
    cwd: temp,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: url.href,
      JWT_SECRET: "news-test-only-session-key-at-least-32-characters",
      FRONTEND_ORIGIN: base.slice(0, -1),
      DEMO_SEED: "true",
      DEMO_PASSWORD: "NewsTest2026!",
      UPLOAD_DIR: uploadDir,
      HOST: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout.on("data", (b) => (log += b));
  server.stderr.on("data", (b) => (log += b));
}
async function stop() {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
}
async function ready() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "api/health")).ok) return;
    } catch {}
    if (server.exitCode !== null) throw Error(log);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw Error(log);
}
async function api(path, method = "GET", body, who = "admin", status = 200) {
  const r = await fetch(base + "api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(sessions[who] ? { Cookie: sessions[who] } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function login(who) {
  const r = await fetch(base + "api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: who, password: "NewsTest2026!" }),
  });
  assert.equal(r.status, 200);
  sessions[who] = r.headers.get("set-cookie").split(";")[0];
}
async function cover(
  buffer,
  type = "image/png",
  who = "admin",
  expected = 201,
) {
  const form = new FormData();
  form.append("cover", new Blob([buffer], { type }), "cover.png");
  const response = await fetch(base + "api/workspace/news/cover", {
    method: "POST",
    headers: sessions[who] ? { Cookie: sessions[who] } : {},
    body: form,
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
const ok = (message) => {
  passed++;
  console.log("✓ " + message);
};
const draft = {
  title: "Новый хоккейный сезон",
  body: "Первый абзац новости.\n\nВторой абзац с результатами.",
  category: "События",
  excerpt: "Команды возвращаются на лёд.",
};
try {
  const legacy = new DataSource({
    type: "postgres",
    url: url.href,
    migrations: [Initial1794139200000, PlayerIdentity1794614400000],
    entities: [],
    synchronize: false,
  });
  await legacy.initialize();
  await legacy.runMigrations();
  const [old] = await legacy.query(
    `INSERT INTO news(title,body,category,published,"createdAt","updatedAt") VALUES ($1,$2,$3,true,'2024-01-02T12:00:00Z','2024-01-02T12:00:00Z') RETURNING id`,
    [
      "Существующая новость",
      "Старый текст сохраняется без изменений",
      "История",
    ],
  );
  await legacy.destroy();
  start();
  await ready();
  for (const who of ["admin", "community", "secretary", "organizer"])
    await login(who);
  const oldArticle = await api("news/" + old.id);
  assert.equal(oldArticle.body, "Старый текст сохраняется без изменений");
  assert.equal(oldArticle.slug, `novost-${old.id}`);
  assert.equal(oldArticle.excerpt, "");
  assert.equal(oldArticle.publishedAt, "2024-01-02T12:00:00.000Z");
  assert.equal((await api("news/" + oldArticle.slug)).id, old.id);
  ok(
    "Миграция сохраняет текст, раздел и дату старой новости; чтение по ID и постоянному адресу",
  );

  let article = await api("workspace/news", "POST", draft, "admin", 201);
  assert.equal(article.published, false);
  assert.equal(article.slug, "novyy-hokkeynyy-sezon");
  await api("news/" + article.id, "GET", undefined, "anonymous", 404);
  assert.ok(!(await api("news")).items.some((n) => n.id === article.id));
  assert.ok(!(await api("public")).news.some((n) => n.id === article.id));
  assert.equal((await api("workspace/news/" + article.id)).body, draft.body);
  ok(
    "Новая статья сохраняется черновиком и скрыта от посетителей во всех публичных API",
  );

  for (const who of ["secretary", "organizer"]) {
    for (const [path, method, body, status] of [
      ["workspace/news", "GET", undefined, 403],
      ["workspace/news", "POST", draft, 403],
      [`workspace/news/${article.id}`, "GET", undefined, 403],
      [`workspace/news/${article.id}`, "PATCH", draft, 403],
      [`workspace/news/${article.id}/publish`, "POST", {}, 403],
      [`workspace/news/${article.id}`, "DELETE", {}, 403],
    ])
      await api(path, method, body, who, status);
    await cover(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
      who,
      403,
    );
  }
  await api("workspace/news", "GET", undefined, "anonymous", 401);
  await api("workspace/news/" + article.id, "DELETE", {}, "anonymous", 401);
  ok(
    "Прямые запросы создания, правки, удаления и обложек защищены от секретаря, администратора турнира и анонимного посетителя",
  );

  const image = await readFile(
    resolve(root, "frontend/public/editorial/hockey-action.png"),
  );
  const uploaded = await cover(image);
  assert.match(uploaded.url, /^\/uploads\/news\/[a-f0-9-]+\.png$/);
  await cover(
    Buffer.from('<svg onload="alert(1)">'),
    "image/png",
    "admin",
    400,
  );
  await cover(image, "image/jpeg", "admin", 400);
  await cover(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png", "admin", 413);
  await api(
    "workspace/news/" + article.id,
    "PATCH",
    { coverUrl: "https://other.ru/asset.png" },
    "admin",
    400,
  );
  await api(
    "workspace/news/" + article.id,
    "PATCH",
    { coverUrl: "/uploads/news/11111111-1111-4111-8111-111111111111.png" },
    "admin",
    400,
  );
  article = await api("workspace/news/" + article.id, "PATCH", {
    ...draft,
    coverUrl: uploaded.url,
    expectedUpdatedAt: article.updatedAt,
  });
  let imageResponse = await fetch(base + uploaded.url.slice(1));
  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("content-type"), /image\/png/);
  assert.match(imageResponse.headers.get("cache-control"), /immutable/);
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), image);
  assert.equal(
    (
      await fetch(
        base + "uploads/news/11111111-1111-4111-8111-111111111111.png",
      )
    ).status,
    404,
  );
  ok(
    "Обложка проверяется по сигнатуре, MIME и размеру; сохраняется и отдаётся изображением, отсутствующий файл возвращает 404",
  );

  article = await api(
    `workspace/news/${article.id}/publish`,
    "POST",
    { expectedUpdatedAt: article.updatedAt },
    "community",
    201,
  );
  assert.equal(article.published, true);
  assert.equal(article.slugLocked, true);
  assert.ok(article.publishedAt);
  const publishedAt = article.publishedAt,
    lockedSlug = article.slug,
    staleVersion = article.updatedAt;
  assert.equal((await api("news/" + lockedSlug)).coverUrl, uploaded.url);
  assert.ok(!("authorUserId" in (await api("news/" + lockedSlug))));
  assert.ok((await api("public")).news.some((n) => n.id === article.id));
  ok(
    "Администратор сообщества публикует статью; обложка и анонс доступны на сайте без внутренних полей",
  );

  await new Promise((resolve) => setTimeout(resolve, 10));
  article = await api("workspace/news/" + article.id, "PATCH", {
    title: "Обновлённый заголовок",
    expectedUpdatedAt: article.updatedAt,
  });
  assert.equal(article.slug, lockedSlug);
  assert.equal(article.publishedAt, publishedAt);
  await api(
    "workspace/news/" + article.id,
    "PATCH",
    { title: "Потерянная правка", expectedUpdatedAt: staleVersion },
    "admin",
    409,
  );
  await api(
    "workspace/news/" + article.id,
    "PATCH",
    { slug: "drugoy-adres" },
    "admin",
    409,
  );
  await api(
    "workspace/news/" + article.id,
    "PATCH",
    { title: "   " },
    "admin",
    400,
  );
  await api(
    "workspace/news/" + article.id,
    "PATCH",
    { body: "x".repeat(50001) },
    "admin",
    400,
  );
  assert.equal(
    (await api("news/" + lockedSlug)).title,
    "Обновлённый заголовок",
  );
  ok(
    "Правка сохраняет дату и адрес первой публикации; конфликт версий не затирает материал",
  );

  article = await api(
    `workspace/news/${article.id}/unpublish`,
    "POST",
    { expectedUpdatedAt: article.updatedAt },
    "admin",
    201,
  );
  assert.equal(article.published, false);
  assert.equal(article.slugLocked, true);
  await api("news/" + lockedSlug, "GET", undefined, "anonymous", 404);
  assert.ok(!(await api("public")).news.some((n) => n.id === article.id));
  article = await api(
    `workspace/news/${article.id}/publish`,
    "POST",
    { expectedUpdatedAt: article.updatedAt },
    "admin",
    201,
  );
  assert.equal(article.publishedAt, publishedAt);
  assert.equal(article.slug, lockedSlug);
  ok(
    "Снятие с публикации скрывает статью; повторная публикация сохраняет постоянную ссылку и исходную дату",
  );

  const duplicates = await Promise.all(
    [1, 2, 3].map(() => api("workspace/news", "POST", draft, "admin", 201)),
  );
  assert.equal(new Set(duplicates.map((n) => n.slug)).size, 3);
  await api(
    "workspace/news",
    "POST",
    { ...draft, slug: lockedSlug },
    "admin",
    409,
  );
  await api(
    "workspace/news",
    "POST",
    { ...draft, slug: "../unsafe" },
    "admin",
    400,
  );
  ok(
    "Параллельное создание одинаковых заголовков даёт уникальные адреса; занятый и некорректный адрес отклоняется",
  );

  const removed = duplicates[0];
  await api("workspace/news/" + removed.id, "DELETE", {
    expectedUpdatedAt: removed.updatedAt,
  });
  await api("workspace/news/" + removed.id, "GET", undefined, "admin", 404);
  assert.ok(
    !(await api("workspace/news?limit=50")).items.some(
      (n) => n.id === removed.id,
    ),
  );
  await api(
    "workspace/news",
    "POST",
    { ...draft, slug: removed.slug },
    "admin",
    409,
  );
  assert.ok(
    (await api("workspace/audit")).some(
      (entry) =>
        entry.action === "delete_news" && entry.entityId === removed.id,
    ),
  );
  ok(
    "Удаление архивирует статью, сохраняет занятый адрес и фиксируется в журнале",
  );

  const drafts = await api("workspace/news?status=draft&limit=1");
  assert.equal(drafts.items.length, 1);
  assert.ok(drafts.total >= 2);
  assert.equal(drafts.items[0].published, false);
  assert.equal(
    (await api("workspace/news?status=published&q=Обновлённый")).total,
    1,
  );
  assert.equal((await api("workspace/news?q=%25")).total, 0);
  const publicPage = await api("news?limit=1&page=2");
  assert.equal(publicPage.page, 2);
  assert.equal(publicPage.items.length, 1);
  assert.ok(!("body" in publicPage.items[0]));
  await api("news?limit=999", "GET", undefined, "anonymous", 400);
  ok(
    "Поиск, статусы и постраничная загрузка работают; публичные карточки не загружают полный текст",
  );

  await stop();
  start();
  await ready();
  imageResponse = await fetch(base + uploaded.url.slice(1));
  assert.equal(imageResponse.status, 200);
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), image);
  assert.equal((await api("news/" + lockedSlug)).id, article.id);
  ok("Перезапуск приложения сохраняет публикацию и загруженную обложку");
  for (const [index, title] of [
    "Большой хоккей начинается с нашей команды",
    "Один лёд. Две лиги. Одна большая история",
    "Секрет победы — в поддержке трибун",
    "Готовимся к следующему туру",
    "Хоккей, который объединяет город",
    "Герои недели: лучшие моменты матчей",
  ].entries())
    await api(
      "workspace/news",
      "POST",
      {
        title,
        body: "Чебоксарская хоккейная лига продолжает сезон.\n\nКоманды, игроки и болельщики встречаются на льду, чтобы написать новую историю городского хоккея.",
        excerpt: "Главные события сезона, командная работа и любовь к хоккею.",
        category: index % 2 ? "Жизнь лиги" : "События",
        coverUrl: uploaded.url,
        published: true,
      },
      "admin",
      201,
    );
  const latest = await api("news?limit=6");
  assert.equal(latest.items.length, 6);
  assert.ok(latest.items.every((n) => n.publishedAt));
  ok("Главная получает шесть последних опубликованных новостей с обложками");
  console.log(`News integration: ${passed} checks passed.`);
  if (process.env.NEWS_TEST_PREVIEW === "true") {
    await mkdir(resolve(root, "tmp"), { recursive: true });
    await writeFile(
      resolve(root, "tmp/news-preview-runtime.json"),
      JSON.stringify({
        database: name,
        temp,
        serverPid: server.pid,
        port,
        articleId: article.id,
        coverUrl: uploaded.url,
      }),
    );
    console.log(`PREVIEW_READY ${base}`);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} catch (error) {
  console.error(log.slice(-6000));
  throw error;
} finally {
  await stop();
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
  assert.ok(temp.startsWith(join(tmpdir(), "hockey-news-test-")));
  await rm(temp, { recursive: true, force: true });
}
