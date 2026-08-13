import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { uploadWebtoonImage } from "./webtoonUploads";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  return next();
});

const slugSchema = z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/, "영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
const imageDataUrlSchema = z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "이미지 파일을 선택해 주세요.");

const workFields = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(160),
  genre: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(5000),
  isPublished: z.boolean().default(true),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  webtoons: router({
    list: publicProcedure.input(z.object({ search: z.string().max(160).optional(), genre: z.string().max(80).optional() }).optional()).query(({ input }) => db.getPublishedWebtoons(input)),
    genres: publicProcedure.query(() => db.getGenres()),
    detail: publicProcedure.input(z.object({ slug: z.string().min(1).max(160) })).query(async ({ input }) => {
      const result = await db.getPublicWebtoonBySlug(input.slug);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "공개된 작품을 찾을 수 없습니다." });
      return result;
    }),
    viewer: publicProcedure.input(z.object({ slug: z.string().min(1).max(160), episodeNumber: z.number().int().positive() })).query(async ({ input }) => {
      const result = await db.getPublicEpisode(input.slug, input.episodeNumber);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "공개된 회차를 찾을 수 없습니다." });
      return result;
    }),
    adminList: adminProcedure.query(() => db.getAdminWebtoons()),
    adminGet: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const result = await db.getAdminWebtoon(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "작품을 찾을 수 없습니다." });
      return result;
    }),
    adminCreate: adminProcedure.input(workFields.extend({ coverDataUrl: imageDataUrlSchema })).mutation(async ({ input }) => {
      const cover = await uploadWebtoonImage(input.coverDataUrl, "covers");
      const id = await db.createWebtoon({
        slug: input.slug,
        title: input.title,
        genre: input.genre,
        description: input.description,
        isPublished: input.isPublished ? 1 : 0,
        thumbnailUrl: cover.url,
        thumbnailKey: cover.key,
      });
      return { id };
    }),
    adminUpdate: adminProcedure.input(workFields.extend({ id: z.number().int().positive(), coverDataUrl: imageDataUrlSchema.optional() })).mutation(async ({ input }) => {
      const { id, coverDataUrl, ...values } = input;
      const cover = coverDataUrl ? await uploadWebtoonImage(coverDataUrl, "covers") : null;
      await db.updateWebtoon(id, {
        ...values,
        isPublished: values.isPublished ? 1 : 0,
        ...(cover ? { thumbnailUrl: cover.url, thumbnailKey: cover.key } : {}),
      });
      return { id };
    }),
    adminDelete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      await db.removeWebtoon(input.id);
      return { id: input.id };
    }),
    adminCreateEpisode: adminProcedure.input(z.object({
      webtoonId: z.number().int().positive(),
      episodeNumber: z.number().int().positive(),
      title: z.string().trim().min(1).max(160),
      isPublished: z.boolean().default(true),
      imageDataUrls: z.array(imageDataUrlSchema).min(1).max(30),
    })).mutation(async ({ input }) => {
      const episodeId = await db.createEpisode({
        webtoonId: input.webtoonId,
        episodeNumber: input.episodeNumber,
        title: input.title,
        isPublished: input.isPublished ? 1 : 0,
      });
      const images = [] as { key: string; url: string }[];
      for (const dataUrl of input.imageDataUrls) images.push(await uploadWebtoonImage(dataUrl, "episodes"));
      await db.replaceEpisodeImages(episodeId, images.map(image => ({ imageKey: image.key, imageUrl: image.url })));
      return { id: episodeId };
    }),
    adminUpdateEpisode: adminProcedure.input(z.object({
      id: z.number().int().positive(),
      episodeNumber: z.number().int().positive(),
      title: z.string().trim().min(1).max(160),
      isPublished: z.boolean().default(true),
      imageDataUrls: z.array(imageDataUrlSchema).min(1).max(30).optional(),
      existingImages: z.array(z.object({ imageUrl: z.string().min(1), imageKey: z.string().min(1) })).min(1).max(30).optional(),
    })).mutation(async ({ input }) => {
      const { id, imageDataUrls, existingImages, ...values } = input;
      await db.updateEpisode(id, { ...values, isPublished: values.isPublished ? 1 : 0 });
      if (imageDataUrls) {
        const images = [] as { key: string; url: string }[];
        for (const dataUrl of imageDataUrls) images.push(await uploadWebtoonImage(dataUrl, "episodes"));
        await db.replaceEpisodeImages(id, images.map(image => ({ imageKey: image.key, imageUrl: image.url })));
      } else if (existingImages) {
        await db.replaceEpisodeImages(id, existingImages.map(image => ({ imageKey: image.imageKey, imageUrl: image.imageUrl })));
      }
      return { id };
    }),
    adminDeleteEpisode: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      await db.removeEpisode(input.id);
      return { id: input.id };
    }),
  }),
});

export type AppRouter = typeof appRouter;
