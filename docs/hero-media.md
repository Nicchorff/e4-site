# Hero media (performance)

O GIF `public/e4-hero.gif` (~600KB) prejudica Lighthouse. O site já usa:

- `e4-hero-poster.jpg` — primeiro frame (LCP / poster)
- `e4-hero.webm` / `e4-hero.mp4` — se existirem, o hero troca o GIF por `<video>`

## Converter com ffmpeg

Na pasta `public/`:

```bash
# Poster (já gerado via PIL nesta fase; re-gerar se o GIF mudar)
ffmpeg -y -i e4-hero.gif -frames:v 1 -q:v 2 e4-hero-poster.jpg

# WebM (VP9) — preferido
ffmpeg -y -i e4-hero.gif -c:v libvpx-vp9 -b:v 0 -crf 32 -an e4-hero.webm

# MP4 fallback (H.264)
ffmpeg -y -i e4-hero.gif -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart e4-hero.mp4
```

Depois do convert, o hero detecta `e4-hero.webm` via `HEAD` e passa a usá-lo automaticamente.

## Checklist Lighthouse

Sem webm, performance mobile da home pode ficar **abaixo de 90** por causa do GIF — aceitável até converter. Com webm + poster, meta ≥90 em `/`, `/regras`, `/loja`.
