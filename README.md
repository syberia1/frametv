# frameXTV for Kino 1.2.0

Cumple el contrato Kino (apiVersion 6):

- `search` → Item[]
- `home` → HomeRow[] con `id`, `title`, `ref`, `items` (como el plugin archive oficial)
- `browse` → { items, next }
- `episodes` → { series, episodes }
- `resolve` → Stream (con `download` capability y `streamHosts: any`)

API: `api.framextv.cc` (+ fallbacks automáticos a .xyz/.tech/.pro)
