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

export const TEAM_COLORS = [
  { text: 'text-sky-300', bg: 'bg-sky-500', ring: 'ring-sky-400', soft: 'bg-sky-500/15' },
  { text: 'text-pink-300', bg: 'bg-pink-500', ring: 'ring-pink-400', soft: 'bg-pink-500/15' },
  { text: 'text-lime-300', bg: 'bg-lime-500', ring: 'ring-lime-400', soft: 'bg-lime-500/15' },
  { text: 'text-violet-300', bg: 'bg-violet-500', ring: 'ring-violet-400', soft: 'bg-violet-500/15' },
];

export const WORD_OPTIONS = [30, 40, 50];
export const TIME_OPTIONS = [30, 45, 60];
export const POOL_SIZE = 150;
