# 🎉 Party Fun

Juego de fiesta tipo *Time's Up* para jugar con **un solo móvil**: 3 rondas (descripción libre, una sola palabra y mímica) con las mismas palabras.

**Stack:** Next.js 14 (App Router) · Tailwind CSS · Supabase · lucide-react

## Puesta en marcha (10 minutos)

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor → New query**, pega todo `supabase_setup.sql` y pulsa **Run**.
   Crea la tabla `words`, las políticas RLS, dos funciones RPC y 180 palabras iniciales.
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
- **Ronda 1 – Descripción libre**, **Ronda 2 – Una sola palabra**, **Ronda 3 – Mímica**.
- Cada acierto suma 1 punto al equipo en turno. *Pasar* manda la palabra al final del mazo.
- *Deshacer último* revierte el último toque (también desde el resumen del turno).
- Si el móvil se bloquea o se recarga la página, la partida se guarda y puedes **Continuar**.

## Ampliar palabras sin tocar código
Botón **Añadir palabras (JSON)** en la pantalla principal:
```json
[
  {"word": "Koala", "category": "Animales"},
  {"word": "Hacer la siesta", "category": "Acciones y Verbos"}
]
```
Categorías válidas: `Animales`, `Películas y Series`, `Videojuegos`, `Deportes`, `Acciones y Verbos`, `Objetos cotidianos`, `Personajes Famosos`, `Comida y Bebida`, `Lugares`, `Profesiones` (no distingue mayúsculas ni tildes). Las palabras repetidas se ignoran y la app te dice cuántas se insertaron de verdad.

## Anti-repetición
Al empezar, la app pide las palabras menos jugadas (`times_played ASC`) de los temas elegidos, sortea las de la partida y les suma +1. Durante las rondas no hay ni una petición de red. En *Ajustes rápidos* tienes **Resetear contadores** para empezar de cero.

## Estructura
```
app/layout.js        Metadatos, viewport y PWA
app/page.js          Todas las pantallas y el motor del juego
app/globals.css      Estilos base (100dvh, sin zoom ni scroll accidental)
lib/supabaseClient.js
lib/constants.js     Categorías, reglas de cada ronda, colores
lib/sounds.js        Sonidos con Web Audio API + vibración
public/manifest.json Iconos y manifiesto PWA
supabase_setup.sql   Tabla, RLS, RPC y 180 palabras
```
