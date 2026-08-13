type CoverProps = {
  src?: string | null;
  title: string;
  genre?: string;
  className?: string;
};

export default function WebtoonCover({ src, title, genre, className = "" }: CoverProps) {
  if (src) return <img className={`webtoon-cover__image ${className}`} src={src} alt={`${title} 표지`} />;
  const letter = title.trim().charAt(0) || "명";
  return (
    <div className={`webtoon-cover__fallback ${className}`} aria-label={`${title} 기본 표지`}>
      <span className="webtoon-cover__grain" />
      <span className="webtoon-cover__genre">{genre || "WEBTOON"}</span>
      <strong>{letter}</strong>
      <span className="webtoon-cover__title">{title}</span>
    </div>
  );
}

