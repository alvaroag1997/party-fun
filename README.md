# 🎭 Adivinódromo

Juego de fiesta tipo *Time's Up* para jugar con **un solo móvil**: 3 rondas (descripción libre, una sola palabra y mímica) con las mismas palabras.

**Stack:** Next.js 14 (App Router) · Tailwind CSS · Supabase · lucide-react

## Puesta en marcha (10 minutos)

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor → New query**, pega todo `supabase_setup.sql` y pulsa **Run**.
   Crea la tabla `words`, las políticas RLS, dos funciones RPC y 621 palabras en 11 categorías.
3. En **Project Settings → API** copia la *Project URL* y la *anon public key*.

### 2. En local (opcional)
```bash
cp .env.example .env.local   # y pega tus claves
npm install
npm run dev                  # http://localhost:3000
```

### 3. GitHub + Vercel
1. Sube esta carpeta a un repositorio nuevo de GitHub.
2. En Vercel: **Add New → Project → Import** ese repositorio.
3. En **Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Si añades las variables después, haz *Redeploy* (se incrustan al compilar).

### 4. Instalar como app
- **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.
- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.

## Cómo se juega
1. Apunta a **todos los participantes** (se guardan en el móvil para la próxima vez).
2. Elige **2, 3 o 4 equipos** (Rojo, Azul, Amarillo, Verde) y pulsa **Generar Equipos**: el reparto es aleatorio y equilibrado. Puedes **volver a mezclar** o tocar a un jugador para cambiarlo de equipo.
3. Antes de cada turno aparece **"Le toca a: [jugador]"**; dentro de cada equipo se rota en orden, también entre rondas.
4. **Ronda 1 – Descripción libre:** pasar palabra **resta 5 segundos**. **Ronda 2 – Una sola palabra** y **Ronda 3 – Mímica:** pasar no penaliza.
5. Al acabar cada turno se revisan los aciertos: si se desmarca uno, se resta el punto y la palabra vuelve al mazo (y si era la última, la ronda continúa).
6. En el podio final: clasificación, **MVP** y **palabra maldita** (la más pasada).

Si el móvil se bloquea o se recarga la página, la partida se guarda y puedes **Continuar**.

## Añadir palabras
Se gestionan directamente en Supabase (**Table Editor → words**, o un `insert` en el SQL Editor). Las categorías válidas son: `Animales`, `Películas y Series`, `Videojuegos`, `Deportes`, `Acciones y Verbos`, `Objetos cotidianos`, `Personajes Famosos`, `Comida y Bebida`, `Lugares`, `Profesiones`, `Disney`.

## Estadísticas (solo para ti)
Cada partida apunta de forma anónima cuándo empieza y cuándo termina (nº de jugadores, equipos, palabras, temas y duración). No se guardan nombres ni nada que identifique a nadie, y desde la app no se pueden leer.

Para verlas: **Supabase → Table Editor → `estadisticas_diarias`** (resumen por día) o `game_events` (detalle).

## Anti-repetición
Al empezar, la app pide las palabras menos jugadas (`times_played ASC`) de los temas elegidos, sortea las de la partida y les suma +1. Durante las rondas no hay ni una petición de red. En *Ajustes rápidos* tienes **Resetear contadores** para empezar de cero.

## Estructura
```
app/layout.js        Metadatos, viewport y PWA
app/page.js          Pantallas y motor del juego (equipos, turnos, revisión, podio)
app/globals.css      Estilos base (100dvh, sin zoom ni scroll accidental)
lib/supabaseClient.js
lib/constants.js     Categorías, reglas de cada ronda, equipos de colores
lib/sounds.js        Sonidos con Web Audio API + vibración
lib/stats.js         Contador anónimo de partidas
public/manifest.json Iconos y manifiesto PWA
supabase_setup.sql   Tabla, RLS, RPC y 621 palabras
```
