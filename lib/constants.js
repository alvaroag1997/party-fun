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
  { name: 'Disney', emoji: '🏰' },
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
    hex: '#ef4444',
    btnBorder: 'border-red-700',
    borderSoft: 'border-red-500/50',
    accentTop: 'border-t-red-500',
    glow: 'rgba(239,68,68,0.32)',
    cardGlow: 'shadow-[0_0_45px_-12px_rgba(239,68,68,0.75)]',
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
    hex: '#3b82f6',
    btnBorder: 'border-blue-700',
    borderSoft: 'border-blue-500/50',
    accentTop: 'border-t-blue-500',
    glow: 'rgba(59,130,246,0.32)',
    cardGlow: 'shadow-[0_0_45px_-12px_rgba(59,130,246,0.75)]',
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
    hex: '#facc15',
    btnBorder: 'border-yellow-600',
    borderSoft: 'border-yellow-400/50',
    accentTop: 'border-t-yellow-400',
    glow: 'rgba(250,204,21,0.24)',
    cardGlow: 'shadow-[0_0_45px_-12px_rgba(250,204,21,0.7)]',
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
    hex: '#10b981',
    btnBorder: 'border-emerald-700',
    borderSoft: 'border-emerald-500/50',
    accentTop: 'border-t-emerald-500',
    glow: 'rgba(16,185,129,0.30)',
    cardGlow: 'shadow-[0_0_45px_-12px_rgba(16,185,129,0.75)]',
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
