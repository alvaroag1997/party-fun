'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Database,
  Flame,
  Layers,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  SkipForward,
  Smartphone,
  Star,
  Timer,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  CATEGORIES,
  CATEGORY_NAMES,
  MIN_PLAYERS_PER_TEAM,
  PASS_PENALTY_SECONDS,
  POOL_SIZE,
  ROUNDS,
  TEAMS,
  TEAM_COUNT_OPTIONS,
  TIME_OPTIONS,
  WORD_OPTIONS,
} from '@/lib/constants';
import { sfx, unlockAudio } from '@/lib/sounds';

const SETTINGS_KEY = 'partyfun:settings:v2';
const GAME_KEY = 'partyfun:game:v2';
const TAP_GUARD_MS = 280; // evita dobles toques accidentales

const DEFAULT_SETTINGS = {
  players: [],
  teamCount: 2,
  categories: [...CATEGORY_NAMES],
  wordsPerGame: 40,
  turnSeconds: 45,
  knownCategories: [...CATEGORY_NAMES],
};

/* ----------------------------------------------------------------------- */
/* Utilidades                                                              */
/* ----------------------------------------------------------------------- */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* almacenamiento no disponible */
  }
}

// Reparto aleatorio y equilibrado (las diferencias de tamaño son como mucho de 1)
function dealTeams(players, teamCount) {
  const teams = Array.from({ length: teamCount }, () => []);
  shuffle(players).forEach((p, i) => teams[i % teamCount].push(p));
  return shuffle(teams);
}

const teamTotal = (scores) => scores.reduce((a, b) => a + b, 0);
const team = (i) => TEAMS[i % TEAMS.length];
const playerOf = (g, teamIdx = g.teamIdx) => {
  const t = g.teams[teamIdx];
  return t.players[t.nextPlayer % t.players.length];
};

function wordSizeClass(word) {
  const len = word.length;
  const longest = Math.max(...word.split(' ').map((w) => w.length));
  if (len > 22 || longest > 12) return 'text-4xl';
  if (len > 14 || longest > 9) return 'text-5xl';
  return 'text-6xl';
}

