import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Plus, Moon, SunMedium, Clock, Trash } from "lucide-react";

/*
  DailyFlow - single-file React app (suitable for Vite + Tailwind + vite-plugin-pwa)
  Features:
   - To‑do list (add, complete, delete) with localStorage
   - Habit tracker (daily toggle, streaks)
   - Quick notes
   - Pomodoro timer with presets
   - Simple settings (dark mode)
   - Install prompt wiring (uses beforeinstallprompt and virtual:pwa-register for SW)

  How to use:
   1. Create a Vite React app: `npm create vite@latest dailyflow -- --template react`
   2. Install deps: `npm i framer-motion lucide-react`
   3. Install PWA plugin: `npm i -D vite-plugin-pwa`
   4. Add `virtual:pwa-register` call in src/main.jsx (see chat instructions)
   5. Drop this file as `src/App.jsx` and run `npm run dev`.

  This single file intentionally keeps styles minimal via Tailwind utility classes.
*/

const STORAGE_KEY = "dailyflow_v1";

// --- Helpers ---
const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load state", e);
    return null;
  }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- Pomodoro Timer ---
function usePomodoro(initial = { work: 25, short: 5, long: 15, cycles: 4 }) {
  const [settings, setSettings] = useState(initial);
  const [mode, setMode] = useState("work"); // work | short | long | idle
  const [secondsLeft, setSecondsLeft] = useState(settings.work * 60);
  const [running, setRunning] = useState(false);
  const cyclesDoneRef = useRef(0);

  useEffect(() => {
    setSecondsLeft((settings.work || 25) * 60);
  }, [settings.work]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // switch mode
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

  const start = () => setRunning(true);
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    cyclesDoneRef.current = 0;
    setMode("work");
    setSecondsLeft((settings.work || 25) * 60);
  };

  const setPreset = (k) => {
    setMode(k);
    setSecondsLeft((settings[k] || settings.work) * 60);
    setRunning(false);
  };

  return { settings, setSettings, mode, secondsLeft, running, start, pause, reset, setPreset };
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
  const { settings, mode, secondsLeft, running, start, pause, reset, setPreset } = usePomodoro(persisted?.pomodoro ?? undefined);

  // persist
  useEffect(() => {
    const state = { dark, todos, habits, notes, pomodoro: settings };
    saveState(state);
  }, [dark, todos, habits, notes, settings]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Todo handlers
  const addTodo = (text) => {
    if (!text || !text.trim()) return;
    const t = { id: uid(), text: text.trim(), done: false, created: Date.now() };
    setTodos((s) => [t, ...s]);
  };
  const toggleTodo = (id) => setTodos((s) => s.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const delTodo = (id) => setTodos((s) => s.filter((t) => t.id !== id));

  // Habit handlers (daily toggle resets each day)
  useEffect(() => {
    // Ensure today field exists; simple day check using YYYY-MM-DD
    const todayKey = new Date().toISOString().slice(0, 10);
    setHabits((hs) =>
      hs.map((h) => ({
        ...h,
        lastSeen: h.lastSeen || null,
        // if lastSeen is not today and h.toggledToday true then reset toggledToday
        toggledToday: h.lastSeen === todayKey ? h.toggledToday : false,
      }))
    );
  }, []);

  const addHabit = (title) => {
    if (!title || !title.trim()) return;
    setHabits((s) => [...s, { id: uid(), title: title.trim(), toggledToday: false, streak: 0, lastSeen: null }]);
  };

  const toggleHabit = (id) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    setHabits((s) =>
      s.map((h) => {
        if (h.id !== id) return h;
        const toggled = !(h.lastSeen === todayKey && h.toggledToday);
        const streak = toggled && h.lastSeen === todayKey ? h.streak : toggled ? h.streak + 1 : h.streak;
        return { ...h, toggledToday: toggled, lastSeen: todayKey, streak };
      })
    );
  };

  const deleteHabit = (id) => setHabits((s) => s.filter((h) => h.id !== id));

  // Quick note save
  const saveNotes = (text) => setNotes(text);

  // simple search
  const filtered = todos.filter((t) => t.text.toLowerCase().includes(query.toLowerCase()));

  // format seconds
  const formatTime = (s) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // trigger install
  const triggerInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    // hide prompt anyway
    setInstallPromptEvent(null);
    console.log("Install choice", choice);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Header */}
        <header className="md:col-span-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3">
              <motion.span
                initial={{ rotate: -10, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500"
              >
                DailyFlow
              </motion.span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-300 ml-2">— daily habits & focus</span>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Lightweight PWA: todo, habits, notes, pomodoro.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm"
              title="Toggle theme"
            >
              {dark ? <SunMedium className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {installPromptEvent ? (
              <button onClick={triggerInstall} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">
                Install
              </button>
            ) : (
              <span className="text-xs text-gray-500 hidden md:inline">Installable PWA ready</span>
            )}
          </div>
        </header>

        {/* Left column: Todos */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
          <h2 className="font-semibold text-lg flex items-center gap-2">Todos</h2>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent"
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
                if (el && el.value.trim()) {
                  addTodo(el.value);
                  el.value = "";
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3 max-h-80 overflow-auto pr-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500">No todos — add one to get started.</p>
            ) : (
              filtered.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/40 p-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleTodo(t.id)} className="p-1">
                      <CheckCircle className={`w-5 h-5 ${t.done ? "text-green-500" : "text-gray-400"}`} />
                    </button>
                    <div>
                      <div className={`font-medium ${t.done ? "line-through text-gray-400" : ""}`}>{t.text}</div>
                      <div className="text-xs text-gray-500">{new Date(t.created).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => delTodo(t.id)} className="p-1 rounded-md hover:bg-red-50">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <div>{todos.filter((t) => !t.done).length} remaining</div>
            <div>
              <input
                placeholder="Search todos..."
                className="p-1 rounded bg-gray-50 dark:bg-gray-700/50"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Middle column: Habits + Notes */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
          <h2 className="font-semibold text-lg">Habits</h2>

          <div className="mt-3 space-y-3">
            <AddHabit onAdd={addHabit} />

            <div className="grid grid-cols-1 gap-2">
              {habits.length === 0 ? (
                <p className="text-sm text-gray-500">No habits yet — add morning routines, water intake, etc.</p>
              ) : (
                habits.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleHabit(h.id)} className={`p-2 rounded-full ${h.toggledToday ? "bg-green-100" : "bg-gray-100 dark:bg-gray-600"}`}>
                        <CheckCircle className={`w-5 h-5 ${h.toggledToday ? "text-green-600" : "text-gray-400"}`} />
                      </button>
                      <div>
                        <div className="font-medium">{h.title}</div>
                        <div className="text-xs text-gray-500">Streak: {h.streak || 0}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => deleteHabit(h.id)} className="p-1 rounded-md hover:bg-red-50">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <hr className="my-4 border-gray-200 dark:border-gray-700" />

          <h3 className="font-semibold mb-2">Quick Notes</h3>
          <textarea
            className="w-full min-h-[120px] p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40"
            placeholder="Write notes to yourself..."
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
          />
        </section>

        {/* Right column: Pomodoro */}
        <aside className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">Pomodoro</h2>
            <Clock className="w-5 h-5 text-gray-500" />
          </div>

          <div className="mt-4 text-center">
            <div className="text-4xl font-bold">{formatTime(secondsLeft)}</div>
            <div className="text-sm text-gray-500 mt-1">Mode: {mode}</div>

            <div className="mt-4 flex gap-2 justify-center">
              {!running ? (
                <button onClick={start} className="px-3 py-2 rounded-lg bg-green-600 text-white">Start</button>
              ) : (
                <button onClick={pause} className="px-3 py-2 rounded-lg bg-yellow-500 text-white">Pause</button>
              )}
              <button onClick={reset} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">Reset</button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => setPreset("work")} className="py-1 rounded bg-indigo-600 text-white">Work</button>
              <button onClick={() => setPreset("short")} className="py-1 rounded bg-indigo-500 text-white">Short</button>
              <button onClick={() => setPreset("long")} className="py-1 rounded bg-indigo-400 text-white">Long</button>
            </div>

            <div className="mt-4 text-sm text-gray-500">Tip: Use Pomodoro for focused sprints — 25/5 default.</div>
          </div>
        </aside>

        {/* Footer / Actions */}
        <div className="md:col-span-3 flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl">
          <div className="text-sm text-gray-600">Made for daily use — offline-ready PWA (installable).</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // clear all
                if (confirm("Clear all data? This cannot be undone.")) {
                  setTodos([]);
                  setHabits([]);
                  setNotes("");
                  localStorage.removeItem(STORAGE_KEY);
                }
              }}
              className="px-3 py-2 rounded bg-red-50 text-red-600"
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

// --- Small subcomponents ---
function AddHabit({ onAdd }) {
  return (
    <div className="flex gap-2">
      <input
        placeholder="Add habit (e.g., 'Drink water')"
        className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(e.target.value);
            e.target.value = "";
          }
        }}
      />
      <button
        onClick={() => {
          const el = document.querySelector("input[placeholder='Add habit (e.g., \\\"Drink water\\\")']");
          if (el && el.value.trim()) {
            onAdd(el.value);
            el.value = "";
          }
        }}
        className="px-3 py-2 rounded bg-indigo-600 text-white"
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
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={exportJSON} className="px-3 py-2 rounded bg-indigo-600 text-white">
      Export
    </button>
  );
}
