import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Plus, Moon, SunMedium, Clock, Trash } from "lucide-react";

/*
  DailyFlow - single-file React app (suitable for Vite + Tailwind + vite-plugin-pwa)
  Features:
   - To-do list (add, complete, delete) with localStorage
   - Habit tracker (daily toggle, streaks)
   - Quick notes
   - Pomodoro timer with presets
   - Simple settings (dark mode)
   - Install prompt wiring (uses beforeinstallprompt and virtual:pwa-register for SW)
*/

const STORAGE_KEY = "dailyflow_v1";

// --- Helpers ---
const saveState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- Pomodoro Hook ---
function usePomodoro(initial = { work: 25, short: 5, long: 15, cycles: 4 }) {
  const [settings, setSettings] = useState(initial);
  const [mode, setMode] = useState("work");
  const [secondsLeft, setSecondsLeft] = useState(settings.work * 60);
  const [running, setRunning] = useState(false);
  const cyclesDoneRef = useRef(0);

  useEffect(() => setSecondsLeft((settings.work || 25) * 60), [settings.work]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (mode === "work") {
            cyclesDoneRef.current += 1;
            const next = cyclesDoneRef.current % settings.cycles === 0 ? "long" : "short";
            setMode(next);
            setSecondsLeft(((next === "long" ? settings.long : settings.short) || 5) * 60);
          } else {
            setMode("work");
            setSecondsLeft((settings.work || 25) * 60);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, mode, settings]);

  return {
    settings,
    setSettings,
    mode,
    secondsLeft,
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false);
      cyclesDoneRef.current = 0;
      setMode("work");
      setSecondsLeft((settings.work || 25) * 60);
    },
    setPreset: (k) => {
      setMode(k);
      setSecondsLeft((settings[k] || settings.work) * 60);
      setRunning(false);
    },
  };
}

