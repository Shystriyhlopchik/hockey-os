import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaService, normalizeImage, ownedImagePath, mediaBody, MAX_IMAGE_BYTES } from './media.service';

const raster=(width=1200,height=1500)=>sharp({create:{width,height,channels:4,background:{r:210,g:30,b:50,alpha:0.3}}}).png().toBuffer();
test('Изображения уменьшаются, перекодируются и сохраняют прозрачность логотипа',async()=>{
  const input=await raster();
  const photo=await sharp(await normalizeImage({buffer:input,mimetype:'image/png'},'players')).metadata();
  const logo=await sharp(await normalizeImage({buffer:input,mimetype:'image/png'},'teams')).metadata();
  assert.equal(photo.format,'webp');assert.equal(photo.width,800);assert.equal(photo.height,1000);
  assert.ok(logo.width!<=512&&logo.height!<=512);assert.equal(logo.hasAlpha,true);
});
test('EXIF-ориентация применяется один раз, метаданные не переносятся',async()=>{
  const input=await sharp(await raster(600,400)).jpeg().withMetadata({orientation:6}).toBuffer();
  const output=await sharp(await normalizeImage({buffer:input,mimetype:'image/jpeg'},'players')).metadata();
  assert.equal(output.width,400);assert.equal(output.height,600);assert.equal(output.orientation,undefined);assert.equal(output.exif,undefined);
});
test('Повреждённые файлы, подмена MIME, слишком маленькие и большие изображения отклоняются',async()=>{
  const image=await raster(64,64);
  await assert.rejects(normalizeImage({buffer:image,mimetype:'image/jpeg'},'players'),/корректный/);
  await assert.rejects(normalizeImage({buffer:image.subarray(0,32),mimetype:'image/png'},'players'),/корректный/);
  await assert.rejects(normalizeImage({buffer:await raster(31,64),mimetype:'image/png'},'players'),/32×32/);
  await assert.rejects(normalizeImage({buffer:Buffer.alloc(MAX_IMAGE_BYTES+1),mimetype:'image/png'},'players'),/5 МБ/);
  await assert.rejects(normalizeImage({buffer:Buffer.from('<svg></svg>'),mimetype:'image/svg+xml'},'teams'),/корректный/);
});
test('Очистка ограничена серверными UUID-файлами нужного типа',()=>{
  assert.ok(ownedImagePath('/uploads/players/11111111-1111-4111-8111-111111111111.webp','players'));
  for(const value of ['/uploads/teams/11111111-1111-4111-8111-111111111111.webp','/uploads/players/../news/test.webp','https://other.ru/photo.webp','/etc/passwd'])assert.equal(ownedImagePath(value,'players'),null);
  assert.deepEqual(mediaBody({data:'{"name":"Команда"}'}),{name:'Команда'});
  assert.throws(()=>mediaBody({data:'[]'}),/Некорректные/);
});
test('Неизменённое изображение сохраняется, устаревшая замена не пишет файлы, отмена очищает новый файл',async()=>{
  const root=await mkdtemp(join(tmpdir(),'hockey-media-unit-')),previousRoot=process.env.UPLOAD_DIR;process.env.UPLOAD_DIR=root;
  try{
    const media=new MediaService(),file={buffer:await raster(100,100),mimetype:'image/png'};
    assert.equal(await media.prepare('players','old',{},undefined),null);
    await assert.rejects(media.prepare('players','old',{imageAction:'replace',expectedImageUrl:'stale'},file),/другом окне/);
    assert.deepEqual(await readdir(root),[]);
    const change=await media.prepare('players',null,{imageAction:'replace',expectedImageUrl:null},file);assert.ok(change?.created);await access(change.created);
    await media.discard(change);assert.deepEqual(await readdir(join(root,'players')),[]);
    const next=await media.prepare('teams',null,{imageAction:'replace',expectedImageUrl:null},file);assert.ok(next?.url);
    await media.retire('teams',{url:null,previous:next.url});assert.deepEqual(await readdir(join(root,'teams')),[]);
    await assert.rejects(media.prepare('players',null,{imageAction:'remove',expectedImageUrl:null},file),/не должно содержать файл/);
  }finally{if(previousRoot===undefined)delete process.env.UPLOAD_DIR;else process.env.UPLOAD_DIR=previousRoot;await rm(root,{recursive:true,force:true});}
});
