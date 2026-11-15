-- =====================================================================
--  PARTY FUN · Script de configuración de Supabase
--  Ejecútalo entero en: Supabase Dashboard → SQL Editor → New query → Run
--  Es re-ejecutable: no duplica palabras ni falla si ya existe algo.
-- =====================================================================

-- 1) TABLA ---------------------------------------------------------------
create table if not exists public.words (
  id           bigint generated always as identity primary key,
  word         text        unique not null,
  category     text        not null,
  times_played int         not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists words_category_played_idx
  on public.words (category, times_played);

-- 2) ROW LEVEL SECURITY --------------------------------------------------
alter table public.words enable row level security;

drop policy if exists "words_select_public" on public.words;
drop policy if exists "words_insert_public" on public.words;
drop policy if exists "words_update_public" on public.words;

-- Lectura para todos (anon y autenticados)
create policy "words_select_public"
  on public.words for select
  to anon, authenticated
  using (true);

-- Inserción masiva desde el importador JSON de la app
create policy "words_insert_public"
  on public.words for insert
  to anon, authenticated
  with check (char_length(trim(word)) > 0 and char_length(trim(category)) > 0);

-- Actualización (solo del contador, ver permisos por columna abajo)
create policy "words_update_public"
  on public.words for update
  to anon, authenticated
  using (true)
  with check (times_played >= 0);

-- Permisos por columna: con la ANON_KEY solo se puede modificar times_played.
-- (RLS filtra filas; los GRANT por columna limitan QUÉ columnas se tocan.)
revoke update, delete, truncate, references, trigger on public.words from anon, authenticated;
grant  update (times_played) on public.words to anon, authenticated;
grant  select, insert on public.words to anon, authenticated;

