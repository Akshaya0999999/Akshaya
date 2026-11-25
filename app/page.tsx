'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, CheckCircle2, Droplets, Flame, Leaf, Menu, Minus, Play, Plus, RotateCcw, Sparkles, Trash2, Utensils, X, Zap } from 'lucide-react'

/* ---------- static content ---------- */

const recipes = [
  { title: 'Egg & rice bowl', detail: 'Eggs, microwave rice + frozen veg', cost: '$2.40', time: '7 min', calories: 420, protein: 22, carbs: 48, fats: 14, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=85' },
  { title: 'Tuna crunch toast', detail: 'Tuna, toast, cucumber + yogurt', cost: '$2.80', time: '5 min', calories: 350, protein: 28, carbs: 32, fats: 10, image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=600&q=85' },
  { title: 'Berry crunch yogurt', detail: 'Greek yogurt, berries + granola', cost: '$1.90', time: '3 min', calories: 290, protein: 18, carbs: 38, fats: 7, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=85' },
]
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const quickWorkouts = ['Cardio', 'Strength', 'Yoga']
const QUICK_WORKOUT_MIN = 20
const MOVE_GOAL_MIN = 30
const workoutExamples = ['Walking', 'Jogging', 'Gym workout', 'Cycling', 'Basketball', 'Badminton', 'Stretching', 'Yoga', 'Home workout']
const macroKeys = ['protein', 'carbs', 'fats'] as const

/* ---------- types & helpers ---------- */

type Macro = (typeof macroKeys)[number]
type Macros = Record<Macro, number>
type Meal = { id: string; type: string; name: string }
type Activity = { id: string; name: string; minutes: number }
type Day = {
  water: number
  consumed: Macros
  quickWorkouts: string[]
  activities: Activity[]
  meals: Meal[]
  reflection: { energy: number; mood: number; stress: number }
}
type Store = { goals: Macros; waterGoal: number; cupSize: number; days: Record<string, Day> }

const STORAGE_KEY = 'thrive:v1'
const emptyDay = (): Day => ({ water: 0, consumed: { protein: 0, carbs: 0, fats: 0 }, quickWorkouts: [], activities: [], meals: [], reflection: { energy: 3, mood: 3, stress: 3 } })
const defaultStore = (): Store => ({ goals: { protein: 120, carbs: 240, fats: 70 }, waterGoal: 8, cupSize: 12, days: {} })

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d) }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
const uid = () => Math.random().toString(36).slice(2, 10)
const kcal = (m: Macros) => Math.round(m.protein * 4 + m.carbs * 4 + m.fats * 9)
const pct = (value: number, goal: number) => (goal > 0 ? Math.round((value / goal) * 100) : 0)
const moveMinutes = (day: Day) => day.quickWorkouts.length * QUICK_WORKOUT_MIN + day.activities.reduce((sum, a) => sum + a.minutes, 0)

const hits = (day: Day | undefined, s: Store) => {
  if (!day) return { water: false, move: false, macros: false, calories: false }
  const goalKcal = kcal(s.goals)
  const dayKcal = kcal(day.consumed)
  return {
    water: s.waterGoal > 0 && day.water >= s.waterGoal,
    move: moveMinutes(day) >= MOVE_GOAL_MIN,
    macros: macroKeys.every((m) => s.goals[m] > 0 && day.consumed[m] >= s.goals[m] * 0.8),
    calories: goalKcal > 0 && dayKcal >= goalKcal * 0.85 && dayKcal <= goalKcal * 1.15,
  }
}

// Consecutive days that met the goal, counting back from today (today counts only once it's met).
const streak = (s: Store, key: 'water' | 'move' | 'macros') => {
  let count = 0
  for (let i = hits(s.days[daysAgo(0)], s)[key] ? 0 : 1; i < 365; i++) {
    if (!hits(s.days[daysAgo(i)], s)[key]) break
    count++
  }
  return count
}
const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/* ---------- page ---------- */

export default function Page() {
  const [store, setStore] = useState<Store>(defaultStore)
  const [loaded, setLoaded] = useState(false)
  const [todayKey, setTodayKey] = useState('')
  const [todayLabel, setTodayLabel] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)
  const [macroDraft, setMacroDraft] = useState<Record<Macro, string>>({ protein: '', carbs: '', fats: '' })
  const [exercise, setExercise] = useState('Walking')
  const [duration, setDuration] = useState('20')
  const [mealName, setMealName] = useState('')
  const [mealType, setMealType] = useState('Breakfast')

  // Load saved data on the client only (avoids hydration mismatches).
  useEffect(() => {
    const now = new Date()
    setTodayKey(dateKey(now))
    setTodayLabel(now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }))
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setStore({ ...defaultStore(), ...JSON.parse(saved) })
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch {}
  }, [store, loaded])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const today = store.days[todayKey] ?? emptyDay()
  const { goals, waterGoal, cupSize } = store
  const updateToday = (fn: (day: Day) => Day) => setStore((s) => ({ ...s, days: { ...s.days, [todayKey]: fn(s.days[todayKey] ?? emptyDay()) } }))

  const water = today.water
  const calorieTotal = kcal(today.consumed)
  const calorieGoal = kcal(goals)
  const minutes = moveMinutes(today)
  const waterStreak = useMemo(() => streak(store, 'water'), [store])
  const moveStreak = useMemo(() => streak(store, 'move'), [store])
  const macroStreak = useMemo(() => streak(store, 'macros'), [store])

  const week = useMemo(() => {
    const counts = { water: 0, macros: 0, move: 0, calories: 0 }
    for (let i = 0; i < 7; i++) {
      const h = hits(store.days[daysAgo(i)], store)
      ;(Object.keys(counts) as (keyof typeof counts)[]).forEach((k) => { if (h[k]) counts[k]++ })
    }
    return counts
  }, [store])
  const weekTotal = week.water + week.macros + week.move + week.calories

  /* actions */
  const addMacro = (macro: Macro) => {
    const amount = clamp(Number(macroDraft[macro]), -1000, 1000)
    if (!amount) return
    updateToday((d) => ({ ...d, consumed: { ...d.consumed, [macro]: Math.max(0, d.consumed[macro] + amount) } }))
    setMacroDraft((draft) => ({ ...draft, [macro]: '' }))
  }
  const setWater = (cups: number) => updateToday((d) => ({ ...d, water: clamp(cups, 0, 30) }))
  const toggleWorkout = (workout: string) => updateToday((d) => ({ ...d, quickWorkouts: d.quickWorkouts.includes(workout) ? d.quickWorkouts.filter((w) => w !== workout) : [...d.quickWorkouts, workout] }))
  const logActivity = () => {
    const mins = clamp(Math.round(Number(duration)), 0, 600)
    if (!mins) return
    updateToday((d) => ({ ...d, activities: [...d.activities, { id: uid(), name: exercise, minutes: mins }] }))
  }
  const addMeal = () => {
    if (!mealName.trim()) return
    updateToday((d) => ({ ...d, meals: [...d.meals, { id: uid(), type: mealType, name: mealName.trim() }] }))
    setMealName('')
  }
  const addRecipe = (r: (typeof recipes)[number]) => updateToday((d) => ({
    ...d,
    meals: [...d.meals, { id: uid(), type: 'Meal', name: r.title }],
    consumed: { protein: d.consumed.protein + r.protein, carbs: d.consumed.carbs + r.carbs, fats: d.consumed.fats + r.fats },
  }))
  const resetToday = () => { if (window.confirm("Clear everything you've logged today?")) updateToday(() => emptyDay()) }
  const startDay = () => { setStarted(true); document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' }) }

  const reflectionTip = today.reflection.stress >= 4
    ? 'Stress is running high. A 10-minute walk and a glass of water are a good reset.'
    : today.reflection.energy <= 2
      ? water < waterGoal / 2 ? 'Low energy? You are behind on water. Start with one glass.' : 'Low energy? Try a protein-rich snack and a short stretch.'
      : minutes >= MOVE_GOAL_MIN && water >= waterGoal / 2
        ? 'Your hydration and movement are helping your energy stay steady today.'
        : 'Nice check-in. Small choices today add up to how you feel tomorrow.'

  return (
    <main className="min-h-screen bg-[#f8fbf3] text-[#173b2c]">
      <div className="mx-auto max-w-[1240px] overflow-hidden bg-white shadow-[0_20px_80px_rgba(37,92,53,0.12)] sm:my-4 sm:rounded-[32px]">
        {/* header */}
        <header className="flex h-[78px] items-center justify-between border-b border-[#e8eee5] px-6 sm:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="thrive home">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#ff765e] text-white shadow-lg shadow-[#ff765e]/20"><Leaf className="size-5" /></span>
            <span className="text-xl font-black tracking-[-0.06em]">thrive<span className="text-[#ff765e]">.</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-bold text-[#708177] sm:flex" aria-label="Main navigation">
            <a href="#dashboard" className="hover:text-[#ff765e]">My dashboard</a>
            <a href="#recipes" className="hover:text-[#ff765e]">Recipes</a>
            <a href="#movement" className="hover:text-[#ff765e]">Movement</a>
            <a href="#log" className="rounded-full bg-[#173b2c] px-5 py-2.5 text-white transition-colors hover:bg-[#245740]">Today&apos;s plan</a>
          </nav>
          <button className="rounded-xl p-2 sm:hidden" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu /></button>
        </header>
        {menuOpen && (
          <div className="fixed inset-0 z-20 bg-white p-6 sm:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex items-center justify-between"><span className="font-black">thrive.</span><button aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button></div>
            <nav className="mt-12 flex flex-col gap-7 text-2xl font-black">
              {[['#dashboard', 'My dashboard'], ['#recipes', 'Recipes'], ['#movement', 'Movement'], ['#log', "Today's plan"]].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
              ))}
            </nav>
          </div>
        )}

        {/* hero */}
        <section id="top" className="grid gap-10 bg-[#fff4e9] px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#ff765e] shadow-sm"><Sparkles className="size-4" /> Small steps, big energy</div>
            <h1 className="max-w-[620px] text-5xl font-black leading-[0.98] tracking-[-0.07em] sm:text-7xl">Get started today.<br /><span className="text-[#ff765e]">Feel good</span> tomorrow.</h1>
            <p className="mt-6 max-w-[540px] text-base leading-7 text-[#687b6e] sm:text-lg">A personalized wellness companion for busy students. Eat affordably, move your way, and build habits that fit real life.</p>
            <button onClick={startDay} className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#173b2c] px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-[#173b2c]/15 transition-transform hover:-translate-y-0.5">{started ? 'Your day is underway' : 'Build my healthy day'}<ArrowRight className="size-4" /></button>
            {started && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#5c8d61]"><CheckCircle2 className="size-4" /> One doable choice at a time.</p>}
          </div>
          <div className="relative mx-auto w-full max-w-[410px]">
            <div className="absolute -right-2 -top-5 z-10 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black shadow-xl"><span className="grid size-8 place-items-center rounded-full bg-[#c8ebd2] text-[#35935b]"><Zap className="size-4" /></span> {weekTotal ? `+${weekTotal * 4} energy points` : 'Start earning energy'}</div>
            <img className="aspect-[1.08] w-full rounded-[32px] bg-[#e6efdf] object-cover shadow-2xl" src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=85" alt="Colorful healthy meal bowl with vegetables" />
            <div className="absolute -bottom-5 -left-3 rounded-2xl bg-[#173b2c] px-5 py-4 text-white shadow-xl"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8d5b8]">Today&apos;s vibe</p><p className="mt-1 text-lg font-black">Fresh & focused</p></div>
          </div>
        </section>

        {/* dashboard */}
        <section id="dashboard" className="scroll-mt-4 border-b border-[#e8eee5] px-6 py-10 sm:px-10 lg:px-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff765e]">Your daily dashboard</p><h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">A little care goes a long way.</h2></div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-[#eef8ec] px-4 py-2 text-xs font-black text-[#5c8d61] sm:block">{todayLabel}</span>
              <button onClick={resetToday} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-[#91a095] hover:bg-[#f3f6f1]" aria-label="Reset today"><RotateCcw className="size-3.5" /> Reset</button>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {/* macros */}
            <article className="rounded-3xl bg-[#fff2ed] p-6">
              <div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-[#ff765e] text-white"><Flame /></div><button onClick={() => setEditingGoals(!editingGoals)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#ff765e]">{editingGoals ? 'Done' : 'Edit goals'}</button></div>
              <h3 className="mt-5 font-black">Macro check-in</h3>
              <p className="mt-1 text-sm text-[#77877b]">{calorieTotal.toLocaleString()} of {calorieGoal.toLocaleString()} kcal today</p>
              <div className="mt-5 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-[#ff765e] transition-all" style={{ width: `${Math.min(100, pct(calorieTotal, calorieGoal))}%` }} /></div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                {macroKeys.map((macro) => (
                  <div key={macro}>
                    <b className="block text-lg text-[#173b2c]">
                      {editingGoals
                        ? <input aria-label={`${macro} goal (g)`} type="number" min={1} value={goals[macro] || ''} onChange={(e) => setStore((s) => ({ ...s, goals: { ...s.goals, [macro]: clamp(Number(e.target.value), 0, 1000) } }))} className="w-16 rounded-lg border-0 bg-white p-1 text-center text-sm" />
                        : `${today.consumed[macro]}g`}
                    </b>
                    <span className="text-[#77877b]">{editingGoals ? `${macro} goal` : `${macro} · ${pct(today.consumed[macro], goals[macro])}%`}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white pt-4 text-xs text-[#77877b]">
                {macroKeys.map((macro) => (
                  <form key={macro} className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); addMacro(macro) }}>
                    <label htmlFor={`add-${macro}`}>Add {macro}</label>
                    <div className="flex overflow-hidden rounded-lg bg-white">
                      <input id={`add-${macro}`} type="number" inputMode="numeric" placeholder="0g" value={macroDraft[macro]} onChange={(e) => setMacroDraft({ ...macroDraft, [macro]: e.target.value })} className="w-full min-w-0 border-0 bg-transparent p-2" />
                      <button type="submit" aria-label={`Add ${macro}`} className="px-1.5 text-[#ff765e] disabled:opacity-30" disabled={!Number(macroDraft[macro])}><Plus className="size-3.5" /></button>
                    </div>
                  </form>
                ))}
              </div>
            </article>

            {/* water */}
            <article className="rounded-3xl bg-[#edf8f1] p-6">
              <div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-[#4ba97a] text-white"><Droplets /></div><span className="text-xs font-black text-[#4ba97a]">{water}/{waterGoal} cups</span></div>
              <h3 className="mt-5 font-black">Hydration station</h3>
              <p className="mt-1 text-sm text-[#77877b]">{Math.min(100, pct(water, waterGoal))}% complete · {water * cupSize}oz · {plural(waterStreak)} streak</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {Array.from({ length: Math.max(waterGoal, water) }, (_, index) => (
                  <button key={index} onClick={() => setWater(index + 1 === water ? index : index + 1)} aria-label={`Set water to ${index + 1} cups`} aria-pressed={index < water} className={`grid size-7 place-items-center rounded-full transition-colors ${index < water ? 'bg-[#4ba97a] text-white' : 'bg-white text-[#c3d8c7]'}`}><Droplets className="size-3" /></button>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <label className="flex-1 text-xs font-bold text-[#39875f]">Daily goal (cups)<input type="number" min={1} max={30} value={waterGoal || ''} onChange={(e) => setStore((s) => ({ ...s, waterGoal: clamp(Number(e.target.value), 0, 30) }))} className="mt-1 w-full rounded-lg border-0 bg-white p-2" /></label>
                <label className="flex-1 text-xs font-bold text-[#39875f]">Cup size (oz)<input type="number" min={1} max={64} value={cupSize || ''} onChange={(e) => setStore((s) => ({ ...s, cupSize: clamp(Number(e.target.value), 0, 64) }))} className="mt-1 w-full rounded-lg border-0 bg-white p-2" /></label>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <button onClick={() => setWater(water + 1)} className="inline-flex items-center gap-1 text-xs font-black text-[#39875f]">Add a {cupSize}oz glass <Plus className="size-3" /></button>
                <button onClick={() => setWater(water - 1)} disabled={water === 0} className="inline-flex items-center gap-1 text-xs font-bold text-[#7aa88b] disabled:opacity-40">Undo <Minus className="size-3" /></button>
              </div>
            </article>

            {/* movement */}
            <article id="movement" className="scroll-mt-4 rounded-3xl bg-[#f3efff] p-6">
              <div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-[#8067d8] text-white"><Play className="size-4 fill-current" /></div><span className="text-xs font-black text-[#8067d8]">{minutes}/{MOVE_GOAL_MIN} min</span></div>
              <h3 className="mt-5 font-black">Move your way</h3>
              <p className="mt-1 text-sm text-[#77877b]">{minutes} minutes logged · {plural(moveStreak)} streak</p>
              <div className="mt-4 flex flex-col gap-2">
                {quickWorkouts.map((workout) => (
                  <label key={workout} className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={today.quickWorkouts.includes(workout)} onChange={() => toggleWorkout(workout)} className="size-4 accent-[#8067d8]" /> {workout}<span className="ml-auto text-xs font-normal text-[#9c91c7]">{QUICK_WORKOUT_MIN} min</span></label>
                ))}
              </div>
              <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); logActivity() }}>
                <select aria-label="Activity" value={exercise} onChange={(e) => setExercise(e.target.value)} className="min-w-0 flex-1 rounded-lg border-0 bg-white p-2 text-xs font-bold">{workoutExamples.map((item) => <option key={item}>{item}</option>)}</select>
                <input aria-label="Workout duration in minutes" type="number" min={1} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-14 rounded-lg border-0 bg-white p-2 text-xs" />
                <button type="submit" aria-label="Log activity" className="rounded-lg bg-[#8067d8] px-2.5 text-white"><Plus className="size-4" /></button>
              </form>
              {today.activities.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-xs">
                  {today.activities.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 font-bold"><Check className="size-3 text-[#8067d8]" />{a.name}<span className="ml-auto font-normal text-[#9c91c7]">{a.minutes} min</span><button aria-label={`Remove ${a.name}`} onClick={() => updateToday((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== a.id) }))} className="text-[#b5abd9] hover:text-[#8067d8]"><X className="size-3" /></button></li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>

        {/* meal log + weekly */}
        <section id="log" className="grid scroll-mt-4 gap-5 bg-[#fbfcf8] px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-16">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#edf1e9]">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff765e]">Fast meal logging</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">What did you eat?</h2></div><Utensils className="text-[#ff765e]" /></div>
            <form className="mt-5 grid gap-2 sm:grid-cols-[110px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); addMeal() }}>
              <select aria-label="Meal type" value={mealType} onChange={(e) => setMealType(e.target.value)} className="rounded-xl border-0 bg-[#fff4e9] p-3 text-sm font-bold">{mealTypes.map((meal) => <option key={meal}>{meal}</option>)}</select>
              <input aria-label="Food name" value={mealName} onChange={(e) => setMealName(e.target.value)} placeholder="Food name, e.g. banana + peanut butter" className="rounded-xl border-0 bg-[#f8fbf3] p-3 text-sm" />
              <button type="submit" aria-label="Log meal" disabled={!mealName.trim()} className="grid place-items-center rounded-xl bg-[#173b2c] px-4 py-2.5 text-white disabled:opacity-40"><Plus /></button>
            </form>
            <div className="mt-4 flex flex-col gap-2">
              {today.meals.length === 0
                ? <p className="text-sm text-[#91a095]">Quick-add a meal, or tap &ldquo;Log it&rdquo; on a recipe below to add its macros automatically.</p>
                : today.meals.map((meal) => (
                  <div key={meal.id} className="flex items-center gap-2 rounded-xl bg-[#f8fbf3] p-3 text-sm font-bold"><Check className="size-4 shrink-0 text-[#4ba97a]" /><span className="min-w-0 truncate">{meal.type}: {meal.name}</span><button aria-label={`Remove ${meal.name}`} onClick={() => updateToday((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== meal.id) }))} className="ml-auto shrink-0 text-[#b6c2b9] hover:text-[#ff765e]"><Trash2 className="size-4" /></button></div>
                ))}
            </div>
          </article>
          <article className="rounded-3xl bg-[#173b2c] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b8d5b8]">Weekly progress</p>
            <h2 className="mt-2 text-2xl font-black">Your tiny wins add up.</h2>
            <div className="mt-6 grid grid-cols-4 gap-3 text-center text-xs">
              {([['Water', week.water, '#4ba97a'], ['Macros', week.macros, '#ff765e'], ['Move', week.move, '#8067d8'], ['Calories', week.calories, '#f7c96b']] as const).map(([label, count, color]) => (
                <div key={label}>
                  <div className="flex h-20 items-end justify-center"><div className="w-5 rounded-t-full transition-all" style={{ height: `${Math.max(6, (count / 7) * 100)}%`, background: color, opacity: count ? 1 : 0.35 }} /></div>
                  <span>{label}</span><span className="block text-[10px] text-[#b8d5b8]">{count}/7</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-white/10 p-3 text-sm font-bold">{weekTotal === 0 ? 'Log your first win today. The bars fill as you hit your goals.' : `You hit ${weekTotal} of 28 daily goals in the last 7 days.`}</div>
          </article>
        </section>

        {/* recipes */}
        <section id="recipes" className="scroll-mt-4 bg-[#fbfcf8] px-6 pb-10 sm:px-10 lg:px-16">
          <div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#4ba97a]">Affordable meal ideas</p><h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">5-minute fuel.</h2></div><span className="hidden rounded-full bg-[#edf8f1] px-4 py-2 text-xs font-black text-[#4ba97a] sm:block">Student-budget friendly</span></div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {recipes.map((recipe) => (
              <article key={recipe.title} className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#edf1e9]">
                <div className="h-40 overflow-hidden bg-[#eef4ea]"><img src={recipe.image} alt={recipe.title} loading="lazy" className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between"><h3 className="font-black">{recipe.title}</h3><span className="rounded-full bg-[#fff2ed] px-2.5 py-1 text-[10px] font-black text-[#ff765e]">{recipe.cost}</span></div>
                  <p className="mt-2 text-sm text-[#77877b]">{recipe.detail}</p>
                  <div className="mt-4 flex gap-2 text-[11px] font-bold text-[#4ba97a]"><span className="rounded-full bg-[#edf8f1] px-2 py-1">{recipe.time}</span><span className="rounded-full bg-[#fff4e9] px-2 py-1">{recipe.calories} kcal</span><span className="rounded-full bg-[#f3efff] px-2 py-1">{recipe.protein}g protein</span></div>
                  <button onClick={() => addRecipe(recipe)} className="mt-4 inline-flex items-center gap-1 self-start text-xs font-black text-[#ff765e] hover:underline">Log it <Plus className="size-3" /></button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* reflection + streaks */}
        <section className="grid gap-5 border-t border-[#e8eee5] px-6 py-10 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-16">
          <article className="rounded-3xl bg-[#fff4e9] p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff765e]">Daily reflection</p>
            <h2 className="mt-2 text-2xl font-black">How are you feeling?</h2>
            {(['energy', 'mood', 'stress'] as const).map((item) => (
              <label key={item} className="mt-4 flex items-center justify-between text-sm font-bold capitalize">{item}<input aria-label={`${item} level`} type="range" min="1" max="5" value={today.reflection[item]} onChange={(e) => updateToday((d) => ({ ...d, reflection: { ...d.reflection, [item]: Number(e.target.value) } }))} className="mx-3 accent-[#ff765e]" /><span className="grid size-7 place-items-center rounded-full bg-white text-xs">{today.reflection[item]}</span></label>
            ))}
            <p className="mt-5 text-xs leading-5 text-[#77877b]">{reflectionTip}</p>
          </article>
          <article className="rounded-3xl bg-[#edf8f1] p-6">
            <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#4ba97a] text-white"><Sparkles /></div><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#4ba97a]">Your streak shelf</p><h2 className="mt-1 text-2xl font-black">Keep the momentum.</h2></div></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {([[waterStreak, 'Water goal'], [moveStreak, 'Move goal'], [macroStreak, 'Macro goal']] as const).map(([n, label]) => (
                <div key={label} className="rounded-2xl bg-white p-4"><p className="text-2xl font-black">{plural(n)}</p><p className="mt-1 text-xs font-bold text-[#77877b]">{label}</p></div>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[#39875f]"><CheckCircle2 className="size-4" /> {waterStreak + moveStreak + macroStreak > 0 ? "You're building a sustainable rhythm." : 'Hit any goal today to start a streak.'}</p>
          </article>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[#e8eee5] px-6 py-7 text-sm text-[#87988c] sm:flex-row sm:items-center sm:justify-between sm:px-10"><span className="flex items-center gap-2 font-black text-[#173b2c]"><Utensils className="size-4 text-[#ff765e]" /> thrive. for better everyday energy.</span><span>Your data stays on this device.</span></footer>
      </div>
    </main>
  )
}
