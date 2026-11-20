import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Public, AuthRequest } from "../security";
import { NewsService } from "./news.service";

@Controller()
export class NewsController {
  constructor(private readonly news: NewsService) {}
  @Public() @Get("news") list(@Query() query: Record<string, string>) {
    return this.news.list(query);
  }
  @Public() @Get("news/:key") article(@Param("key") key: string) {
    return this.news.get(key);
  }
  @Get("workspace/news") management(
    @Query() query: Record<string, string>,
    @Req() request: AuthRequest,
  ) {
    return this.news.list(query, request.actor);
  }
  @Get("workspace/news/:id") edit(
    @Param("id", ParseIntPipe) id: number,
    @Req() request: AuthRequest,
  ) {
    return this.news.get(String(id), request.actor);
  }
  @Post("workspace/news") create(
    @Body() input: any,
    @Req() request: AuthRequest,
  ) {
    return this.news.save(request.actor, input);
  }
  @Patch("workspace/news/:id") update(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: any,
    @Req() request: AuthRequest,
  ) {
    return this.news.save(request.actor, input, id);
  }
  @Post("workspace/news/:id/publish") publish(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: any,
    @Req() request: AuthRequest,
  ) {
    return this.news.save(request.actor, { ...input, published: true }, id);
  }
  @Post("workspace/news/:id/unpublish") unpublish(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: any,
    @Req() request: AuthRequest,
  ) {
    return this.news.save(request.actor, { ...input, published: false }, id);
  }
  @Delete("workspace/news/:id") remove(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: any,
    @Req() request: AuthRequest,
  ) {
    return this.news.remove(request.actor, id, input);
  }
  @Post("workspace/news/cover")
  @UseInterceptors(
    FileInterceptor("cover", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  cover(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Req() request: AuthRequest,
  ) {
    return this.news.cover(request.actor, file);
  }
}