// --- Main App ---
export default function App() {
  const persisted = loadState();
  const [dark, setDark] = useState(persisted?.dark ?? false);
  const [todos, setTodos] = useState(persisted?.todos ?? []);
  const [habits, setHabits] = useState(persisted?.habits ?? []);
  const [notes, setNotes] = useState(persisted?.notes ?? "");
  const [query, setQuery] = useState("");
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const { settings, mode, secondsLeft, running, start, pause, reset, setPreset } =
    usePomodoro(persisted?.pomodoro ?? undefined);

  useEffect(() => {
    saveState({ dark, todos, habits, notes, pomodoro: settings });
  }, [dark, todos, habits, notes, settings]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const addTodo = (text) => {
    if (!text?.trim()) return;
    setTodos((s) => [{ id: uid(), text: text.trim(), done: false, created: Date.now() }, ...s]);
  };
  const toggleTodo = (id) => setTodos((s) => s.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const delTodo = (id) => setTodos((s) => s.filter((t) => t.id !== id));

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    setHabits((hs) =>
      hs.map((h) => ({
        ...h,
        toggledToday: h.lastSeen === todayKey ? h.toggledToday : false,
      }))
    );
  }, []);

  const addHabit = (title) =>
    title?.trim() &&
    setHabits((s) => [...s, { id: uid(), title: title.trim(), toggledToday: false, streak: 0, lastSeen: null }]);

  const toggleHabit = (id) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    setHabits((s) =>
      s.map((h) =>
        h.id === id
          ? {
              ...h,
              toggledToday: !(h.lastSeen === todayKey && h.toggledToday),
              streak:
                !(h.lastSeen === todayKey && h.toggledToday) && h.lastSeen === todayKey
                  ? h.streak
                  : !(h.lastSeen === todayKey && h.toggledToday)
                  ? h.streak + 1
                  : h.streak,
              lastSeen: todayKey,
            }
          : h
      )
    );
  };

  const deleteHabit = (id) => setHabits((s) => s.filter((h) => h.id !== id));
  const saveNotes = (t) => setNotes(t);

  const filtered = todos.filter((t) => t.text.toLowerCase().includes(query.toLowerCase()));
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Header */}
        <header className="lg:col-span-3 md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold flex flex-wrap items-center gap-2">
              <motion.span
                initial={{ rotate: -10, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500"
              >
                DailyFlow
              </motion.span>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">— daily habits & focus</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Lightweight PWA: todo, habits, notes, pomodoro.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm"
              title="Toggle theme"
            >
              {dark ? <SunMedium className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {installPromptEvent && (
              <button onClick={() => installPromptEvent.prompt()} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white">
                Install
              </button>
            )}
          </div>
        </header>

        {/* Todos */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
          <h2 className="font-semibold text-lg">Todos</h2>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              className="flex-1 p-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent"
              placeholder="Add a todo and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addTodo(e.target.value);
                  e.target.value = "";
                }
              }}
            />
            <button
              className="p-2 rounded-lg bg-indigo-600 text-white"
              onClick={() => {
                const el = document.querySelector("input[placeholder='Add a todo and press Enter']");
                if (el?.value.trim()) {
                  addTodo(el.value);
                  el.value = "";
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3 max-h-64 sm:max-h-80 overflow-auto pr-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500">No todos yet.</p>
            ) : (
              filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/40 p-2 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={() => toggleTodo(t.id)}>
                      <CheckCircle className={`w-5 h-5 ${t.done ? "text-green-500" : "text-gray-400"}`} />
                    </button>
                    <div>
                      <div className={`${t.done ? "line-through text-gray-400" : ""}`}>{t.text}</div>
                      <div className="text-xs text-gray-500">{new Date(t.created).toLocaleString()}</div>
                    </div>
                  </div>
                  <button onClick={() => delTodo(t.id)} className="p-1 rounded-md hover:bg-red-50">
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
            <span>{todos.filter((t) => !t.done).length} remaining</span>
            <input
              placeholder="Search todos..."
              className="p-1 rounded bg-gray-50 dark:bg-gray-700/50"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Habits & Notes */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
          <h2 className="font-semibold text-lg">Habits</h2>
          <div className="mt-3 space-y-3">
            <AddHabit onAdd={addHabit} />
            <div className="grid gap-2">
              {habits.length === 0 ? (
                <p className="text-sm text-gray-500">No habits yet.</p>
              ) : (
                habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => toggleHabit(h.id)}
                        className={`p-2 rounded-full ${h.toggledToday ? "bg-green-100" : "bg-gray-100 dark:bg-gray-600"}`}
                      >
                        <CheckCircle
                          className={`w-5 h-5 ${h.toggledToday ? "text-green-600" : "text-gray-400"}`}
                        />
                      </button>
                      <div>
                        <div>{h.title}</div>
                        <div className="text-xs text-gray-500">Streak: {h.streak || 0}</div>
                      </div>
                    </div>
                    <button onClick={() => deleteHabit(h.id)} className="p-1 rounded-md hover:bg-red-50">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <hr className="my-4 border-gray-200 dark:border-gray-700" />
          <h3 className="font-semibold mb-2">Quick Notes</h3>
          <textarea
            className="w-full min-h-[100px] sm:min-h-[120px] p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-700/40"
            placeholder="Write notes..."
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
          />
        </section>

        {/* Pomodoro */}
        <aside className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Pomodoro</h2>
            <Clock className="w-5 h-5 text-gray-500" />
          </div>
          <div className="mt-4 text-center">
            <div className="text-3xl sm:text-4xl font-bold">{formatTime(secondsLeft)}</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Mode: {mode}</div>
            <div className="mt-4 flex gap-2 justify-center">
              {!running ? (
                <button onClick={start} className="px-3 py-1.5 sm:py-2 rounded-lg bg-green-600 text-white text-sm">
                  Start
                </button>
              ) : (
                <button onClick={pause} className="px-3 py-1.5 sm:py-2 rounded-lg bg-yellow-500 text-white text-sm">
                  Pause
                </button>
              )}
              <button
                onClick={reset}
                className="px-3 py-1.5 sm:py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm"
              >
                Reset
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <button onClick={() => setPreset("work")} className="py-1 rounded bg-indigo-600 text-white">
                Work
              </button>
              <button onClick={() => setPreset("short")} className="py-1 rounded bg-indigo-500 text-white">
                Short
              </button>
              <button onClick={() => setPreset("long")} className="py-1 rounded bg-indigo-400 text-white">
                Long
              </button>
            </div>
          </div>
        </aside>

        {/* Footer */}
        <div className="lg:col-span-3 md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl text-xs sm:text-sm">
          <span className="text-gray-600">Offline-ready PWA — install for daily use.</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (confirm("Clear all data?")) {
                  setTodos([]);
                  setHabits([]);
                  setNotes("");
                  localStorage.removeItem(STORAGE_KEY);
                }
              }}
              className="px-3 py-1.5 rounded bg-red-50 text-red-600"
            >
              Clear Data
            </button>
            <ExportButton todos={todos} habits={habits} notes={notes} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Subcomponents ---
function AddHabit({ onAdd }) {
  return (
    <div className="flex gap-2">
      <input
        placeholder="Add habit..."
        className="flex-1 p-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(e.target.value);
            e.target.value = "";
          }
        }}
      />
      <button
        onClick={() => {
          const el = document.querySelector("input[placeholder='Add habit...']");
          if (el?.value.trim()) {
            onAdd(el.value);
            el.value = "";
          }
        }}
        className="px-3 py-2 rounded bg-indigo-600 text-white text-sm"
      >
        Add
      </button>
    </div>
  );
}

function ExportButton({ todos, habits, notes }) {
  const exportJSON = () => {
    const data = { todos, habits, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dailyflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={exportJSON} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">
      Export
    </button>
  );
}
