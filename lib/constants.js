export const CATEGORIES = [
  { name: 'Animales', emoji: '🐘' },
  { name: 'Películas y Series', emoji: '🎬' },
  { name: 'Videojuegos', emoji: '🎮' },
  { name: 'Deportes', emoji: '⚽' },
  { name: 'Acciones y Verbos', emoji: '🏃' },
  { name: 'Objetos cotidianos', emoji: '🔑' },
  { name: 'Personajes Famosos', emoji: '⭐' },
  { name: 'Comida y Bebida', emoji: '🍕' },
  { name: 'Lugares', emoji: '🗺️' },
  { name: 'Profesiones', emoji: '👩‍🚒' },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

export const ROUNDS = [
  {
    title: 'Descripción libre',
    rule: 'Describe la palabra como quieras, sin decirla ni usar palabras de la misma familia.',
    emoji: '🗣️',
  },
  {
    title: 'Una sola palabra',
    rule: 'Solo puedes decir UNA palabra. Sin gestos, sin sonidos. ¡Tira de memoria!',
    emoji: '☝️',
  },
  {
    title: 'Mímica',
    rule: 'Prohibido hablar. Solo gestos y mímica (los sonidos tampoco valen).',
    emoji: '🤫',
  },
];

// Equipos fijos por color (en orden de aparición)
export const TEAMS = [
  {
    name: 'Equipo Rojo',
    color: 'Rojo',
    text: 'text-red-400',
    bg: 'bg-red-500',
    onBg: 'text-white',
    border: 'border-red-500',
    soft: 'bg-red-500/15',
    ring: 'ring-red-500',
    dot: 'bg-red-500',
  },
  {
    name: 'Equipo Azul',
    color: 'Azul',
    text: 'text-blue-400',
    bg: 'bg-blue-500',
    onBg: 'text-white',
    border: 'border-blue-500',
    soft: 'bg-blue-500/15',
    ring: 'ring-blue-500',
    dot: 'bg-blue-500',
  },
  {
    name: 'Equipo Amarillo',
    color: 'Amarillo',
    text: 'text-yellow-300',
    bg: 'bg-yellow-400',
    onBg: 'text-zinc-950',
    border: 'border-yellow-400',
    soft: 'bg-yellow-400/15',
    ring: 'ring-yellow-400',
    dot: 'bg-yellow-400',
  },
  {
    name: 'Equipo Verde',
    color: 'Verde',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    onBg: 'text-zinc-950',
    border: 'border-emerald-500',
    soft: 'bg-emerald-500/15',
    ring: 'ring-emerald-500',
    dot: 'bg-emerald-500',
  },
];

export const TEAM_COUNT_OPTIONS = [2, 3, 4];
export const MIN_PLAYERS_PER_TEAM = 2;
export const PASS_PENALTY_SECONDS = 5;

export const WORD_OPTIONS = [30, 40, 50];
export const TIME_OPTIONS = [30, 45, 60];
export const POOL_SIZE = 150;
