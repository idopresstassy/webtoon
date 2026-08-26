import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [works] = await connection.query(`
    SELECT id, slug, title, genre, description, thumbnailUrl, thumbnailKey, isPublished
    FROM webtoons
    ORDER BY id ASC
  `);
  const [episodes] = await connection.query(`
    SELECT id, webtoonId, episodeNumber, title, isPublished
    FROM episodes
    ORDER BY webtoonId ASC, episodeNumber ASC
  `);
  const [images] = await connection.query(`
    SELECT episodeId, imageUrl, imageKey, sortOrder
    FROM episodeImages
    ORDER BY episodeId ASC, sortOrder ASC
  `);

  const manifest = works.map(work => ({
    ...work,
    episodes: episodes
      .filter(episode => episode.webtoonId === work.id)
      .map(episode => ({
        ...episode,
        images: images.filter(image => image.episodeId === episode.id),
      })),
  }));

  process.stdout.write(`${JSON.stringify({ exportedAt: new Date().toISOString(), works: manifest }, null, 2)}\n`);
} finally {
  connection.destroy();
}