/* ----------------------------------------------------------------------- */
/* Componente principal                                                    */
/* ----------------------------------------------------------------------- */

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [draftTeams, setDraftTeams] = useState(null); // pantalla de sorteo
  const [game, setGame] = useState(null);
  const [savedGame, setSavedGame] = useState(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Estado del turno en curso (no se persiste)
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [penaltyKey, setPenaltyKey] = useState(0);

  const endAtRef = useRef(0);
  const pausedLeftRef = useRef(0);
  const lastSecondRef = useRef(null);
  const lastTapRef = useRef(0);
  const turnEndedRef = useRef(true);
  const wakeLockRef = useRef(null);

  /* ---------- Carga inicial ---------- */
  useEffect(() => {
    const s = readStorage(SETTINGS_KEY);
    if (s) {
      // Las categorías nuevas (que el móvil aún no conocía) aparecen marcadas por defecto
      const known = s.knownCategories || CATEGORY_NAMES.filter((c) => c !== 'Disney');
      const added = CATEGORY_NAMES.filter((c) => !known.includes(c));
      const categories = [...(s.categories || []), ...added].filter((c) => CATEGORY_NAMES.includes(c));
      setSettings({ ...DEFAULT_SETTINGS, ...s, categories, knownCategories: [...CATEGORY_NAMES] });
    }
    const g = readStorage(GAME_KEY);
    if (g && g.phase && g.phase !== 'podium') setSavedGame(g);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) writeStorage(SETTINGS_KEY, settings);
  }, [settings, mounted]);

  // Persistimos la partida para sobrevivir a recargas o al bloqueo del móvil
  useEffect(() => {
    if (mounted && game) writeStorage(GAME_KEY, game);
  }, [game, mounted]);

  const loadCounts = useCallback(async () => {
    if (!supabase) return;
    setCountsLoading(true);
    try {
      const results = await Promise.all(
        CATEGORY_NAMES.map((c) =>
          supabase.from('words').select('id', { count: 'exact', head: true }).eq('category', c)
        )
      );
      const next = {};
      CATEGORY_NAMES.forEach((c, i) => {
        next[c] = results[i].error ? null : results[i].count ?? 0;
      });
      setCounts(next);
    } catch (_) {
      /* sin conexión: se muestran guiones */
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) loadCounts();
  }, [mounted, loadCounts]);

  /* ---------- Wake Lock ---------- */
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (_) {
      /* no soportado o denegado */
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch (_) {
      /* ignore */
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (game && game.phase !== 'podium') requestWakeLock();
    else releaseWakeLock();
  }, [game, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (game && game.phase !== 'podium') requestWakeLock();
      } else if (game?.phase === 'turn' && !paused) {
        // Si la app pasa a segundo plano en mitad de un turno, se pausa sola
        pausedLeftRef.current = Math.max(0, endAtRef.current - Date.now());
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [game, paused, requestWakeLock]);

  /* ---------- Ajustes ---------- */
  const updateSettings = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const addPlayer = (raw) => {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!name) return false;
    let added = false;
    setSettings((s) => {
      if (s.players.some((p) => p.toLowerCase() === name.toLowerCase())) return s;
      added = true;
      return { ...s, players: [...s.players, name] };
    });
    return added;
  };

  const removePlayer = (name) =>
    setSettings((s) => ({ ...s, players: s.players.filter((p) => p !== name) }));

  const toggleCategory = (c) =>
    setSettings((s) => ({
      ...s,
      categories: s.categories.includes(c)
        ? s.categories.filter((x) => x !== c)
        : [...s.categories, c],
    }));

  const availableWords = settings.categories.reduce((sum, c) => sum + (counts[c] || 0), 0);
  const minPlayers = settings.teamCount * MIN_PLAYERS_PER_TEAM;

  /* ---------- Sorteo de equipos ---------- */
  const generateTeams = () => {
    setError('');
    unlockAudio();
    if (settings.players.length < minPlayers) {
      setError(`Necesitáis al menos ${minPlayers} jugadores para ${settings.teamCount} equipos.`);
      return;
    }
    if (settings.categories.length === 0) {
      setError('Elige al menos una categoría.');
      return;
    }
    setDraftTeams(dealTeams(settings.players, settings.teamCount));
  };

  const reshuffle = () => {
    setDraftTeams(dealTeams(settings.players, settings.teamCount));
    sfx.pass();
  };

  const movePlayer = (fromTeam, name) => {
    setDraftTeams((teams) => {
      const to = (fromTeam + 1) % teams.length;
      return teams.map((t, i) => {
        if (i === fromTeam) return t.filter((p) => p !== name);
        if (i === to) return [...t, name];
        return t;
      });
    });
  };

  /* ---------- Empezar partida (única petición de red) ---------- */
  const startGame = async () => {
    setError('');
    setNotice('');
    unlockAudio();
    if (!supabase) {
      setError('Supabase no está configurado. Revisa las variables de entorno.');
      return;
    }
    if (!draftTeams || draftTeams.some((t) => t.length === 0)) {
      setError('Todos los equipos necesitan al menos un jugador.');
      return;
    }
    setLoadingDeck(true);
    try {
      const n = settings.wordsPerGame;
      const { data, error: qErr } = await supabase
        .from('words')
        .select('id, word, category, times_played')
        .in('category', settings.categories)
        .order('times_played', { ascending: true })
        .limit(Math.max(POOL_SIZE, n * 3));

      if (qErr) throw qErr;
      const pool = data || [];
      if (pool.length < 5) {
        setError(`Solo hay ${pool.length} palabras en esas categorías. Marca otros temas.`);
        return;
      }

      // Prioriza las menos jugadas: toma el pool ordenado y elige al azar
      const chosen = shuffle(pool)
        .slice(0, n)
        .map(({ id, word, category }) => ({ id, word, category }));

      if (chosen.length < n) {
        setNotice(`Solo había ${chosen.length} palabras disponibles: la partida será con ${chosen.length}.`);
      }

      // Marca como jugadas (no bloquea el inicio del juego)
      const ids = chosen.map((w) => w.id);
      supabase
        .rpc('increment_times_played', { word_ids: ids })
        .then(({ error: rpcErr }) => {
          if (!rpcErr) return;
          const byId = Object.fromEntries(pool.map((w) => [w.id, w.times_played || 0]));
          return Promise.all(
            ids.map((id) =>
              supabase.from('words').update({ times_played: byId[id] + 1 }).eq('id', id)
            )
          );
        })
        .catch(() => {});

      const teams = draftTeams.map((players) => ({ players: [...players], nextPlayer: 0 }));
      setGame({
        teams,
        deck: chosen,
        queue: shuffle(chosen),
        round: 0,
        teamIdx: 0,
        scores: teams.map(() => [0, 0, 0]),
        playerStats: {},
        passCounts: {},
        turn: null,
        turnSeconds: settings.turnSeconds,
        phase: 'ready',
      });
      setDraftTeams(null);
      setSavedGame(null);
      sfx.start();
    } catch (e) {
      setError(`No se pudieron cargar las palabras: ${e.message || e}`);
    } finally {
      setLoadingDeck(false);
    }
  };

  const resumeGame = () => {
    if (!savedGame) return;
    unlockAudio();
    // Un turno interrumpido pasa directamente a su revisión
    if (savedGame.phase === 'turn') {
      setGame({ ...savedGame, phase: 'turnEnd', turn: { ...savedGame.turn, reason: 'interrupted' } });
    } else {
      setGame(savedGame);
    }
    setSavedGame(null);
  };

  const discardSavedGame = () => {
    writeStorage(GAME_KEY, null);
    setSavedGame(null);
  };

  const quitGame = () => {
    if (!window.confirm('¿Abandonar la partida actual?')) return;
    writeStorage(GAME_KEY, null);
    setNotice('');
    releaseWakeLock();
    setGame(null);
    loadCounts();
  };

  const newGame = () => {
    writeStorage(GAME_KEY, null);
    setNotice('');
    setGame(null);
    loadCounts();
  };

  /* ---------- Turno ---------- */
  const startTurn = () => {
    unlockAudio();
    requestWakeLock();
    endAtRef.current = Date.now() + game.turnSeconds * 1000;
    lastSecondRef.current = game.turnSeconds;
    turnEndedRef.current = false;
    setRemaining(game.turnSeconds);
    setPaused(false);
    setPenaltyKey(0);
    setGame((g) => ({
      ...g,
      phase: 'turn',
      turn: { player: playerOf(g), hits: [], passes: 0, reason: null },
    }));
    sfx.start();
  };

  const endTurn = useCallback((reason) => {
    if (turnEndedRef.current) return;
    turnEndedRef.current = true;
    if (reason === 'time') sfx.horn();
    else sfx.fanfare();
    setGame((g) =>
      g && g.phase === 'turn' ? { ...g, phase: 'turnEnd', turn: { ...g.turn, reason } } : g
    );
  }, []);

  // Reloj: se basa en timestamps (preciso aunque el móvil vaya lento)
  useEffect(() => {
    if (!game || game.phase !== 'turn' || paused) return;
    const id = setInterval(() => {
      const leftMs = endAtRef.current - Date.now();
      const secs = Math.max(0, Math.ceil(leftMs / 1000));
      if (secs !== lastSecondRef.current) {
        lastSecondRef.current = secs;
        setRemaining(secs);
        if (secs > 0 && secs <= 5) sfx.tick(secs === 1);
      }
      if (leftMs <= 0) {
        clearInterval(id);
        endTurn('time');
      }
    }, 100);
    return () => clearInterval(id);
  }, [game, paused, endTurn]);

  const resume = () => {
    endAtRef.current = Date.now() + pausedLeftRef.current;
    setPaused(false);
  };

  const guardTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_GUARD_MS) return false;
    lastTapRef.current = now;
    return true;
  };

  const canAct = () =>
    game && game.phase === 'turn' && !paused && !turnEndedRef.current && game.queue.length > 0;

  const handleHit = () => {
    if (!canAct() || !guardTap()) return;
    const [current, ...rest] = game.queue;
    const player = game.turn.player;
    const scores = game.scores.map((s, i) =>
      i === game.teamIdx ? s.map((v, r) => (r === game.round ? v + 1 : v)) : s
    );
    const next = {
      ...game,
      queue: rest,
      scores,
      playerStats: { ...game.playerStats, [player]: (game.playerStats[player] || 0) + 1 },
      turn: { ...game.turn, hits: [...game.turn.hits, { ...current, kept: true }] },
    };
    sfx.correct();
    if (rest.length === 0) {
      // Última palabra del mazo: fin de turno y a revisión
      turnEndedRef.current = true;
      sfx.fanfare();
      setGame({ ...next, phase: 'turnEnd', turn: { ...next.turn, reason: 'roundComplete' } });
    } else {
      setGame(next);
    }
  };

  const handlePass = () => {
    if (!canAct() || !guardTap()) return;
    const [current, ...rest] = game.queue;
    let next = {
      ...game,
      queue: [...rest, current],
      passCounts: { ...game.passCounts, [current.id]: (game.passCounts[current.id] || 0) + 1 },
      turn: { ...game.turn, passes: game.turn.passes + 1 },
    };

    if (game.round === 0) {
      // Ronda 1: pasar cuesta 5 segundos
      endAtRef.current -= PASS_PENALTY_SECONDS * 1000;
      const leftMs = endAtRef.current - Date.now();
      setPenaltyKey((k) => k + 1);
      sfx.penalty();
      if (leftMs <= 0) {
        turnEndedRef.current = true;
        lastSecondRef.current = 0;
        setRemaining(0);
        sfx.horn();
        next = { ...next, phase: 'turnEnd', turn: { ...next.turn, reason: 'time' } };
      } else {
        const secs = Math.ceil(leftMs / 1000);
        lastSecondRef.current = secs;
        setRemaining(secs);
      }
    } else {
      sfx.pass();
    }
    setGame(next);
  };

  /* ---------- Revisión del turno ---------- */
  const toggleReview = (index) =>
    setGame((g) => ({
      ...g,
      turn: {
        ...g.turn,
        hits: g.turn.hits.map((h, i) => (i === index ? { ...h, kept: !h.kept } : h)),
      },
    }));

  const confirmReview = () => {
    unlockAudio();
    setGame((g) => {
      const removed = g.turn.hits.filter((h) => !h.kept);
      const queue = [...g.queue];
      removed.forEach(({ kept, ...word }) => {
        queue.splice(Math.floor(Math.random() * (queue.length + 1)), 0, word);
      });
      const player = g.turn.player;
      const scores = g.scores.map((s, i) =>
        i === g.teamIdx ? s.map((v, r) => (r === g.round ? v - removed.length : v)) : s
      );
      const playerStats = {
        ...g.playerStats,
        [player]: (g.playerStats[player] || 0) - removed.length,
      };
      // El equipo que acaba de jugar pasa al siguiente integrante para su próximo turno
      const teams = g.teams.map((t, i) =>
        i === g.teamIdx ? { ...t, nextPlayer: (t.nextPlayer + 1) % t.players.length } : t
      );
      const base = {
        ...g,
        queue,
        scores,
        playerStats,
        teams,
        teamIdx: (g.teamIdx + 1) % g.teams.length,
        turn: null,
      };
      if (queue.length === 0) return { ...base, phase: g.round >= 2 ? 'podium' : 'roundEnd' };
      return { ...base, phase: 'ready' };
    });
  };

  useEffect(() => {
    if (game?.phase === 'podium') {
      sfx.fanfare();
      writeStorage(GAME_KEY, null);
    }
  }, [game?.phase]);

  const startNextRound = () => {
    unlockAudio();
    setGame((g) => ({ ...g, round: g.round + 1, queue: shuffle(g.deck), phase: 'ready' }));
  };

  /* ---------- Render ---------- */
  if (!mounted) {
    return <div className="h-dvh-safe bg-zinc-950" />;
  }

  if (!game && draftTeams) {
    return (
      <TeamsPreviewScreen
        teams={draftTeams}
        loading={loadingDeck}
        error={error}
        onBack={() => {
          setDraftTeams(null);
          setError('');
        }}
        onReshuffle={reshuffle}
        onMove={movePlayer}
        onStart={startGame}
      />
    );
  }

  if (!game) {
    return (
      <SetupScreen
        settings={settings}
        counts={counts}
        countsLoading={countsLoading}
        availableWords={availableWords}
        minPlayers={minPlayers}
        error={error}
        notice={notice}
        savedGame={savedGame}
        onResume={resumeGame}
        onDiscard={discardSavedGame}
        onAddPlayer={addPlayer}
        onRemovePlayer={removePlayer}
        onClearPlayers={() => updateSettings({ players: [] })}
        onTeamCount={(v) => updateSettings({ teamCount: v })}
        onToggleCategory={toggleCategory}
        onAll={() => updateSettings({ categories: [...CATEGORY_NAMES] })}
        onNone={() => updateSettings({ categories: [] })}
        onWords={(v) => updateSettings({ wordsPerGame: v })}
        onTime={(v) => updateSettings({ turnSeconds: v })}
        onGenerate={generateTeams}
        onCountsChanged={loadCounts}
      />
    );
  }

  switch (game.phase) {
    case 'ready':
      return <ReadyScreen game={game} onStart={startTurn} onQuit={quitGame} notice={notice} />;
    case 'turn':
      return (
        <TurnScreen
          game={game}
          remaining={remaining}
          paused={paused}
          penaltyKey={penaltyKey}
          onHit={handleHit}
          onPass={handlePass}
          onResume={resume}
        />
      );
    case 'turnEnd':
      return <ReviewScreen game={game} onToggle={toggleReview} onContinue={confirmReview} />;
    case 'roundEnd':
      return <RoundEndScreen game={game} onNext={startNextRound} onQuit={quitGame} />;
    case 'podium':
      return <PodiumScreen game={game} onNewGame={newGame} />;
    default:
      return null;
  }
}

