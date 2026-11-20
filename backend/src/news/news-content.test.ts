import test from "node:test";
import assert from "node:assert/strict";
import {
  newsSlug,
  newsText,
  detectNewsImage,
  NEWS_COVER_PATH,
} from "./news-content";

test("Russian headlines produce stable readable addresses including numeric and punctuation-only titles", () => {
  assert.equal(newsSlug("Первый матч — на льду!"), "pervyy-match-na-ldu");
  assert.equal(newsSlug("2026: новый сезон"), "novost-2026-novyy-sezon");
  assert.equal(newsSlug("!!!"), "novost");
  assert.ok(newsSlug("А".repeat(300)).length <= 160);
});
test("News validation preserves paragraphs as plain text and rejects whitespace-only required content", () => {
  assert.equal(
    newsText("  Первый абзац\n\nВторой <b>абзац</b>  ", "Текст", 1, 50000),
    "Первый абзац\n\nВторой <b>абзац</b>",
  );
  for (const value of ["  ", null, 123, "123456"])
    assert.throws(() => newsText(value, "Текст", 1, 5));
});
test("Cover detection verifies image signatures and paths cannot contain executable extensions or traversal", () => {
  assert.equal(
    detectNewsImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "png",
  );
  assert.equal(detectNewsImage(Buffer.from([255, 216, 255, 225])), "jpg");
  assert.equal(detectNewsImage(Buffer.from("RIFF1234WEBP")), "webp");
  assert.equal(detectNewsImage(Buffer.from('<svg onload="alert(1)">')), null);
  assert.ok(
    NEWS_COVER_PATH.test(
      "/uploads/news/11111111-1111-4111-8111-111111111111.png",
    ),
  );
  for (const value of [
    "/uploads/news/../image.png",
    "https://other.ru/logo.jpg",
    "/uploads/news/image.html",
    "/uploads/news/11111111-1111-4111-8111-111111111111.svg",
  ])
    assert.equal(NEWS_COVER_PATH.test(value), false);
});