-- 3) FUNCIONES RPC (atómicas, las usa la app) ----------------------------
-- Suma +1 a times_played para las palabras de la partida en una sola llamada
create or replace function public.increment_times_played(word_ids bigint[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.words
     set times_played = times_played + 1
   where id = any(word_ids);
$$;

-- Pone todos los contadores a 0 (botón "Resetear contadores")
create or replace function public.reset_times_played()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.words set times_played = 0 where times_played <> 0;
$$;

grant execute on function public.increment_times_played(bigint[]) to anon, authenticated;
grant execute on function public.reset_times_played()            to anon, authenticated;

-- 4) DATOS INICIALES (180 palabras, 18 por categoría) --------------------
insert into public.words (word, category) values
  -- Animales
  ('Perro', 'Animales'),
  ('Gato', 'Animales'),
  ('Elefante', 'Animales'),
  ('Jirafa', 'Animales'),
  ('Canguro', 'Animales'),
  ('Pingüino', 'Animales'),
  ('Cocodrilo', 'Animales'),
  ('Delfín', 'Animales'),
  ('Murciélago', 'Animales'),
  ('Camaleón', 'Animales'),
  ('Pulpo', 'Animales'),
  ('Mariposa', 'Animales'),
  ('Caracol', 'Animales'),
  ('Búho', 'Animales'),
  ('Rinoceronte', 'Animales'),
  ('Ornitorrinco', 'Animales'),
  ('Hipopótamo', 'Animales'),
  ('Medusa', 'Animales'),

  -- Películas y Series
  ('Titanic', 'Películas y Series'),
  ('Jurassic Park', 'Películas y Series'),
  ('Star Wars', 'Películas y Series'),
  ('Harry Potter', 'Películas y Series'),
  ('El Rey León', 'Películas y Series'),
  ('Juego de Tronos', 'Películas y Series'),
  ('Breaking Bad', 'Películas y Series'),
  ('La Casa de Papel', 'Películas y Series'),
  ('Friends', 'Películas y Series'),
  ('Los Simpson', 'Películas y Series'),
  ('Shrek', 'Películas y Series'),
  ('Matrix', 'Películas y Series'),
  ('Toy Story', 'Películas y Series'),
  ('Stranger Things', 'Películas y Series'),
  ('Torrente', 'Películas y Series'),
  ('El Señor de los Anillos', 'Películas y Series'),
  ('Regreso al Futuro', 'Películas y Series'),
  ('Frozen', 'Películas y Series'),

  -- Videojuegos
  ('Super Mario', 'Videojuegos'),
  ('Tetris', 'Videojuegos'),
  ('Minecraft', 'Videojuegos'),
  ('Fortnite', 'Videojuegos'),
  ('Pac-Man', 'Videojuegos'),
  ('The Legend of Zelda', 'Videojuegos'),
  ('Pokémon', 'Videojuegos'),
  ('Grand Theft Auto', 'Videojuegos'),
  ('FIFA', 'Videojuegos'),
  ('Call of Duty', 'Videojuegos'),
  ('Street Fighter', 'Videojuegos'),
  ('Sonic', 'Videojuegos'),
  ('Los Sims', 'Videojuegos'),
  ('Among Us', 'Videojuegos'),
  ('Candy Crush', 'Videojuegos'),
  ('Mario Kart', 'Videojuegos'),
  ('Donkey Kong', 'Videojuegos'),
  ('League of Legends', 'Videojuegos'),

  -- Deportes
  ('Fútbol', 'Deportes'),
  ('Baloncesto', 'Deportes'),
  ('Tenis', 'Deportes'),
  ('Natación', 'Deportes'),
  ('Ciclismo', 'Deportes'),
  ('Boxeo', 'Deportes'),
  ('Esgrima', 'Deportes'),
  ('Surf', 'Deportes'),
  ('Golf', 'Deportes'),
  ('Pádel', 'Deportes'),
  ('Balonmano', 'Deportes'),
  ('Rugby', 'Deportes'),
  ('Escalada', 'Deportes'),
  ('Esquí', 'Deportes'),
  ('Waterpolo', 'Deportes'),
  ('Petanca', 'Deportes'),
  ('Ajedrez', 'Deportes'),
  ('Curling', 'Deportes'),

  -- Acciones y Verbos
  ('Bailar', 'Acciones y Verbos'),
  ('Estornudar', 'Acciones y Verbos'),
  ('Nadar', 'Acciones y Verbos'),
  ('Roncar', 'Acciones y Verbos'),
  ('Cocinar', 'Acciones y Verbos'),
  ('Planchar', 'Acciones y Verbos'),
  ('Bostezar', 'Acciones y Verbos'),
  ('Aplaudir', 'Acciones y Verbos'),
  ('Silbar', 'Acciones y Verbos'),
  ('Tropezar', 'Acciones y Verbos'),
  ('Afeitarse', 'Acciones y Verbos'),
  ('Pescar', 'Acciones y Verbos'),
  ('Conducir', 'Acciones y Verbos'),
  ('Saltar a la comba', 'Acciones y Verbos'),
  ('Hacer la croqueta', 'Acciones y Verbos'),
  ('Lavarse los dientes', 'Acciones y Verbos'),
  ('Hacerse un selfie', 'Acciones y Verbos'),
  ('Tender la ropa', 'Acciones y Verbos'),

  -- Objetos cotidianos
  ('Paraguas', 'Objetos cotidianos'),
  ('Tostadora', 'Objetos cotidianos'),
  ('Cepillo de dientes', 'Objetos cotidianos'),
  ('Mando a distancia', 'Objetos cotidianos'),
  ('Cargador del móvil', 'Objetos cotidianos'),
  ('Llaves', 'Objetos cotidianos'),
  ('Tijeras', 'Objetos cotidianos'),
  ('Sacacorchos', 'Objetos cotidianos'),
  ('Calcetín', 'Objetos cotidianos'),
  ('Almohada', 'Objetos cotidianos'),
  ('Microondas', 'Objetos cotidianos'),
  ('Grapadora', 'Objetos cotidianos'),
  ('Espejo', 'Objetos cotidianos'),
  ('Bombilla', 'Objetos cotidianos'),
  ('Secador de pelo', 'Objetos cotidianos'),
  ('Percha', 'Objetos cotidianos'),
  ('Fregona', 'Objetos cotidianos'),
  ('Despertador', 'Objetos cotidianos'),

  -- Personajes Famosos
  ('Rafa Nadal', 'Personajes Famosos'),
  ('Leo Messi', 'Personajes Famosos'),
  ('Shakira', 'Personajes Famosos'),
  ('Albert Einstein', 'Personajes Famosos'),
  ('Cristóbal Colón', 'Personajes Famosos'),
  ('Michael Jackson', 'Personajes Famosos'),
  ('Rosalía', 'Personajes Famosos'),
  ('Pablo Picasso', 'Personajes Famosos'),
  ('Cleopatra', 'Personajes Famosos'),
  ('Napoleón', 'Personajes Famosos'),
  ('Lola Flores', 'Personajes Famosos'),
  ('Cristiano Ronaldo', 'Personajes Famosos'),
  ('Frida Kahlo', 'Personajes Famosos'),
  ('Elvis Presley', 'Personajes Famosos'),
  ('Miguel de Cervantes', 'Personajes Famosos'),
  ('Leonardo da Vinci', 'Personajes Famosos'),
  ('Julio Iglesias', 'Personajes Famosos'),
  ('Fernando Alonso', 'Personajes Famosos'),

  -- Comida y Bebida
  ('Paella', 'Comida y Bebida'),
  ('Tortilla de patatas', 'Comida y Bebida'),
  ('Gazpacho', 'Comida y Bebida'),
  ('Churros con chocolate', 'Comida y Bebida'),
  ('Pizza', 'Comida y Bebida'),
  ('Sushi', 'Comida y Bebida'),
  ('Croquetas', 'Comida y Bebida'),
  ('Jamón serrano', 'Comida y Bebida'),
  ('Sangría', 'Comida y Bebida'),
  ('Horchata', 'Comida y Bebida'),
  ('Pulpo a la gallega', 'Comida y Bebida'),
  ('Calimocho', 'Comida y Bebida'),
  ('Fabada', 'Comida y Bebida'),
  ('Hamburguesa', 'Comida y Bebida'),
  ('Palomitas', 'Comida y Bebida'),
  ('Salmorejo', 'Comida y Bebida'),
  ('Turrón', 'Comida y Bebida'),
  ('Cerveza', 'Comida y Bebida'),

  -- Lugares
  ('Torre Eiffel', 'Lugares'),
  ('Sagrada Familia', 'Lugares'),
  ('La Alhambra', 'Lugares'),
  ('Playa', 'Lugares'),
  ('Aeropuerto', 'Lugares'),
  ('Hospital', 'Lugares'),
  ('Biblioteca', 'Lugares'),
  ('Gimnasio', 'Lugares'),
  ('Discoteca', 'Lugares'),
  ('Cementerio', 'Lugares'),
  ('Desierto del Sáhara', 'Lugares'),
  ('Pirámides de Egipto', 'Lugares'),
  ('Nueva York', 'Lugares'),
  ('Estatua de la Libertad', 'Lugares'),
  ('Supermercado', 'Lugares'),
  ('Zoológico', 'Lugares'),
  ('Parque de atracciones', 'Lugares'),
  ('Polo Norte', 'Lugares'),

  -- Profesiones
  ('Bombero', 'Profesiones'),
  ('Astronauta', 'Profesiones'),
  ('Dentista', 'Profesiones'),
  ('Fontanero', 'Profesiones'),
  ('Peluquero', 'Profesiones'),
  ('Panadero', 'Profesiones'),
  ('Policía', 'Profesiones'),
  ('Payaso', 'Profesiones'),
  ('Piloto de avión', 'Profesiones'),
  ('Socorrista', 'Profesiones'),
  ('Cartero', 'Profesiones'),
  ('Camarero', 'Profesiones'),
  ('Veterinario', 'Profesiones'),
  ('Torero', 'Profesiones'),
  ('Electricista', 'Profesiones'),
  ('Mago', 'Profesiones'),
  ('Detective', 'Profesiones'),
  ('Jardinero', 'Profesiones')
on conflict (word) do nothing;

-- Comprobación rápida (opcional):
-- select category, count(*) from public.words group by category order by category;