/* ----------------------------------------------------------------------- */
/* Pantalla de configuración                                               */
/* ----------------------------------------------------------------------- */

function SetupScreen(props) {
  const {
    settings,
    counts,
    countsLoading,
    availableWords,
    minPlayers,
    error,
    notice,
    savedGame,
    onResume,
    onDiscard,
    onAddPlayer,
    onRemovePlayer,
    onClearPlayers,
    onTeamCount,
    onToggleCategory,
    onAll,
    onNone,
    onWords,
    onTime,
    onGenerate,
    onCountsChanged,
  } = props;

  const [name, setName] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const inputRef = useRef(null);

  const submitPlayer = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddPlayer(name);
    setName('');
    inputRef.current?.focus();
  };

  const resetCounters = async () => {
    if (!supabase) return;
    if (!window.confirm('¿Poner a 0 el contador de veces jugadas de TODAS las palabras?')) return;
    setResetting(true);
    setResetMsg('');
    try {
      let { error } = await supabase.rpc('reset_times_played');
      if (error) {
        ({ error } = await supabase.from('words').update({ times_played: 0 }).gt('times_played', 0));
      }
      setResetMsg(error ? `Error: ${error.message}` : 'Contadores reseteados ✔');
      onCountsChanged();
    } catch (e) {
      setResetMsg(`Error: ${e.message || e}`);
    } finally {
      setResetting(false);
    }
  };

  const enoughPlayers = settings.players.length >= minPlayers;

  return (
    <main className="h-dvh-safe flex flex-col bg-zinc-950 text-zinc-50">
      <div className="scroll-area flex-1 px-4 pt-safe pb-4">
        <header className="py-3">
          <h1 className="text-3xl font-black tracking-tight">
            Party <span className="text-amber-400">Fun</span>
          </h1>
          <p className="text-sm text-zinc-400">3 rondas · 1 móvil · muchas risas</p>
        </header>

        {!isSupabaseConfigured && (
          <Banner tone="red">
            Faltan <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            Configúralas en Vercel (o en <code>.env.local</code>) y vuelve a desplegar.
          </Banner>
        )}

        {savedGame && (
          <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-semibold text-amber-300">Hay una partida a medias</p>
            <p className="text-sm text-zinc-300">
              Ronda {savedGame.round + 1}/3 ·{' '}
              {savedGame.teams.map((_, i) => team(i).color).join(' vs ')}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onResume}
                className="flex-1 rounded-xl bg-amber-400 py-2.5 font-bold text-zinc-950 active:scale-95"
              >
                Continuar
              </button>
              <button
                onClick={onDiscard}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 active:bg-zinc-800"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Participantes */}
        <Section
          icon={<UserPlus size={18} />}
          title={`Participantes (${settings.players.length})`}
          right={
            settings.players.length > 0 && (
              <button
                onClick={() => window.confirm('¿Borrar todos los participantes?') && onClearPlayers()}
                className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 active:bg-zinc-700"
              >
                Borrar todos
              </button>
            )
          }
        >
          <form onSubmit={submitPlayer} className="flex gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="enter"
              placeholder="Nombre y pulsa Enter"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-lg outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              aria-label="Añadir participante"
              className="flex w-12 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 active:scale-95"
            >
              <Plus />
            </button>
          </form>
          {settings.players.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {settings.players.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-1 rounded-full bg-zinc-800 py-1 pl-3 pr-1 text-sm font-semibold"
                >
                  {p}
                  <button
                    onClick={() => onRemovePlayer(p)}
                    aria-label={`Quitar a ${p}`}
                    className="rounded-full p-1 text-zinc-400 active:bg-zinc-700"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Añade a todos los que vais a jugar. Se guardan para la próxima vez.
            </p>
          )}
        </Section>

        {/* Equipos */}
        <Section icon={<Users size={18} />} title="Número de equipos">
          <div className="grid grid-cols-3 gap-2">
            {TEAM_COUNT_OPTIONS.map((n) => {
              const on = settings.teamCount === n;
              return (
                <button
                  key={n}
                  onClick={() => onTeamCount(n)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition active:scale-95 ${
                    on ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-800 bg-zinc-900'
                  }`}
                >
                  <span className={`text-2xl font-black ${on ? 'text-zinc-50' : 'text-zinc-500'}`}>{n}</span>
                  <span className="flex gap-1">
                    {TEAMS.slice(0, n).map((t) => (
                      <span key={t.name} className={`h-3 w-3 rounded-full ${t.dot}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={`mt-2 text-sm ${enoughPlayers ? 'text-zinc-400' : 'text-amber-300'}`}>
            {TEAMS.slice(0, settings.teamCount)
              .map((t) => t.color)
              .join(', ')}{' '}
            · mínimo {minPlayers} jugadores
            {!enoughPlayers && ` (faltan ${minPlayers - settings.players.length})`}
          </p>
        </Section>

        {/* Temas */}
        <Section
          icon={<Layers size={18} />}
          title="Temas"
          right={
            <div className="flex gap-1.5 text-xs">
              <button onClick={onAll} className="rounded-full bg-zinc-800 px-3 py-1 active:bg-zinc-700">
                Todas
              </button>
              <button onClick={onNone} className="rounded-full bg-zinc-800 px-3 py-1 active:bg-zinc-700">
                Ninguna
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(({ name: cat, emoji }) => {
              const on = settings.categories.includes(cat);
              const n = counts[cat];
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition active:scale-95 ${
                    on
                      ? 'border-amber-400 bg-amber-400/10 text-zinc-50'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  <span className={`text-xl ${on ? '' : 'grayscale opacity-60'}`}>{emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight">{cat}</span>
                    <span className="block text-xs text-zinc-400">
                      {countsLoading && n === undefined ? '…' : n == null ? '—' : `${n} palabras`}
                    </span>
                  </span>
                  {on && <Check size={16} className="shrink-0 text-amber-400" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-right text-xs text-zinc-400">
            {availableWords} palabras disponibles en los temas marcados
          </p>
        </Section>

        {/* Ajustes rápidos */}
        <Section icon={<Timer size={18} />} title="Ajustes rápidos">
          <p className="mb-1.5 text-sm text-zinc-400">Palabras por partida</p>
          <Segmented options={WORD_OPTIONS} value={settings.wordsPerGame} onChange={onWords} />
          <p className="mb-1.5 mt-4 text-sm text-zinc-400">Tiempo por turno</p>
          <Segmented
            options={TIME_OPTIONS}
            value={settings.turnSeconds}
            onChange={onTime}
            format={(v) => `${v}s`}
          />
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <button
              onClick={resetCounters}
              disabled={resetting || !isSupabaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 py-2.5 text-sm text-zinc-400 active:bg-zinc-900 disabled:opacity-40"
            >
              {resetting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
              Resetear contadores de partidas en BBDD
            </button>
            {resetMsg && <p className="mt-2 text-center text-xs text-zinc-400">{resetMsg}</p>}
          </div>
        </Section>

        {error && <Banner tone="red">{error}</Banner>}
        {notice && <Banner tone="amber">{notice}</Banner>}
      </div>

      <div className="border-t border-zinc-900 bg-zinc-950 px-4 pt-3 pb-safe">
        <button
          onClick={onGenerate}
          disabled={!isSupabaseConfigured || !enoughPlayers || settings.categories.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-xl font-black text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.97] disabled:opacity-40"
        >
          <Shuffle /> Generar Equipos
        </button>
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Pantalla de sorteo de equipos                                           */
/* ----------------------------------------------------------------------- */

function TeamsPreviewScreen({ teams, loading, error, onBack, onReshuffle, onMove, onStart }) {
  const hasEmpty = teams.some((t) => t.length === 0);
  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-4 pt-safe pb-safe">
      <div className="flex items-center justify-between py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-zinc-400 active:bg-zinc-900"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
        <span className="text-xs text-zinc-500">Toca un jugador para cambiarlo de equipo</span>
      </div>

      <h2 className="mt-1 text-center text-3xl font-black">¡Equipos listos!</h2>

      <div className="scroll-area mt-4 flex-1 space-y-3">
        {teams.map((players, i) => {
          const t = team(i);
          return (
            <div key={t.name} className={`rounded-2xl border-2 ${t.border} ${t.soft} p-3 animate-pop`}>
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-sm font-black ${t.bg} ${t.onBg}`}>
                  {t.name}
                </span>
                <span className="text-xs text-zinc-400">{players.length} jugadores</span>
              </div>
              {players.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">Sin jugadores todavía</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <button
                      key={p}
                      onClick={() => onMove(i, p)}
                      className="rounded-full bg-zinc-950/70 px-3 py-1.5 text-base font-semibold active:scale-95"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3">
          <Banner tone="red">{error}</Banner>
        </div>
      )}

      <div className="mt-3 grid grid-cols-5 gap-2">
        <button
          onClick={onReshuffle}
          disabled={loading}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-700 py-4 text-base font-bold text-zinc-200 active:bg-zinc-900 disabled:opacity-40"
        >
          <Shuffle size={18} /> Volver a mezclar
        </button>
        <button
          onClick={onStart}
          disabled={loading || hasEmpty}
          className="col-span-3 flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-lg font-black text-zinc-950 active:scale-[0.97] disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Preparando…
            </>
          ) : (
            <>
              Empezar partida <ChevronRight />
            </>
          )}
        </button>
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Pantalla "Le toca a…" antes de cada turno                               */
/* ----------------------------------------------------------------------- */

function ReadyScreen({ game, onStart, onQuit, notice }) {
  const r = ROUNDS[game.round];
  const t = team(game.teamIdx);
  const player = playerOf(game);
  const isFirstOfRound = game.queue.length === game.deck.length;

  return (
    <main className={`no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe`}>
      <TopBar game={game} onQuit={onQuit} />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {isFirstOfRound && (
          <div className="mb-6 w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-4 animate-pop">
            <p className="text-4xl">{r.emoji}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-400">
              Ronda {game.round + 1}/3
            </p>
            <h2 className="text-2xl font-black">{r.title}</h2>
            <p className="mt-1 text-sm text-zinc-300">{r.rule}</p>
            {game.round === 0 && (
              <p className="mt-2 text-xs font-semibold text-red-300">
                ⚠️ Pasar palabra resta {PASS_PENALTY_SECONDS} segundos
              </p>
            )}
          </div>
        )}

        <div className={`w-full rounded-3xl border-2 ${t.border} ${t.soft} px-4 py-6 animate-pop`}>
          <span className={`rounded-full px-4 py-1.5 text-sm font-black ${t.bg} ${t.onBg}`}>
            Turno del {t.name}
          </span>
          <p className="mt-5 text-lg text-zinc-300">Le toca a:</p>
          <p className="mt-1 break-words text-5xl font-black leading-tight text-white">{player}</p>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-zinc-400">
            <Smartphone size={16} /> Pásale el móvil
          </p>
        </div>

        {!isFirstOfRound && (
          <p className="mt-4 rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-zinc-300">
            {r.emoji} {r.title}
          </p>
        )}
        <p className="mt-3 text-zinc-400">
          Quedan <span className="font-bold text-zinc-100">{game.queue.length}</span> /{' '}
          {game.deck.length} palabras
        </p>
        {notice && <p className="mt-2 text-xs text-amber-300">{notice}</p>}
      </div>

      <MiniScore game={game} />

      <button
        onClick={onStart}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl ${t.bg} ${t.onBg} py-5 text-2xl font-black transition active:scale-[0.97]`}
      >
        <Play fill="currentColor" /> ¡Estoy listo! Empezar turno
      </button>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Pantalla de turno                                                       */
/* ----------------------------------------------------------------------- */

function TurnScreen({ game, remaining, paused, penaltyKey, onHit, onPass, onResume }) {
  const current = game.queue[0];
  const t = team(game.teamIdx);
  const hits = game.turn?.hits.length || 0;
  const danger = remaining <= 5;
  const pct = Math.max(0, Math.min(100, (remaining / game.turnSeconds) * 100));
  const penaltyRound = game.round === 0;

  return (
    <main
      className={`no-select h-dvh-safe flex flex-col px-4 pt-safe pb-safe ${
        danger && !paused ? 'animate-pulseRed' : 'bg-zinc-950'
      }`}
    >
      {/* Cabecera: equipo + jugador activo */}
      <div className={`flex items-center gap-3 rounded-2xl border-2 ${t.border} ${t.soft} px-3 py-2`}>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${t.bg} ${t.onBg}`}>
          {t.color}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] uppercase tracking-wider text-zinc-400">Le toca a</p>
          <p className="truncate text-lg font-black">{game.turn?.player}</p>
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Ronda {game.round + 1}/3
          </p>
          <p className="text-xs text-zinc-400">
            {game.queue.length} / {game.deck.length}
          </p>
        </div>
      </div>

      {/* Reloj */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${
              danger ? 'bg-red-500' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="relative w-16 text-right">
          <span
            key={`t-${penaltyKey}`}
            className={`inline-block font-mono text-3xl font-black tabular-nums ${
              danger ? 'text-red-400' : 'text-zinc-50'
            } ${penaltyKey > 0 ? 'animate-shake' : ''}`}
          >
            {remaining}
          </span>
          {penaltyKey > 0 && (
            <span
              key={`p-${penaltyKey}`}
              className="pointer-events-none absolute -top-1 right-0 text-xl font-black text-red-500 animate-floatUp"
            >
              -{PASS_PENALTY_SECONDS}s
            </span>
          )}
        </div>
      </div>

      {/* Palabra */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-2 text-center">
        {paused ? (
          <div className="flex flex-col items-center gap-4">
            <Pause size={56} className="text-zinc-500" />
            <p className="text-2xl font-bold">En pausa</p>
            <p className="text-sm text-zinc-400">La app se pausó al salir de la pantalla</p>
            <button
              onClick={onResume}
              className="rounded-2xl bg-amber-400 px-8 py-3 text-lg font-black text-zinc-950 active:scale-95"
            >
              Reanudar
            </button>
          </div>
        ) : current ? (
          <div key={`${current.id}-${hits}-${game.turn?.passes}`} className="animate-pop">
            <p className="mb-3 text-sm uppercase tracking-widest text-zinc-500">{current.category}</p>
            <p
              className={`${wordSizeClass(current.word)} break-words font-black leading-tight text-white [hyphens:auto]`}
              lang="es"
            >
              {current.word}
            </p>
            <p className="mt-6 text-sm text-zinc-500">{ROUNDS[game.round].title}</p>
          </div>
        ) : null}
        {hits > 0 && !paused && (
          <span className="absolute right-0 top-2 rounded-full bg-green-500/15 px-3 py-1 text-sm font-bold text-green-400">
            +{hits}
          </span>
        )}
      </div>

      {/* Botones */}
      <div className="grid h-[30dvh] min-h-[180px] grid-cols-5 gap-3">
        <button
          onClick={onPass}
          disabled={paused}
          className="col-span-2 flex flex-col items-center justify-center gap-1 rounded-3xl bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-40"
        >
          <SkipForward size={40} strokeWidth={2.5} />
          <span className="text-xl font-black">Pasar</span>
          {penaltyRound && <span className="text-xs font-bold text-red-900">-{PASS_PENALTY_SECONDS}s</span>}
        </button>
        <button
          onClick={onHit}
          disabled={paused}
          className="col-span-3 flex flex-col items-center justify-center gap-1 rounded-3xl bg-green-500 text-zinc-950 shadow-lg shadow-green-500/20 transition active:scale-95 disabled:opacity-40"
        >
          <Check size={56} strokeWidth={3} />
          <span className="text-2xl font-black">¡Acierto!</span>
        </button>
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Revisión del turno                                                      */
/* ----------------------------------------------------------------------- */

function ReviewScreen({ game, onToggle, onContinue }) {
  const t = team(game.teamIdx);
  const turn = game.turn || { player: '', hits: [], passes: 0, reason: 'time' };
  const kept = turn.hits.filter((h) => h.kept).length;
  const removed = turn.hits.length - kept;
  const pending = game.queue.length + removed;
  const roundDone = pending === 0;
  const nextIdx = (game.teamIdx + 1) % game.teams.length;
  const nt = team(nextIdx);
  const nextPlayer = playerOf(game, nextIdx);

  const title =
    turn.reason === 'roundComplete'
      ? '¡Mazo terminado!'
      : turn.reason === 'interrupted'
        ? 'Turno interrumpido'
        : '¡Tiempo!';

  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe">
      <div className="pt-3 text-center">
        <p className="text-4xl">{turn.reason === 'roundComplete' ? '🎉' : '⏰'}</p>
        <h2 className="mt-1 text-3xl font-black">{title}</h2>
        <p className="mt-1 text-zinc-300">
          Resumen del turno de <span className={`font-black ${t.text}`}>{turn.player}</span>
        </p>
        <p className={`mt-1 text-lg font-bold ${t.text}`}>
          {t.name}: +{kept} {kept === 1 ? 'punto' : 'puntos'}
        </p>
        <p className="text-sm text-zinc-400">
          {turn.passes} {turn.passes === 1 ? 'pasada' : 'pasadas'} · quedan {pending} / {game.deck.length}
        </p>
      </div>

      <div className="scroll-area mt-4 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">
        {turn.hits.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">Ningún acierto este turno 😅</p>
        ) : (
          <>
            <p className="px-2 pb-2 pt-1 text-xs text-zinc-400">
              Desmarca las que se pulsaron sin querer: vuelven al mazo y se resta el punto.
            </p>
            <ul className="space-y-1.5">
              {turn.hits.map((h, i) => (
                <li key={`${h.id}-${i}`}>
                  <button
                    onClick={() => onToggle(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${
                      h.kept ? 'bg-green-500/15' : 'bg-zinc-800/60'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                        h.kept ? 'border-green-500 bg-green-500 text-zinc-950' : 'border-zinc-600'
                      }`}
                    >
                      {h.kept && <Check size={16} strokeWidth={3} />}
                    </span>
                    <span
                      className={`flex-1 font-semibold ${h.kept ? 'text-zinc-50' : 'text-zinc-500 line-through'}`}
                    >
                      {h.word}
                    </span>
                    {!h.kept && <span className="text-xs text-amber-300">vuelve al mazo</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {turn.reason === 'roundComplete' && removed > 0 && (
        <p className="mt-3 text-center text-sm text-amber-300">
          Has desmarcado {removed}: la ronda continúa con esas palabras.
        </p>
      )}

      <button
        onClick={onContinue}
        className={`mt-4 flex w-full flex-col items-center justify-center rounded-2xl py-4 transition active:scale-[0.97] ${
          roundDone ? 'bg-amber-400 text-zinc-950' : `${nt.bg} ${nt.onBg}`
        }`}
      >
        {roundDone ? (
          <span className="flex items-center gap-2 text-xl font-black">
            Confirmar · {game.round >= 2 ? 'Ver podio final' : 'Ver marcador'} <ChevronRight />
          </span>
        ) : (
          <>
            <span className="text-xl font-black">Confirmar y pasar al {nt.name}</span>
            <span className="text-sm font-semibold opacity-80">Le toca a {nextPlayer}</span>
          </>
        )}
      </button>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Fin de ronda                                                            */
/* ----------------------------------------------------------------------- */

function RoundEndScreen({ game, onNext, onQuit }) {
  const next = ROUNDS[game.round + 1];
  const t = team(game.teamIdx);
  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe">
      <TopBar game={game} onQuit={onQuit} />
      <div className="scroll-area flex-1">
        <h2 className="mt-4 text-center text-3xl font-black">Fin de la Ronda {game.round + 1}</h2>
        <p className="mb-4 text-center text-zinc-400">Marcador parcial</p>
        <ScoreTable game={game} upToRound={game.round} />

        <div className="mt-6 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5 text-center">
          <p className="text-4xl">{next.emoji}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-400">
            Siguiente: Ronda {game.round + 2}/3
          </p>
          <h3 className="text-2xl font-black">{next.title}</h3>
          <p className="mt-1 text-sm text-zinc-300">{next.rule}</p>
          <p className="mt-3 text-xs text-zinc-400">
            Mismas {game.deck.length} palabras, barajadas otra vez. Empieza el{' '}
            <span className={`font-bold ${t.text}`}>{t.name}</span> con{' '}
            <span className="font-bold text-zinc-200">{playerOf(game)}</span>.
          </p>
        </div>
      </div>
      <button
        onClick={onNext}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-5 text-xl font-black text-zinc-950 active:scale-[0.97]"
      >
        Empezar Ronda {game.round + 2} <ChevronRight />
      </button>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Podio final + curiosidades                                              */
/* ----------------------------------------------------------------------- */

function PodiumScreen({ game, onNewGame }) {
  const ranking = game.teams
    .map((_, i) => ({ i, total: teamTotal(game.scores[i]) }))
    .sort((a, b) => b.total - a.total);
  const topScore = ranking[0]?.total ?? 0;
  const winners = ranking.filter((r) => r.total === topScore);
  const podiumOrder = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const heights = { 0: 'h-36', 1: 'h-24', 2: 'h-16' };

  // MVP: jugador con más aciertos (ya descontadas las correcciones)
  const playerTeam = {};
  game.teams.forEach((tm, i) => tm.players.forEach((p) => (playerTeam[p] = i)));
  const players = Object.keys(playerTeam)
    .map((name) => ({ name, hits: game.playerStats?.[name] || 0, teamIdx: playerTeam[name] }))
    .sort((a, b) => b.hits - a.hits);
  const mvpScore = players[0]?.hits || 0;
  const mvps = mvpScore > 0 ? players.filter((p) => p.hits === mvpScore) : [];

  // Palabra maldita: la más pasada en toda la partida
  const passEntries = Object.entries(game.passCounts || {}).sort((a, b) => b[1] - a[1]);
  const cursed =
    passEntries.length > 0
      ? {
          word: game.deck.find((w) => String(w.id) === String(passEntries[0][0]))?.word,
          times: passEntries[0][1],
        }
      : null;

  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe">
      <div className="scroll-area flex-1">
        <div className="pt-4 text-center">
          <Trophy className="mx-auto text-amber-400" size={48} />
          <h2 className="mt-2 text-3xl font-black">
            {winners.length > 1 ? '¡Empate!' : `¡Gana el ${team(winners[0].i).name}!`}
          </h2>
          <p className="text-zinc-400">Clasificación total de las 3 rondas</p>
        </div>

        <div className="mt-6 flex items-end justify-center gap-3">
          {podiumOrder.map((r) => {
            const pos = ranking.indexOf(r);
            const rank = ranking.findIndex((x) => x.total === r.total);
            const t = team(r.i);
            return (
              <div key={r.i} className="flex w-1/3 flex-col items-center animate-pop">
                {rank === 0 && <Crown className="mb-1 text-amber-400" size={28} />}
                <p className={`max-w-full truncate text-center text-sm font-bold ${t.text}`}>{t.color}</p>
                <p className="text-2xl font-black">{r.total}</p>
                <div
                  className={`mt-1 flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl font-black ${t.onBg} ${heights[pos]} ${t.bg}`}
                >
                  {rank + 1}º
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <ScoreTable game={game} upToRound={2} sorted />
        </div>

        {/* Curiosidades */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Star size={14} /> MVP
            </p>
            {mvps.length ? (
              <>
                <p className="mt-1 break-words text-xl font-black leading-tight">
                  {mvps.map((p) => p.name).join(' y ')}
                </p>
                <p className="text-xs text-zinc-400">
                  {mvpScore} {mvpScore === 1 ? 'palabra acertada' : 'palabras acertadas'}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">Nadie acertó nada 🤷</p>
            )}
          </div>
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3">
            <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-red-400">
              <Flame size={14} /> Palabra maldita
            </p>
            {cursed?.word ? (
              <>
                <p className="mt-1 break-words text-xl font-black leading-tight">{cursed.word}</p>
                <p className="text-xs text-zinc-400">
                  Pasada {cursed.times} {cursed.times === 1 ? 'vez' : 'veces'}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">¡Nadie pasó ninguna!</p>
            )}
          </div>
        </div>

        {players.length > 0 && (
          <div className="mt-3 rounded-2xl border border-zinc-800 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Aciertos por jugador</p>
            <ul className="space-y-1">
              {players.map((p) => (
                <li key={p.name} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${team(p.teamIdx).dot}`} />
                  <span className="flex-1 truncate font-semibold">{p.name}</span>
                  <span className="font-black tabular-nums">{p.hits}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={onNewGame}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-5 text-xl font-black text-zinc-950 active:scale-[0.97]"
      >
        <RotateCcw /> Nueva partida
      </button>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Piezas reutilizables                                                    */
/* ----------------------------------------------------------------------- */

function Section({ icon, title, right, children }) {
  return (
    <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-zinc-200">
          <span className="text-amber-400">{icon}</span> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Segmented({ options, value, onChange, format = (v) => v }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-950 p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-lg py-2.5 text-lg font-bold transition ${
            value === o ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 active:bg-zinc-800'
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

function Banner({ tone, children }) {
  const styles =
    tone === 'red'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return (
    <div className={`mb-4 flex gap-2 rounded-2xl border p-3 text-sm ${styles}`}>
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function TopBar({ game, onQuit }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
        Ronda {game.round + 1}/3
      </span>
      <button
        onClick={onQuit}
        className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-zinc-500 active:bg-zinc-900"
      >
        <X size={14} /> Salir
      </button>
    </div>
  );
}

function MiniScore({ game }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {game.teams.map((_, i) => {
        const t = team(i);
        return (
          <div
            key={t.name}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${t.soft} ${
              i === game.teamIdx ? `ring-2 ${t.ring}` : ''
            }`}
          >
            <span className={`font-semibold ${t.text}`}>{t.color}</span>
            <span className="font-black tabular-nums">{teamTotal(game.scores[i])}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreTable({ game, upToRound, sorted = false }) {
  let rows = game.teams.map((tm, i) => ({ i, players: tm.players, scores: game.scores[i] }));
  if (sorted) rows = [...rows].sort((a, b) => teamTotal(b.scores) - teamTotal(a.scores));
  const roundIdx = [0, 1, 2].filter((r) => r <= upToRound);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <table className="w-full text-left">
        <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-semibold">Equipo</th>
            {roundIdx.map((r) => (
              <th key={r} className="px-2 py-2 text-center font-semibold">
                R{r + 1}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ i, players, scores }) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className="max-w-[10rem] px-3 py-2.5">
                <p className={`font-bold ${team(i).text}`}>{team(i).color}</p>
                <p className="truncate text-xs text-zinc-500">{players.join(', ')}</p>
              </td>
              {roundIdx.map((r) => (
                <td key={r} className="px-2 py-2.5 text-center tabular-nums text-zinc-300">
                  {scores[r]}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right text-xl font-black tabular-nums">
                {roundIdx.reduce((sum, r) => sum + scores[r], 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
