'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Braces,
  Check,
  ChevronRight,
  Crown,
  Database,
  Layers,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Smartphone,
  Timer,
  Trophy,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  CATEGORIES,
  CATEGORY_NAMES,
  POOL_SIZE,
  ROUNDS,
  TEAM_COLORS,
  TIME_OPTIONS,
  WORD_OPTIONS,
} from '@/lib/constants';
import { sfx, unlockAudio, vibrate } from '@/lib/sounds';

const SETTINGS_KEY = 'partyfun:settings:v1';
const GAME_KEY = 'partyfun:game:v1';
const TAP_GUARD_MS = 280; // evita dobles toques accidentales

const DEFAULT_SETTINGS = {
  teams: ['Equipo 1', 'Equipo 2'],
  categories: [...CATEGORY_NAMES],
  wordsPerGame: 40,
  turnSeconds: 45,
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

const teamTotal = (scores) => scores.reduce((a, b) => a + b, 0);
const color = (i) => TEAM_COLORS[i % TEAM_COLORS.length];

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
  const [game, setGame] = useState(null);
  const [savedGame, setSavedGame] = useState(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showImport, setShowImport] = useState(false);

  // Estado del turno en curso (no se persiste)
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [turnLog, setTurnLog] = useState([]); // [{word, action:'hit'|'pass'}]
  const [undoStack, setUndoStack] = useState([]); // [{queue, scoreDelta}]
  const [endReason, setEndReason] = useState('time');

  const endAtRef = useRef(0);
  const pausedLeftRef = useRef(0);
  const lastSecondRef = useRef(null);
  const lastTapRef = useRef(0);
  const wakeLockRef = useRef(null);

  /* ---------- Carga inicial ---------- */
  useEffect(() => {
    const s = readStorage(SETTINGS_KEY);
    if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
    const g = readStorage(GAME_KEY);
    if (g && g.phase && g.phase !== 'podium') setSavedGame(g);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) writeStorage(SETTINGS_KEY, settings);
  }, [settings, mounted]);

  // Persistimos la partida para sobrevivir a recargas o al bloqueo del móvil
  useEffect(() => {
    if (!mounted) return;
    if (game) writeStorage(GAME_KEY, game);
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

  // Mantener la pantalla encendida durante toda la partida
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

  const setTeamName = (i, name) =>
    setSettings((s) => ({ ...s, teams: s.teams.map((t, j) => (j === i ? name : t)) }));

  const addTeam = () =>
    setSettings((s) =>
      s.teams.length >= 4 ? s : { ...s, teams: [...s.teams, `Equipo ${s.teams.length + 1}`] }
    );

  const removeTeam = () =>
    setSettings((s) => (s.teams.length <= 2 ? s : { ...s, teams: s.teams.slice(0, -1) }));

  const toggleCategory = (c) =>
    setSettings((s) => ({
      ...s,
      categories: s.categories.includes(c)
        ? s.categories.filter((x) => x !== c)
        : [...s.categories, c],
    }));

  const availableWords = settings.categories.reduce((sum, c) => sum + (counts[c] || 0), 0);

  /* ---------- Empezar partida (única petición de red) ---------- */
  const startGame = async () => {
    setError('');
    setNotice('');
    unlockAudio();
    if (!supabase) {
      setError('Supabase no está configurado. Revisa las variables de entorno.');
      return;
    }
    if (settings.categories.length === 0) {
      setError('Elige al menos una categoría.');
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
        setError(`Solo hay ${pool.length} palabras en esas categorías. Añade más o marca otros temas.`);
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
          // Plan B si no existe la función RPC: actualizar fila a fila
          const byId = Object.fromEntries(pool.map((w) => [w.id, w.times_played || 0]));
          return Promise.all(
            ids.map((id) =>
              supabase.from('words').update({ times_played: byId[id] + 1 }).eq('id', id)
            )
          );
        })
        .catch(() => {});

      const teams = settings.teams.map((t, i) => t.trim() || `Equipo ${i + 1}`);
      setGame({
        teams,
        deck: chosen,
        queue: shuffle(chosen),
        round: 0,
        teamIdx: 0,
        scores: teams.map(() => [0, 0, 0]),
        turnSeconds: settings.turnSeconds,
        phase: 'ready',
      });
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
    // Un turno interrumpido se reanuda desde la pantalla de "pasa el móvil"
    const phase = savedGame.phase === 'turn' ? 'ready' : savedGame.phase;
    setGame({ ...savedGame, phase });
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
    const ms = game.turnSeconds * 1000;
    endAtRef.current = Date.now() + ms;
    lastSecondRef.current = game.turnSeconds;
    setRemaining(game.turnSeconds);
    setPaused(false);
    setTurnLog([]);
    setUndoStack([]);
    setEndReason('time');
    setGame((g) => ({ ...g, phase: 'turn' }));
    sfx.start();
  };

  const endTurn = useCallback((reason) => {
    setEndReason(reason);
    if (reason === 'time') sfx.horn();
    else sfx.fanfare();
    setGame((g) => (g ? { ...g, phase: 'turnEnd' } : g));
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

  const togglePause = () => {
    if (paused) {
      endAtRef.current = Date.now() + pausedLeftRef.current;
      setPaused(false);
    } else {
      pausedLeftRef.current = Math.max(0, endAtRef.current - Date.now());
      setPaused(true);
    }
  };

  const guardTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_GUARD_MS) return false;
    lastTapRef.current = now;
    return true;
  };

  const handleHit = () => {
    if (!game || game.phase !== 'turn' || paused || !game.queue.length) return;
    if (!guardTap()) return;
    const [current, ...rest] = game.queue;
    setUndoStack((u) => [...u, { queue: game.queue, scoreDelta: 1 }]);
    setTurnLog((l) => [...l, { word: current.word, action: 'hit' }]);
    setGame((g) => {
      const scores = g.scores.map((s, i) =>
        i === g.teamIdx ? s.map((v, r) => (r === g.round ? v + 1 : v)) : s
      );
      return { ...g, queue: rest, scores };
    });
    sfx.correct();
    if (rest.length === 0) endTurn('roundComplete');
  };

  const handlePass = () => {
    if (!game || game.phase !== 'turn' || paused || !game.queue.length) return;
    if (!guardTap()) return;
    const [current, ...rest] = game.queue;
    setUndoStack((u) => [...u, { queue: game.queue, scoreDelta: 0 }]);
    setTurnLog((l) => [...l, { word: current.word, action: 'pass' }]);
    setGame((g) => ({ ...g, queue: [...rest, current] }));
    sfx.pass();
  };

  const handleUndo = () => {
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setTurnLog((l) => l.slice(0, -1));
    setGame((g) => {
      const scores = g.scores.map((s, i) =>
        i === g.teamIdx ? s.map((v, r) => (r === g.round ? v - last.scoreDelta : v)) : s
      );
      return { ...g, queue: last.queue, scores };
    });
    sfx.undo();
    vibrate(30);
  };

  // Tras el resumen del turno: siguiente equipo, fin de ronda o podio
  const continueAfterTurn = () => {
    unlockAudio();
    setGame((g) => {
      const nextTeam = (g.teamIdx + 1) % g.teams.length;
      if (g.queue.length === 0) {
        return { ...g, teamIdx: nextTeam, phase: g.round >= 2 ? 'podium' : 'roundEnd' };
      }
      return { ...g, teamIdx: nextTeam, phase: 'ready' };
    });
    setUndoStack([]);
    setTurnLog([]);
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

  if (!game) {
    return (
      <>
        <SetupScreen
          settings={settings}
          counts={counts}
          countsLoading={countsLoading}
          availableWords={availableWords}
          loadingDeck={loadingDeck}
          error={error}
          notice={notice}
          savedGame={savedGame}
          onResume={resumeGame}
          onDiscard={discardSavedGame}
          onTeamName={setTeamName}
          onAddTeam={addTeam}
          onRemoveTeam={removeTeam}
          onToggleCategory={toggleCategory}
          onAll={() => updateSettings({ categories: [...CATEGORY_NAMES] })}
          onNone={() => updateSettings({ categories: [] })}
          onWords={(v) => updateSettings({ wordsPerGame: v })}
          onTime={(v) => updateSettings({ turnSeconds: v })}
          onStart={startGame}
          onOpenImport={() => setShowImport(true)}
          onCountsChanged={loadCounts}
        />
        {showImport && (
          <ImportModal
            onClose={() => setShowImport(false)}
            onImported={loadCounts}
          />
        )}
      </>
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
          turnLog={turnLog}
          canUndo={undoStack.length > 0}
          onHit={handleHit}
          onPass={handlePass}
          onUndo={handleUndo}
          onPause={togglePause}
        />
      );
    case 'turnEnd':
      return (
        <TurnEndScreen
          game={game}
          turnLog={turnLog}
          reason={endReason}
          canUndo={undoStack.length > 0}
          onUndo={handleUndo}
          onContinue={continueAfterTurn}
        />
      );
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
    loadingDeck,
    error,
    notice,
    savedGame,
    onResume,
    onDiscard,
    onTeamName,
    onAddTeam,
    onRemoveTeam,
    onToggleCategory,
    onAll,
    onNone,
    onWords,
    onTime,
    onStart,
    onOpenImport,
    onCountsChanged,
  } = props;

  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

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

  return (
    <main className="h-dvh-safe flex flex-col bg-zinc-950 text-zinc-50">
      <div className="scroll-area flex-1 px-4 pt-safe pb-4">
        <header className="flex items-center justify-between py-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Party <span className="text-amber-400">Fun</span>
            </h1>
            <p className="text-sm text-zinc-400">3 rondas · 1 móvil · muchas risas</p>
          </div>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 active:bg-zinc-900"
          >
            <Braces size={14} /> Añadir palabras (JSON)
          </button>
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
              Ronda {savedGame.round + 1}/3 · {savedGame.teams.join(' vs ')}
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

        {/* Equipos */}
        <Section icon={<Users size={18} />} title="Equipos">
          <div className="space-y-2">
            {settings.teams.map((t, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl ${color(i).soft} px-3 py-1`}
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${color(i).bg}`} />
                <input
                  value={t}
                  maxLength={20}
                  onChange={(e) => onTeamName(i, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-transparent py-2 text-lg font-semibold outline-none placeholder:text-zinc-600"
                  placeholder={`Equipo ${i + 1}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-zinc-400">{settings.teams.length} equipos (2–4)</span>
            <div className="flex gap-2">
              <IconBtn onClick={onRemoveTeam} disabled={settings.teams.length <= 2} label="Quitar equipo">
                <Minus size={18} />
              </IconBtn>
              <IconBtn onClick={onAddTeam} disabled={settings.teams.length >= 4} label="Añadir equipo">
                <Plus size={18} />
              </IconBtn>
            </div>
          </div>
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
            {CATEGORIES.map(({ name, emoji }) => {
              const on = settings.categories.includes(name);
              const n = counts[name];
              return (
                <button
                  key={name}
                  onClick={() => onToggleCategory(name)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition active:scale-95 ${
                    on
                      ? 'border-amber-400 bg-amber-400/10 text-zinc-50'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  <span className={`text-xl ${on ? '' : 'grayscale opacity-60'}`}>{emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
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
          onClick={onStart}
          disabled={loadingDeck || !isSupabaseConfigured || settings.categories.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-xl font-black text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.97] disabled:opacity-40"
        >
          {loadingDeck ? (
            <>
              <Loader2 className="animate-spin" /> Preparando mazo…
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
/* Pantalla "Pasa el móvil" / inicio de turno                              */
/* ----------------------------------------------------------------------- */

function ReadyScreen({ game, onStart, onQuit, notice }) {
  const r = ROUNDS[game.round];
  const c = color(game.teamIdx);
  const isFirstOfRound = game.queue.length === game.deck.length;

  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe">
      <TopBar game={game} onQuit={onQuit} />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {isFirstOfRound && (
          <div className="mb-8 w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-5 animate-pop">
            <p className="text-5xl">{r.emoji}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-400">
              Ronda {game.round + 1}/3
            </p>
            <h2 className="text-2xl font-black">{r.title}</h2>
            <p className="mt-2 text-sm text-zinc-300">{r.rule}</p>
          </div>
        )}

        <Smartphone className="mb-3 text-zinc-500" size={36} />
        <p className="text-lg text-zinc-400">Pasa el móvil a</p>
        <p className={`mt-1 text-5xl font-black ${c.text}`}>{game.teams[game.teamIdx]}</p>
        {!isFirstOfRound && (
          <p className="mt-4 rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-zinc-300">
            {r.emoji} {r.title}
          </p>
        )}
        <p className="mt-4 text-zinc-400">
          Quedan <span className="font-bold text-zinc-100">{game.queue.length}</span> /{' '}
          {game.deck.length} palabras
        </p>
        {notice && <p className="mt-3 text-xs text-amber-300">{notice}</p>}
      </div>

      <MiniScore game={game} />

      <button
        onClick={onStart}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl ${c.bg} py-5 text-2xl font-black text-zinc-950 transition active:scale-[0.97]`}
      >
        <Play fill="currentColor" /> ¡Empezar turno! ({game.turnSeconds}s)
      </button>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Pantalla de turno                                                       */
/* ----------------------------------------------------------------------- */

function TurnScreen({ game, remaining, paused, turnLog, canUndo, onHit, onPass, onUndo, onPause }) {
  const current = game.queue[0];
  const c = color(game.teamIdx);
  const hits = turnLog.filter((l) => l.action === 'hit').length;
  const danger = remaining <= 5;
  const pct = Math.max(0, Math.min(100, (remaining / game.turnSeconds) * 100));

  return (
    <main
      className={`no-select h-dvh-safe flex flex-col px-4 pt-safe pb-safe ${
        danger && !paused ? 'animate-pulseRed' : 'bg-zinc-950'
      }`}
    >
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo || paused}
          className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 active:bg-zinc-800 disabled:opacity-30"
        >
          <Undo2 size={14} /> Deshacer último
        </button>
        <div className="text-center leading-tight">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Ronda {game.round + 1}/3
          </p>
          <p className="text-xs text-zinc-400">
            {game.queue.length} / {game.deck.length}
          </p>
        </div>
        <button
          onClick={onPause}
          className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 active:bg-zinc-800"
          aria-label={paused ? 'Reanudar' : 'Pausar'}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Seguir' : 'Pausa'}
        </button>
      </div>

      {/* Reloj */}
      <div className="mt-3 flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-zinc-950 ${c.bg}`}>
          {game.teams[game.teamIdx]}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${
              danger ? 'bg-red-500' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`w-14 text-right font-mono text-3xl font-black tabular-nums ${
            danger ? 'text-red-400' : 'text-zinc-50'
          }`}
        >
          {remaining}
        </span>
      </div>

      {/* Palabra */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-2 text-center">
        {paused ? (
          <div className="flex flex-col items-center gap-4">
            <Pause size={56} className="text-zinc-500" />
            <p className="text-2xl font-bold">En pausa</p>
            <button
              onClick={onPause}
              className="rounded-2xl bg-amber-400 px-8 py-3 text-lg font-black text-zinc-950 active:scale-95"
            >
              Reanudar
            </button>
          </div>
        ) : current ? (
          <div key={`${current.id}-${turnLog.length}`} className="animate-pop">
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
/* Resumen del turno                                                       */
/* ----------------------------------------------------------------------- */

function TurnEndScreen({ game, turnLog, reason, canUndo, onUndo, onContinue }) {
  const c = color(game.teamIdx);
  const hits = turnLog.filter((l) => l.action === 'hit');
  const passes = turnLog.filter((l) => l.action === 'pass').length;
  const roundDone = game.queue.length === 0;
  const nextIdx = (game.teamIdx + 1) % game.teams.length;
  const nc = color(nextIdx);

  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe">
      <div className="pt-4 text-center">
        <p className="text-5xl">{roundDone ? '🎉' : '⏰'}</p>
        <h2 className="mt-2 text-3xl font-black">
          {roundDone ? '¡Ronda completada!' : reason === 'time' ? '¡Tiempo!' : 'Fin del turno'}
        </h2>
        <p className={`mt-1 text-lg font-bold ${c.text}`}>
          {game.teams[game.teamIdx]}: +{hits.length} {hits.length === 1 ? 'punto' : 'puntos'}
        </p>
        <p className="text-sm text-zinc-400">
          {passes} {passes === 1 ? 'pasada' : 'pasadas'} · quedan {game.queue.length} / {game.deck.length}
        </p>
      </div>

      <div className="scroll-area mt-4 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        {hits.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">Ningún acierto este turno 😅</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {hits.map((h, i) => (
              <li key={i} className="rounded-full bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-300">
                ✓ {h.word}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canUndo && (
        <button
          onClick={onUndo}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 active:bg-zinc-800"
        >
          <Undo2 size={16} /> Deshacer último ({turnLog[turnLog.length - 1]?.action === 'hit' ? 'acierto' : 'pasar'})
        </button>
      )}

      <button
        onClick={onContinue}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-xl font-black text-zinc-950 transition active:scale-[0.97] ${
          roundDone ? 'bg-amber-400' : nc.bg
        }`}
      >
        {roundDone ? (
          <>
            {game.round >= 2 ? 'Ver podio final' : 'Ver marcador'} <ChevronRight />
          </>
        ) : (
          <>
            <Smartphone /> Pasa el móvil a {game.teams[nextIdx]}
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
            Mismas {game.deck.length} palabras, barajadas otra vez. Empieza{' '}
            <span className={`font-bold ${color(game.teamIdx).text}`}>{game.teams[game.teamIdx]}</span>.
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
/* Podio final                                                             */
/* ----------------------------------------------------------------------- */

function PodiumScreen({ game, onNewGame }) {
  const ranking = game.teams
    .map((name, i) => ({ name, i, total: teamTotal(game.scores[i]) }))
    .sort((a, b) => b.total - a.total);
  const topScore = ranking[0]?.total ?? 0;
  const winners = ranking.filter((r) => r.total === topScore);
  const podiumOrder = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const heights = { 0: 'h-36', 1: 'h-24', 2: 'h-16' };

  return (
    <main className="no-select h-dvh-safe flex flex-col bg-zinc-950 px-5 pt-safe pb-safe">
      <div className="scroll-area flex-1">
        <div className="pt-4 text-center">
          <Trophy className="mx-auto text-amber-400" size={48} />
          <h2 className="mt-2 text-3xl font-black">
            {winners.length > 1 ? '¡Empate!' : `¡Gana ${winners[0].name}!`}
          </h2>
          <p className="text-zinc-400">Clasificación total de las 3 rondas</p>
        </div>

        <div className="mt-6 flex items-end justify-center gap-3">
          {podiumOrder.map((t) => {
            const pos = ranking.indexOf(t);
            const rank = ranking.findIndex((r) => r.total === t.total);
            return (
              <div key={t.i} className="flex w-1/3 flex-col items-center animate-pop">
                {rank === 0 && <Crown className="mb-1 text-amber-400" size={28} />}
                <p className={`max-w-full truncate text-center text-sm font-bold ${color(t.i).text}`}>{t.name}</p>
                <p className="text-2xl font-black">{t.total}</p>
                <div
                  className={`mt-1 flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl font-black text-zinc-950 ${
                    heights[pos]
                  } ${color(t.i).bg}`}
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
/* Importador JSON                                                         */
/* ----------------------------------------------------------------------- */

const EXAMPLE_JSON = `[
  {"word": "Koala", "category": "Animales"},
  {"word": "Titanic", "category": "Películas y Series"},
  {"word": "Hacer la siesta", "category": "Acciones y Verbos"}
]`;

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const CATEGORY_LOOKUP = Object.fromEntries(CATEGORY_NAMES.map((c) => [normalize(c), c]));

function ImportModal({ onClose, onImported }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ok, msg}

  const save = async () => {
    setResult(null);
    if (!supabase) {
      setResult({ ok: false, msg: 'Supabase no está configurado.' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setResult({ ok: false, msg: `JSON no válido: ${e.message}` });
      return;
    }
    if (!Array.isArray(parsed)) {
      setResult({ ok: false, msg: 'El JSON debe ser un array: [{"word": "...", "category": "..."}]' });
      return;
    }

    const seen = new Set();
    const rows = [];
    const badCategories = new Set();
    let invalid = 0;
    let repeated = 0;

    for (const item of parsed) {
      const word = typeof item?.word === 'string' ? item.word.trim().replace(/\s+/g, ' ') : '';
      const rawCat = typeof item?.category === 'string' ? item.category : '';
      const category = CATEGORY_LOOKUP[normalize(rawCat)];
      if (!word || word.length > 60) {
        invalid++;
        continue;
      }
      if (!category) {
        invalid++;
        if (rawCat) badCategories.add(rawCat);
        continue;
      }
      if (seen.has(word)) {
        repeated++;
        continue;
      }
      seen.add(word);
      rows.push({ word, category });
    }

    if (!rows.length) {
      setResult({
        ok: false,
        msg:
          'No hay palabras válidas para importar.' +
          (badCategories.size ? ` Categorías no reconocidas: ${[...badCategories].join(', ')}` : ''),
      });
      return;
    }

    setBusy(true);
    let inserted = 0;
    try {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { data, error } = await supabase
          .from('words')
          .upsert(rows.slice(i, i + CHUNK), { onConflict: 'word', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;
        inserted += data?.length || 0;
      }
      const existing = rows.length - inserted;
      const parts = [`✅ ${inserted} palabras nuevas insertadas`];
      if (existing) parts.push(`${existing} ya existían`);
      if (repeated) parts.push(`${repeated} repetidas en el JSON`);
      if (invalid) parts.push(`${invalid} inválidas`);
      let msg = parts.join(' · ');
      if (badCategories.size) msg += `. Categorías no reconocidas: ${[...badCategories].join(', ')}`;
      setResult({ ok: true, msg });
      onImported();
    } catch (e) {
      setResult({
        ok: false,
        msg: `Error al guardar (${inserted} insertadas antes del fallo): ${e.message || e}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 pb-safe sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black">
            <Braces size={20} className="text-amber-400" /> Añadir palabras (JSON)
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-400 active:bg-zinc-800" aria-label="Cerrar">
            <X />
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Formato: <code className="text-zinc-300">[{'{'}&quot;word&quot;: &quot;...&quot;, &quot;category&quot;: &quot;...&quot;{'}'}]</code>.
          Categorías válidas: {CATEGORY_NAMES.join(', ')}. Los duplicados se ignoran.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE_JSON}
          spellCheck={false}
          className="mt-3 min-h-[40dvh] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 outline-none focus:border-amber-400"
        />
        {result && (
          <p className={`mt-3 rounded-xl p-3 text-sm ${result.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
            {result.msg}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setText(EXAMPLE_JSON)}
            className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 active:bg-zinc-800"
          >
            Ejemplo
          </button>
          <button
            onClick={save}
            disabled={busy || !text.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 font-black text-zinc-950 active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
            {busy ? 'Guardando…' : 'Guardar en Supabase'}
          </button>
        </div>
      </div>
    </div>
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

function IconBtn({ onClick, disabled, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 active:bg-zinc-700 disabled:opacity-30"
    >
      {children}
    </button>
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
      {game.teams.map((t, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${color(i).soft} ${
            i === game.teamIdx ? `ring-2 ${color(i).ring}` : ''
          }`}
        >
          <span className={`font-semibold ${color(i).text}`}>{t}</span>
          <span className="font-black tabular-nums">{teamTotal(game.scores[i])}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreTable({ game, upToRound, sorted = false }) {
  let rows = game.teams.map((name, i) => ({ name, i, scores: game.scores[i] }));
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
          {rows.map(({ name, i, scores }) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className={`max-w-[9rem] truncate px-3 py-3 font-bold ${color(i).text}`}>{name}</td>
              {roundIdx.map((r) => (
                <td key={r} className="px-2 py-3 text-center tabular-nums text-zinc-300">
                  {scores[r]}
                </td>
              ))}
              <td className="px-3 py-3 text-right text-xl font-black tabular-nums">
                {roundIdx.reduce((sum, r) => sum + scores[r], 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
