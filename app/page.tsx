'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Check, CheckCircle2, Droplets, Flame,
  Leaf, Menu, Play, Plus, Sparkles, Trash2, Utensils, X, Zap,
} from 'lucide-react'

// ─── constants ────────────────────────────────────────────────────────────────
const recipes = [
  { title: 'Egg & rice bowl', detail: 'Eggs, microwave rice + frozen veg', cost: '$2.40', time: '7 min', calories: 420, protein: '22g', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=85' },
  { title: 'Tuna crunch toast', detail: 'Tuna, toast, cucumber + yogurt', cost: '$2.80', time: '5 min', calories: 350, protein: '28g', image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=600&q=85' },
  { title: 'Berry crunch yogurt', detail: 'Greek yogurt, berries + granola', cost: '$1.90', time: '3 min', calories: 290, protein: '18g', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=85' },
]
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const WORKOUT_OPTIONS = ['Walking', 'Jogging', 'Gym workout', 'Cycling', 'Basketball', 'Badminton', 'Stretching', 'Yoga', 'Home workout']

// ─── types ────────────────────────────────────────────────────────────────────
interface MacroMap { protein: number; carbs: number; fats: number }

interface WorkoutEntry {
  id: string
  activity: string
  duration: number // minutes
}

interface MealEntry {
  id: string
  type: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

interface StreakData {
  waterStreak: number
  moveStreak: number
  macroStreak: number
  lastWaterDate: string   // ISO date YYYY-MM-DD
  lastMoveDate: string
  lastMacroDate: string
}

interface DailyState {
  date: string            // YYYY-MM-DD – the day these entries belong to
  water: number           // cups consumed
  workouts: WorkoutEntry[]
  loggedMeals: MealEntry[]
  consumed: MacroMap
  reflection: { energy: number; mood: number; stress: number }
}

interface PersistentSettings {
  waterGoal: number
  cupSize: number
  goals: MacroMap
  calorieGoal: number
  streaks: StreakData
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function safePercent(num: number, den: number): number {
  if (!den || !isFinite(den) || den === 0) return 0
  const pct = Math.round((num / den) * 100)
  return isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0
}

// ─── localStorage keys ────────────────────────────────────────────────────────
const KEY_DAY = 'thrive_daily'
const KEY_SETTINGS = 'thrive_settings'

function loadDay(): DailyState {
  try {
    const raw = localStorage.getItem(KEY_DAY)
    if (raw) {
      const parsed: DailyState = JSON.parse(raw)
      if (parsed.date === todayISO()) return parsed
      // date changed → reset daily entries, preserve nothing
    }
  } catch { /* ignore */ }
  return {
    date: todayISO(),
    water: 0,
    workouts: [],
    loggedMeals: [],
    consumed: { protein: 0, carbs: 0, fats: 0 },
    reflection: { energy: 3, mood: 3, stress: 3 },
  }
}

function loadSettings(): PersistentSettings {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {
    waterGoal: 8,
    cupSize: 12,
    goals: { protein: 120, carbs: 240, fats: 70 },
    calorieGoal: 2100,
    streaks: {
      waterStreak: 0, moveStreak: 0, macroStreak: 0,
      lastWaterDate: '', lastMoveDate: '', lastMacroDate: '',
    },
  }
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Page() {
  // ── boot: read localStorage once (client-only)
  const [hydrated, setHydrated] = useState(false)

  // ── daily state
  const [date, setDate] = useState(todayISO)
  const [water, setWater] = useState(0)
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([])
  const [loggedMeals, setLoggedMeals] = useState<MealEntry[]>([])
  const [consumed, setConsumed] = useState<MacroMap>({ protein: 0, carbs: 0, fats: 0 })
  const [reflection, setReflection] = useState({ energy: 3, mood: 3, stress: 3 })

  // ── settings
  const [waterGoal, setWaterGoal] = useState(8)
  const [cupSize, setCupSize] = useState(12)
  const [goals, setGoals] = useState<MacroMap>({ protein: 120, carbs: 240, fats: 70 })
  const [calorieGoal, setCalorieGoal] = useState(2100)
  const [streaks, setStreaks] = useState<StreakData>({
    waterStreak: 0, moveStreak: 0, macroStreak: 0,
    lastWaterDate: '', lastMoveDate: '', lastMacroDate: '',
  })

  // ── UI state
  const [menuOpen, setMenuOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)

  // workout form
  const [exercise, setExercise] = useState('Walking')
  const [duration, setDuration] = useState(20)

  // meal form
  const [mealType, setMealType] = useState('Breakfast')
  const [mealName, setMealName] = useState('')
  const [mealCal, setMealCal] = useState('')
  const [mealProtein, setMealProtein] = useState('')
  const [mealCarbs, setMealCarbs] = useState('')
  const [mealFats, setMealFats] = useState('')

  // macro quick-add inputs (controlled, committed on button click)
  const [macroInput, setMacroInput] = useState<MacroMap>({ protein: 0, carbs: 0, fats: 0 })

  // ── hydration: load from localStorage on mount
  useEffect(() => {
    const day = loadDay()
    const settings = loadSettings()

    setDate(day.date)
    setWater(day.water)
    setWorkouts(day.workouts)
    setLoggedMeals(day.loggedMeals)
    setConsumed(day.consumed)
    setReflection(day.reflection)

    setWaterGoal(settings.waterGoal)
    setCupSize(settings.cupSize)
    setGoals(settings.goals)
    setCalorieGoal(settings.calorieGoal)
    setStreaks(settings.streaks)

    setHydrated(true)
  }, [])

  // ── persist daily state
  useEffect(() => {
    if (!hydrated) return
    const day: DailyState = { date, water, workouts, loggedMeals, consumed, reflection }
    localStorage.setItem(KEY_DAY, JSON.stringify(day))
  }, [hydrated, date, water, workouts, loggedMeals, consumed, reflection])

  // ── persist settings
  useEffect(() => {
    if (!hydrated) return
    const settings: PersistentSettings = { waterGoal, cupSize, goals, calorieGoal, streaks }
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings))
  }, [hydrated, waterGoal, cupSize, goals, calorieGoal, streaks])

  // ── update streaks when daily goals are hit
  const waterPct = safePercent(water, waterGoal)
  const totalMinutes = useMemo(() => workouts.reduce((s, w) => s + w.duration, 0), [workouts])
  const calorieTotal = useMemo(
    () => Math.round(consumed.protein * 4 + consumed.carbs * 4 + consumed.fats * 9),
    [consumed],
  )

  // bump a streak when a goal is first hit today
  useEffect(() => {
    if (!hydrated) return
    const today = todayISO()
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    function bumpStreak(
      key: 'water' | 'move' | 'macro',
      goalMet: boolean,
      lastDate: string,
      currentStreak: number,
    ): { streak: number; lastDate: string } {
      if (!goalMet) return { streak: currentStreak, lastDate }
      if (lastDate === today) return { streak: currentStreak, lastDate } // already counted
      const newStreak = lastDate === yesterday ? currentStreak + 1 : 1
      return { streak: newStreak, lastDate: today }
    }

    const waterRes = bumpStreak('water', waterPct >= 100, streaks.lastWaterDate, streaks.waterStreak)
    const moveRes = bumpStreak('move', totalMinutes >= 20, streaks.lastMoveDate, streaks.moveStreak)
    const macroRes = bumpStreak('macro', calorieTotal >= calorieGoal * 0.8 && calorieGoal > 0, streaks.lastMacroDate, streaks.macroStreak)

    if (
      waterRes.streak !== streaks.waterStreak || waterRes.lastDate !== streaks.lastWaterDate ||
      moveRes.streak !== streaks.moveStreak || moveRes.lastDate !== streaks.lastMoveDate ||
      macroRes.streak !== streaks.macroStreak || macroRes.lastDate !== streaks.lastMacroDate
    ) {
      setStreaks({
        waterStreak: waterRes.streak, lastWaterDate: waterRes.lastDate,
        moveStreak: moveRes.streak, lastMoveDate: moveRes.lastDate,
        macroStreak: macroRes.streak, lastMacroDate: macroRes.lastDate,
      })
    }
  }, [hydrated, waterPct, totalMinutes, calorieTotal, calorieGoal]) // eslint-disable-line

  // ── weekly progress: derive from today's data as 0–100% per category
  const weeklyBars = useMemo(() => ({
    Water: waterPct,
    Macros: safePercent(calorieTotal, calorieGoal),
    Move: Math.min(100, safePercent(totalMinutes, 60)),
    Calories: safePercent(calorieTotal, calorieGoal),
  }), [waterPct, calorieTotal, calorieGoal, totalMinutes])

  // ── actions ──────────────────────────────────────────────────────────────────

  /** Add a cup (uses real cupSize oz) */
  function addCup() {
    setWater((w) => Math.min(waterGoal, w + 1))
  }

  /** Add workout entry */
  function addWorkout() {
    if (duration <= 0) return
    setWorkouts((prev) => [...prev, { id: uid(), activity: exercise, duration }])
  }

  /** Delete workout entry */
  function deleteWorkout(id: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  /** Add meal with macros */
  function addMeal() {
    if (!mealName.trim()) return
    const cal = Math.max(0, Number(mealCal) || 0)
    const prot = Math.max(0, Number(mealProtein) || 0)
    const carb = Math.max(0, Number(mealCarbs) || 0)
    const fat = Math.max(0, Number(mealFats) || 0)
    const entry: MealEntry = {
      id: uid(), type: mealType, name: mealName.trim(),
      calories: cal, protein: prot, carbs: carb, fats: fat,
    }
    setLoggedMeals((prev) => [...prev, entry])
    setConsumed((prev) => ({
      protein: prev.protein + prot,
      carbs: prev.carbs + carb,
      fats: prev.fats + fat,
    }))
    setMealName(''); setMealCal(''); setMealProtein(''); setMealCarbs(''); setMealFats('')
  }

  /** Delete meal and subtract its macros */
  function deleteMeal(id: string) {
    const entry = loggedMeals.find((m) => m.id === id)
    if (!entry) return
    setLoggedMeals((prev) => prev.filter((m) => m.id !== id))
    setConsumed((prev) => ({
      protein: Math.max(0, prev.protein - entry.protein),
      carbs: Math.max(0, prev.carbs - entry.carbs),
      fats: Math.max(0, prev.fats - entry.fats),
    }))
  }

  /** Add macro from the quick-add inputs (committed on button click) */
  function commitMacro(macro: keyof MacroMap) {
    const val = macroInput[macro]
    if (!val || val <= 0) return
    setConsumed((prev) => ({ ...prev, [macro]: prev[macro] + val }))
    setMacroInput((prev) => ({ ...prev, [macro]: 0 }))
  }

  /** "Today's plan" / "Build my healthy day" → scroll to dashboard */
  function scrollToDashboard() {
    document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' })
    setStarted(true)
  }

  // ── render guard: avoid SSR mismatch
  if (!hydrated) return null

  return (
    <main className="min-h-screen bg-[#f8fbf3] text-[#173b2c]">
      <div className="mx-auto max-w-[1240px] overflow-hidden bg-white shadow-[0_20px_80px_rgba(37,92,53,0.12)] sm:my-4 sm:rounded-[32px]">

        {/* ── header ── */}
        <header className="flex h-[78px] items-center justify-between border-b border-[#e8eee5] px-6 sm:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="thrive home">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#ff765e] text-white shadow-lg shadow-[#ff765e]/20"><Leaf className="size-5" /></span>
            <span className="text-xl font-black tracking-[-0.06em]">thrive<span className="text-[#ff765e]">.</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-bold text-[#708177] sm:flex" aria-label="Main navigation">
            <a href="#dashboard" className="text-[#173b2c]">My dashboard</a>
            <a href="#recipes" className="hover:text-[#ff765e]">Recipes</a>
            <a href="#movement" className="hover:text-[#ff765e]">Movement</a>
            <button onClick={scrollToDashboard} className="rounded-full bg-[#173b2c] px-5 py-2.5 text-white hover:bg-[#255c35] transition-colors">Today&apos;s plan</button>
          </nav>
          <button className="rounded-xl p-2 sm:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></button>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-20 bg-white p-6 sm:hidden">
            <div className="flex items-center justify-between">
              <span className="font-black">thrive.</span>
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button>
            </div>
            <nav className="mt-12 flex flex-col gap-7 text-2xl font-black">
              <a href="#dashboard" onClick={() => setMenuOpen(false)}>My dashboard</a>
              <a href="#recipes" onClick={() => setMenuOpen(false)}>Recipes</a>
              <a href="#movement" onClick={() => setMenuOpen(false)}>Movement</a>
            </nav>
          </div>
        )}

        {/* ── hero ── */}
        <section id="top" className="grid gap-10 bg-[#fff4e9] px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#ff765e] shadow-sm">
              <Sparkles className="size-4" /> Small steps, big energy
            </div>
            <h1 className="max-w-[620px] text-5xl font-black leading-[0.98] tracking-[-0.07em] sm:text-7xl">
              Get started today.<br /><span className="text-[#ff765e]">Feel good</span> tomorrow.
            </h1>
            <p className="mt-6 max-w-[540px] text-base leading-7 text-[#687b6e] sm:text-lg">
              A personalized wellness companion for busy students. Eat affordably, move your way, and build habits that fit real life.
            </p>
            <button onClick={scrollToDashboard} className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#173b2c] px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-[#173b2c]/15 transition-transform hover:-translate-y-0.5">
              {started ? 'Your day is underway' : 'Build my healthy day'}<ArrowRight className="size-4" />
            </button>
            {started && (
              <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#5c8d61]">
                <CheckCircle2 className="size-4" /> One doable choice at a time.
              </p>
            )}
          </div>
          <div className="relative mx-auto w-full max-w-[410px]">
            <div className="absolute -right-2 -top-5 z-10 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black shadow-xl">
              <span className="grid size-8 place-items-center rounded-full bg-[#c8ebd2] text-[#35935b]"><Zap className="size-4" /></span> +12 energy points
            </div>
            <img className="aspect-[1.08] w-full rounded-[32px] object-cover shadow-2xl" src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=85" alt="Colorful healthy meal bowl with vegetables" />
            <div className="absolute -bottom-5 -left-3 rounded-2xl bg-[#173b2c] px-5 py-4 text-white shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8d5b8]">Today&apos;s vibe</p>
              <p className="mt-1 text-lg font-black">Fresh &amp; focused</p>
            </div>
          </div>
        </section>

        {/* ── dashboard ── */}
        <section id="dashboard" className="border-b border-[#e8eee5] px-6 py-10 sm:px-10 lg:px-16">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff765e]">Your daily dashboard</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">A little care goes a long way.</h2>
            </div>
            <span className="hidden rounded-full bg-[#eef8ec] px-4 py-2 text-xs font-black text-[#5c8d61] sm:block">
              {formatDate(date)}
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-3">

            {/* ── Macro check-in ── */}
            <article className="rounded-3xl bg-[#fff2ed] p-6">
              <div className="flex items-center justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-[#ff765e] text-white"><Flame /></div>
                <button onClick={() => setEditingGoals(!editingGoals)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#ff765e]">
                  {editingGoals ? 'Done' : 'Edit goals'}
                </button>
              </div>
              <h3 className="mt-5 font-black">Macro check-in</h3>
              <p className="mt-1 text-sm text-[#77877b]">{calorieTotal.toLocaleString()} calories logged today</p>

              {/* calorie bar using real calorieGoal */}
              <div className="mt-5 h-2 rounded-full bg-white">
                <div className="h-2 rounded-full bg-[#ff765e] transition-all" style={{ width: `${safePercent(calorieTotal, calorieGoal)}%` }} />
              </div>

              {/* calorie goal edit */}
              {editingGoals && (
                <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#77877b]">
                  Calorie goal (kcal)
                  <input
                    type="number" min={1}
                    value={calorieGoal}
                    onChange={(e) => setCalorieGoal(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded-lg border-0 bg-white p-1 text-center text-sm"
                  />
                </label>
              )}

              {/* macro bars */}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                {(['protein', 'carbs', 'fats'] as const).map((macro) => (
                  <div key={macro}>
                    <b className="block text-lg text-[#173b2c]">
                      {editingGoals
                        ? <input
                            aria-label={`${macro} goal`}
                            type="number" min={1}
                            value={goals[macro]}
                            onChange={(e) => setGoals({ ...goals, [macro]: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-14 rounded-lg border-0 bg-white p-1 text-center text-sm"
                          />
                        : `${consumed[macro]}g`
                      }
                    </b>
                    <span className="text-[#77877b]">{macro} · {safePercent(consumed[macro], goals[macro])}%</span>
                  </div>
                ))}
              </div>

              {/* quick-add macros: committed on button click */}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white pt-4 text-xs text-[#77877b]">
                {(['protein', 'carbs', 'fats'] as const).map((macro) => (
                  <div key={macro} className="flex flex-col gap-1">
                    <span>Add {macro}</span>
                    <input
                      type="number" min={0} placeholder="0g"
                      value={macroInput[macro] || ''}
                      onChange={(e) => setMacroInput({ ...macroInput, [macro]: Number(e.target.value) || 0 })}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitMacro(macro) }}
                      className="w-full rounded-lg border-0 bg-white p-2"
                    />
                    <button
                      onClick={() => commitMacro(macro)}
                      className="rounded-lg bg-[#ff765e] py-1 text-white hover:bg-[#e85f47] transition-colors"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </article>

            {/* ── Hydration station ── */}
            <article className="rounded-3xl bg-[#edf8f1] p-6">
              <div className="flex items-center justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-[#4ba97a] text-white"><Droplets /></div>
                <span className="text-xs font-black text-[#4ba97a]">{water}/{waterGoal} cups</span>
              </div>
              <h3 className="mt-5 font-black">Hydration station</h3>
              <p className="mt-1 text-sm text-[#77877b]">
                {waterPct}% complete
                {streaks.waterStreak > 0 && ` · ${streaks.waterStreak} day streak 🔥`}
              </p>

              {/* cup buttons */}
              <div className="mt-5 flex flex-wrap gap-2">
                {Array.from({ length: waterGoal }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setWater(i + 1)}
                    aria-label={`Set water to ${i + 1} cups`}
                    className={`grid size-7 place-items-center rounded-full transition-colors ${i < water ? 'bg-[#4ba97a] text-white' : 'bg-white text-[#c3d8c7]'}`}
                  >
                    <Droplets className="size-3" />
                  </button>
                ))}
              </div>

              {/* settings */}
              <div className="mt-5 flex gap-2">
                <label className="flex-1 text-xs font-bold text-[#39875f]">
                  Daily goal (cups)
                  <input type="number" min={1} value={waterGoal}
                    onChange={(e) => setWaterGoal(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-lg border-0 bg-white p-2"
                  />
                </label>
                <label className="flex-1 text-xs font-bold text-[#39875f]">
                  Cup size (oz)
                  <input type="number" min={1} value={cupSize}
                    onChange={(e) => setCupSize(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-lg border-0 bg-white p-2"
                  />
                </label>
              </div>

              {/* total oz shown */}
              <p className="mt-2 text-[11px] text-[#5c9e73] font-bold">
                {water * cupSize} oz / {waterGoal * cupSize} oz total
              </p>

              <button onClick={addCup} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#4ba97a] px-3 py-1.5 text-xs font-black text-white hover:bg-[#3c8f65] transition-colors">
                Add a {cupSize} oz glass <Plus className="size-3" />
              </button>
            </article>

            {/* ── Move your way ── */}
            <article id="movement" className="rounded-3xl bg-[#f3efff] p-6">
              <div className="flex items-center justify-between">
                <div className="grid size-11 place-items-center rounded-2xl bg-[#8067d8] text-white"><Play className="size-4 fill-current" /></div>
                <span className="text-xs font-black text-[#8067d8]">{workouts.length} logged</span>
              </div>
              <h3 className="mt-5 font-black">Move your way</h3>
              <p className="mt-1 text-sm text-[#77877b]">
                {totalMinutes} min logged
                {streaks.moveStreak > 0 && ` · ${streaks.moveStreak} day streak 🔥`}
              </p>

              {/* logged workout entries */}
              <div className="mt-4 flex flex-col gap-2 max-h-36 overflow-y-auto">
                {workouts.length === 0
                  ? <p className="text-xs text-[#9c91c7]">No activities logged yet.</p>
                  : workouts.map((w) => (
                      <div key={w.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold">
                        <Check className="size-3 text-[#8067d8]" />
                        <span className="flex-1">{w.activity}</span>
                        <span className="text-[#9c91c7]">{w.duration} min</span>
                        <button onClick={() => deleteWorkout(w.id)} aria-label="Delete workout" className="text-[#c3b8f0] hover:text-red-400 transition-colors">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))
                }
              </div>

              {/* add workout form */}
              <div className="mt-4 flex gap-2">
                <select value={exercise} onChange={(e) => setExercise(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border-0 bg-white p-2 text-xs font-bold">
                  {WORKOUT_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
                <input
                  aria-label="Workout duration in minutes"
                  type="number" min={1} value={duration}
                  onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-lg border-0 bg-white p-2 text-xs"
                />
                <button onClick={addWorkout} className="rounded-lg bg-[#8067d8] px-3 text-white text-xs font-black hover:bg-[#6b53c0] transition-colors">
                  Add
                </button>
              </div>
              <p className="mt-2 text-[11px] text-[#8067d8]">Pick an activity and duration, then click Add.</p>
            </article>
          </div>
        </section>

        {/* ── meal logging + weekly progress ── */}
        <section className="grid gap-5 bg-[#fbfcf8] px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-16">

          {/* meal logging */}
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#edf1e9]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff765e]">Fast meal logging</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">What did you eat?</h2>
              </div>
              <Utensils className="text-[#ff765e]" />
            </div>

            {/* meal form */}
            <div className="mt-5 grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                <select value={mealType} onChange={(e) => setMealType(e.target.value)}
                  className="rounded-xl border-0 bg-[#fff4e9] p-3 text-sm font-bold">
                  {MEAL_TYPES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <input value={mealName} onChange={(e) => setMealName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addMeal() }}
                  placeholder="Food name, e.g. banana + peanut butter"
                  className="rounded-xl border-0 bg-[#f8fbf3] p-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[
                  { label: 'Calories', val: mealCal, set: setMealCal, placeholder: 'kcal' },
                  { label: 'Protein', val: mealProtein, set: setMealProtein, placeholder: 'g' },
                  { label: 'Carbs', val: mealCarbs, set: setMealCarbs, placeholder: 'g' },
                  { label: 'Fats', val: mealFats, set: setMealFats, placeholder: 'g' },
                ].map(({ label, val, set, placeholder }) => (
                  <label key={label} className="flex flex-col gap-1 font-bold text-[#77877b]">
                    {label}
                    <input type="number" min={0} value={val} onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      className="rounded-xl border-0 bg-[#f8fbf3] p-2"
                    />
                  </label>
                ))}
              </div>
              <button onClick={addMeal} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173b2c] py-2.5 text-sm font-black text-white hover:bg-[#255c35] transition-colors">
                <Plus className="size-4" /> Log meal
              </button>
            </div>

            {/* logged meals list */}
            <div className="mt-4 flex flex-col gap-2 max-h-52 overflow-y-auto">
              {loggedMeals.length === 0
                ? <p className="text-sm text-[#91a095]">Quick-add a meal and your macros stay in sync.</p>
                : loggedMeals.map((meal) => (
                    <div key={meal.id} className="flex items-start gap-2 rounded-xl bg-[#f8fbf3] p-3 text-sm font-bold">
                      <Check className="size-4 mt-0.5 shrink-0 text-[#4ba97a]" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[#173b2c]">{meal.type}: {meal.name}</span>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] font-normal text-[#91a095]">
                          {meal.calories > 0 && <span>{meal.calories} kcal</span>}
                          {meal.protein > 0 && <span>{meal.protein}g protein</span>}
                          {meal.carbs > 0 && <span>{meal.carbs}g carbs</span>}
                          {meal.fats > 0 && <span>{meal.fats}g fats</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteMeal(meal.id)} aria-label="Delete meal" className="text-[#c3d8c7] hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))
              }
            </div>
          </article>

          {/* weekly progress */}
          <article className="rounded-3xl bg-[#173b2c] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b8d5b8]">Today&apos;s progress</p>
            <h2 className="mt-2 text-2xl font-black">Your tiny wins add up.</h2>
            <div className="mt-6 grid grid-cols-4 gap-3 text-center text-xs">
              {(Object.entries(weeklyBars) as [string, number][]).map(([label, pct], i) => {
                const colors = ['bg-[#4ba97a]', 'bg-[#ff765e]', 'bg-[#8067d8]', 'bg-[#f7c96b]']
                return (
                  <div key={label}>
                    <div className="flex h-20 items-end justify-center">
                      <div className={`w-5 rounded-t-full ${colors[i]} transition-all duration-500`} style={{ height: `${Math.max(4, pct)}%` }} />
                    </div>
                    <span>{label}</span>
                    <div className="mt-1 text-[10px] text-[#b8d5b8]">{pct}%</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 rounded-2xl bg-white/10 p-3 text-sm font-bold">
              {calorieTotal === 0 && totalMinutes === 0 && water === 0
                ? 'Log your first entry to see your progress here.'
                : `Water: ${waterPct}% · Calories: ${safePercent(calorieTotal, calorieGoal)}% · Move: ${Math.min(100, safePercent(totalMinutes, 60))} min`
              }
            </div>
          </article>
        </section>

        {/* ── recipes ── */}
        <section id="recipes" className="bg-[#fbfcf8] px-6 pb-10 sm:px-10 lg:px-16">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4ba97a]">Affordable meal ideas</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">5-minute fuel.</h2>
            </div>
            <span className="hidden rounded-full bg-[#edf8f1] px-4 py-2 text-xs font-black text-[#4ba97a] sm:block">Student-budget friendly</span>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {recipes.map((recipe) => (
              <article key={recipe.title} className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#edf1e9]">
                <img src={recipe.image} alt={recipe.title} className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black">{recipe.title}</h3>
                    <span className="rounded-full bg-[#fff2ed] px-2.5 py-1 text-[10px] font-black text-[#ff765e]">{recipe.cost}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#77877b]">{recipe.detail}</p>
                  <div className="mt-4 flex gap-2 text-[11px] font-bold text-[#4ba97a]">
                    <span className="rounded-full bg-[#edf8f1] px-2 py-1">{recipe.time}</span>
                    <span className="rounded-full bg-[#fff4e9] px-2 py-1">{recipe.calories} kcal</span>
                    <span className="rounded-full bg-[#f3efff] px-2 py-1">{recipe.protein} protein</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── reflection + streaks ── */}
        <section className="grid gap-5 border-t border-[#e8eee5] px-6 py-10 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-16">
          <article className="rounded-3xl bg-[#fff4e9] p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff765e]">Daily reflection</p>
            <h2 className="mt-2 text-2xl font-black">How are you feeling?</h2>
            {(['energy', 'mood', 'stress'] as const).map((item) => (
              <label key={item} className="mt-4 flex items-center justify-between text-sm font-bold capitalize">
                {item}
                <input
                  aria-label={`${item} level`}
                  type="range" min={1} max={5}
                  value={reflection[item]}
                  onChange={(e) => setReflection({ ...reflection, [item]: Number(e.target.value) })}
                  className="mx-3 accent-[#ff765e]"
                />
                <span className="grid size-7 place-items-center rounded-full bg-white text-xs">{reflection[item]}</span>
              </label>
            ))}
            <p className="mt-5 text-xs leading-5 text-[#77877b]">
              Your hydration and movement are helping your energy stay steady today.
            </p>
          </article>

          <article className="rounded-3xl bg-[#edf8f1] p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-[#4ba97a] text-white"><Sparkles /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4ba97a]">Your streak shelf</p>
                <h2 className="mt-1 text-2xl font-black">Keep the momentum.</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-2xl font-black">{streaks.waterStreak} {streaks.waterStreak === 1 ? 'day' : 'days'}</p>
                <p className="mt-1 text-xs font-bold text-[#77877b]">Water goal</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-2xl font-black">{streaks.moveStreak} {streaks.moveStreak === 1 ? 'day' : 'days'}</p>
                <p className="mt-1 text-xs font-bold text-[#77877b]">Move goal</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-2xl font-black">{streaks.macroStreak} {streaks.macroStreak === 1 ? 'day' : 'days'}</p>
                <p className="mt-1 text-xs font-bold text-[#77877b]">Macro goal</p>
              </div>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[#39875f]">
              <CheckCircle2 className="size-4" /> You&apos;re building a sustainable rhythm.
            </p>
          </article>
        </section>

        {/* ── footer ── */}
        <footer className="flex flex-col gap-3 border-t border-[#e8eee5] px-6 py-7 text-sm text-[#87988c] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className="flex items-center gap-2 font-black text-[#173b2c]"><Utensils className="size-4 text-[#ff765e]" /> thrive. for better everyday energy.</span>
          <span>Designed for real student life.</span>
        </footer>
      </div>
    </main>
  )
}
