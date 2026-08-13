import { nanoid } from "nanoid";
import { storagePut } from "./storage";

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadWebtoonImage(dataUrl: string, directory: "covers" | "episodes") {
  const matched = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!matched) throw new Error("JPG, PNG 또는 WEBP 이미지 파일만 업로드할 수 있습니다.");
  const [, contentType, encoded] = matched;
  if (!allowedTypes.has(contentType)) throw new Error("지원하지 않는 이미지 형식입니다.");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("이미지 한 장은 7MB 이하로 업로드해 주세요.");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const { key, url } = await storagePut(`webtoons/${directory}/${nanoid(18)}.${extension}`, bytes, contentType);
  return { key, url };
}

