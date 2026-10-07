import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import fitlifeLogo from './assets/fitlife-logo.png'
import { ExerciseAnimation } from './ExerciseAnimation'
import './App.css'

type Goal =
  | 'Weight Loss'
  | 'Muscle Building'
  | 'General Fitness'
  | 'Strength'
  | 'Flexibility'
  | 'Endurance'

type Experience = 'Beginner' | 'Intermediate' | 'Advanced'
type DurationOption = 5 | 10 | 20 | 30 | 45 | 60
type WorkoutPreference = 'Balanced' | 'Strength' | 'Cardio' | 'Mobility'
type Equipment = 'NO EQUIPMENT' | 'BASIC EQUIPMENT' | 'FULL EQUIPMENT'
type ReminderPeriod = 'Morning' | 'Afternoon' | 'Evening' | 'Custom'
type JourneyDayStatus = 'rest' | 'missed'
type JourneyDay = {
  date: Date
  item?: HistoryItem
  key: string
  isToday: boolean
  dayNumber: number
  state: 'rest' | 'missed' | 'unrecorded' | 'upcoming' | 'today' | 'completed' | 'recovery' | 'in-progress'
}

type Exercise = {
  name: string
  detail: string
  reps?: string
  time?: string
  rest?: string
  target?: string
  difficulty?: string
  instructions?: string
}

type Difficulty = 'Easy' | 'Moderate' | 'Hard'
type JourneyRegion = 'Chest' | 'Arms' | 'Core' | 'Legs' | 'Back'
type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'responding' | 'error'
type VoiceAction =
  | 'GENERATE_WORKOUT'
  | 'ADAPT_WORKOUT'
  | 'RECOVERY_MODE'
  | 'SHOW_HISTORY'
  | 'SHOW_PROGRESS'
  | 'SHOW_JOURNEY'
  | 'SHOW_FORM'
  | 'TIME_LEFT'
  | 'REPLACE_EXERCISE'
  | 'START_WORKOUT'
  | 'PAUSE_WORKOUT'
  | 'RESUME_WORKOUT'
  | 'SKIP_EXERCISE'
  | 'SHOW_PROFILE'

type SpeechRecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionErrorEvent = {
  error: string
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type Workout = {
  id: string
  title: string
  goal: Goal
  duration: number
  experience: Experience
  difficulty?: Difficulty
  rationale: string
  summary: string
  coachMessage?: string
  warmup: Exercise[]
  main: Exercise[]
  exercises?: Exercise[]
  cooldown: Exercise[]
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type UserProfile = {
  name: string
  email: string
  age: number
  goal: Goal
  experience: Experience
  duration: DurationOption
  preferences: string
  workoutPreference?: WorkoutPreference
  password: string
  equipment?: Equipment
  challengeStartDate?: string | null
  reminderEnabled?: boolean
  reminderPeriod?: ReminderPeriod
  reminderTime?: string
  challengeDayNotes?: Record<string, JourneyDayStatus>
}

type HistoryItem = {
  id: string
  date: string
  title: string
  goal: Goal
  duration: number
  completed: boolean
  difficulty?: Difficulty
  feedback?: 'Easy' | 'Good' | 'Hard'
  exercisesCompleted?: number
  workout?: Workout
}

type UserRecord = {
  email: string
  password: string
  profile: UserProfile
  workout: Workout | null
  messages: ChatMessage[]
  history: HistoryItem[]
}

const GOALS: Goal[] = [
  'Weight Loss',
  'Muscle Building',
  'General Fitness',
  'Strength',
  'Flexibility',
  'Endurance',
]

const EXPERIENCES: Experience[] = ['Beginner', 'Intermediate', 'Advanced']
const DURATIONS: DurationOption[] = [5, 10, 20, 30, 45, 60]
const WORKOUT_PREFERENCES: WorkoutPreference[] = ['Balanced', 'Strength', 'Cardio', 'Mobility']
const EQUIPMENT_OPTIONS: Equipment[] = ['NO EQUIPMENT', 'BASIC EQUIPMENT', 'FULL EQUIPMENT']
const REMINDER_PERIODS: ReminderPeriod[] = ['Morning', 'Afternoon', 'Evening', 'Custom']
const USERS_KEY = 'fitflow-users'
const SESSION_KEY = 'fitflow-session'

const defaultProfile = (email = '', password = ''): UserProfile => ({
  name: '',
  email,
  age: 25,
  goal: 'General Fitness',
  experience: 'Beginner',
  duration: 30,
  preferences: '',
  workoutPreference: 'Balanced',
  password,
  equipment: 'NO EQUIPMENT',
  challengeStartDate: null,
  reminderEnabled: false,
  reminderPeriod: 'Evening',
  reminderTime: '19:00',
  challengeDayNotes: {},
})

const makeWorkoutId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const getExerciseSeconds = (exercise?: Exercise) => {
  if (!exercise) return 45
  const formattedTime = exercise.time?.match(/^(\d+):(\d{2})$/)
  if (formattedTime) return Number(formattedTime[1]) * 60 + Number(formattedTime[2])
  const duration = `${exercise.time ?? ''} ${exercise.detail}`.match(/(\d+)\s*(minutes?|mins?|seconds?|secs?)\b/i)
  if (!duration) return 45
  return Number(duration[1]) * (/min/i.test(duration[2]) ? 60 : 1)
}

const getExerciseRepTarget = (exercise?: Exercise) => {
  if (!exercise) return 0
  const value = `${exercise.reps ?? ''} ${exercise.detail}`
  if (!/\breps?\b|\/(?:side|leg)|per side/i.test(value)) return 0
  const sides = /\/(?:side|leg)|per side/i.test(value) ? 2 : 1
  const sets = value.match(/(\d+)\s*[x×]\s*(\d+)/i)
  if (sets) return Number(sets[1]) * Number(sets[2]) * sides
  const reps = value.match(/(\d+)\s*(?:reps?|each|per side|\/side)/i)
  return reps ? Number(reps[1]) * sides : 0
}

const getExerciseGuidance = (exercise?: Exercise) => {
  const name = exercise?.name.toLowerCase() ?? ''
  if (/push.?up/.test(name)) return {
    target: 'Chest · shoulders · core',
    tips: ['Keep your body in one straight line.', 'Lower with control, then press the floor away.'],
    mistake: 'Letting the hips sag or lifting them too high.',
    breathing: 'Inhale as you lower; exhale as you press up.',
    easier: 'Wall push-up or knee push-up',
    progress: 'Slow the lowering phase or try a lower hand support.',
  }
  if (/squat|lunge|wall sit/.test(name)) return {
    target: 'Legs · glutes · core',
    tips: ['Keep your chest comfortable and upright.', 'Let knees track in line with your toes.'],
    mistake: 'Knees collapsing inward as you lower.',
    breathing: 'Inhale as you lower; exhale as you stand.',
    easier: 'Chair squat or supported split stance',
    progress: 'Add a pause at the bottom while keeping control.',
  }
  if (/plank|mountain climber|shoulder tap/.test(name)) return {
    target: 'Core · shoulders',
    tips: ['Brace gently and keep your hips steady.', 'Use a range you can control.'],
    mistake: 'Holding your breath or letting the lower back dip.',
    breathing: 'Keep breathing smoothly throughout the movement.',
    easier: 'Place your hands on a sturdy elevated surface.',
    progress: 'Slow each repetition and keep your body stable.',
  }
  if (/arm circle|band pull|curl|press|row/.test(name)) return {
    target: 'Shoulders · upper body',
    tips: ['Keep shoulders relaxed and ribs comfortably stacked.', 'Use a smooth, controlled range.'],
    mistake: 'Shrugging the shoulders or swinging through the movement.',
    breathing: 'Breathe steadily; exhale through the effort.',
    easier: 'Use a smaller range and lighter resistance.',
    progress: 'Pause briefly at the controlled end of each repetition.',
  }
  if (/march|walk|step|jack|jump|fast feet|burpee|skater|high knee/.test(name)) return {
    target: 'Full body · coordination',
    tips: ['Choose a pace where you can stay balanced.', 'Land softly and keep the movement comfortable.'],
    mistake: 'Rushing or landing heavily.',
    breathing: 'Keep breathing evenly and slow down if needed.',
    easier: 'March or step without jumping.',
    progress: 'Build pace gradually while keeping landings quiet.',
  }
  if (/stretch|mobility|cat.?cow|breathing/.test(name)) return {
    target: 'Mobility · comfortable range',
    tips: ['Move slowly and stay within a comfortable range.', 'Relax your shoulders and jaw.'],
    mistake: 'Forcing the stretch or bouncing at the end range.',
    breathing: 'Use slow, relaxed breaths.',
    easier: 'Reduce the range and stay seated if that feels better.',
    progress: 'Pause gently at a comfortable end range.',
  }
  return {
    target: exercise?.target && !/weight loss|muscle building|general fitness|strength|flexibility|endurance/i.test(exercise.target)
      ? exercise.target
      : 'Full body · movement quality',
    tips: [exercise?.instructions ?? exercise?.detail ?? 'Move smoothly and stay in control.', 'Choose a comfortable range of motion.'],
    mistake: 'Rushing the movement or holding your breath.',
    breathing: 'Breathe steadily; exhale through the effort.',
    easier: 'Slow down or reduce the range of motion.',
    progress: 'Add a little range or controlled tempo if it feels comfortable.',
  }
}

const getExerciseAlternatives = (exercise?: Exercise): Exercise[] => {
  const name = exercise?.name.toLowerCase() ?? ''
  if (/push.?up/.test(name)) return [
    { name: 'Wall push-up', detail: '8–12 controlled reps', target: 'Chest', difficulty: 'Easy', instructions: 'Stand facing a wall and press away gently.' },
    { name: 'Knee push-up', detail: '6–10 controlled reps', target: 'Chest', difficulty: 'Easy', instructions: 'Keep a straight line from knees through shoulders.' },
    { name: 'Incline push-up', detail: '8–12 controlled reps', target: 'Chest', difficulty: 'Moderate', instructions: 'Use a stable elevated surface for your hands.' },
  ]
  if (/squat|lunge|wall sit/.test(name)) return [
    { name: 'Chair squat', detail: '8–12 controlled reps', target: 'Legs · glutes', difficulty: 'Easy', instructions: 'Sit back toward a stable chair, then stand.' },
    { name: 'Glute bridge', detail: '10–12 controlled reps', target: 'Glutes', difficulty: 'Easy', instructions: 'Lie comfortably and lift your hips without arching.' },
    { name: 'Supported reverse lunge', detail: '6 reps per side', target: 'Legs', difficulty: 'Moderate', instructions: 'Hold a stable support and step back a comfortable distance.' },
  ]
  if (/plank|mountain climber|shoulder tap/.test(name)) return [
    { name: 'Wall plank hold', detail: '20–30 sec', time: '00:30', target: 'Core', difficulty: 'Easy', instructions: 'Lean into a wall with a steady body line.' },
    { name: 'Bird dog', detail: '6 reps per side', target: 'Core · back', difficulty: 'Easy', instructions: 'Extend opposite arm and leg slowly from hands and knees.' },
    { name: 'Dead bug', detail: '8 controlled reps', target: 'Core', difficulty: 'Moderate', instructions: 'Move opposite arm and leg while keeping your back comfortable.' },
  ]
  return [
    { name: 'Easy march in place', detail: '30 sec', time: '00:30', target: 'Full body', difficulty: 'Easy', instructions: 'March at a comfortable pace with relaxed arms.' },
    { name: 'Standing mobility flow', detail: '30 sec', time: '00:30', target: 'Mobility', difficulty: 'Easy', instructions: 'Move gently through a comfortable range.' },
    { name: 'Low-impact step touch', detail: '30 sec', time: '00:30', target: 'Full body', difficulty: 'Easy', instructions: 'Step side to side without jumping.' },
  ]
}

const getJourneyDays = (
  history: HistoryItem[],
  challengeStartDate?: string | null,
  notes: Record<string, JourneyDayStatus> = {},
) => Array.from({ length: 30 }, (_, index) => {
  const date = challengeStartDate ? parseLocalDay(challengeStartDate) : new Date()
  date.setHours(0, 0, 0, 0)
  if (!challengeStartDate) date.setDate(date.getDate() - 29)
  date.setDate(date.getDate() + index)
  const dayKey = getLocalDayKey(date)
  const item = history.find((entry) => getLocalDayKey(entry.date) === dayKey)
  const isToday = dayKey === getTodayKey()
  const today = parseLocalDay(getTodayKey())
  const hasStarted = Boolean(challengeStartDate)
  const state: JourneyDay['state'] = item
    ? item.title.toLowerCase().includes('rest day') ? 'rest'
      : item.title.toLowerCase().includes('recovery') && item.completed ? 'recovery'
        : item.completed ? 'completed' : 'in-progress'
    : isToday ? 'today'
      : hasStarted && date > today ? 'upcoming'
        : notes[dayKey] === 'rest' || notes[dayKey] === 'missed' ? notes[dayKey] : 'unrecorded'
  return {
    date,
    item,
    key: dayKey,
    isToday,
    dayNumber: index + 1,
    state,
  }
})

const enrichWorkout = (workout: Workout): Workout => {
  const prepare = (items: Exercise[]) =>
    items.map((exercise) => ({
      ...exercise,
      detail: workout.experience === 'Beginner' || workout.difficulty === 'Easy'
        ? exercise.detail.replace(/(\d+)\s+(?:easy\s+)?rounds?(?:\s+at\s+easy\s+paces?)?/i, '$1 easy rounds')
        : exercise.detail,
      rest: exercise.rest ?? '15 sec',
      target: exercise.target ?? workout.goal,
      difficulty: exercise.difficulty ?? workout.difficulty ?? 'Moderate',
      instructions: exercise.instructions ?? exercise.detail,
    }))
  const main = prepare(workout.main?.length ? workout.main : workout.exercises ?? [])
  return {
    ...workout,
    main,
    exercises: main,
    warmup: prepare(workout.warmup),
    cooldown: prepare(workout.cooldown),
    coachMessage: workout.coachMessage ?? workout.rationale,
  }
}

const getExerciseCounts = (duration: number) => ({
  warmup: duration <= 10 ? 1 : duration <= 20 ? 2 : 3,
  main: duration <= 5 ? 2 : duration <= 10 ? 3 : 4,
  cooldown: duration <= 10 ? 1 : duration <= 20 ? 2 : 3,
})

const formatWorkoutTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const timeExercises = (items: Exercise[], totalSeconds: number) => {
  if (!items.length) return []
  const baseSeconds = Math.floor(totalSeconds / items.length)
  const remainder = totalSeconds % items.length
  return items.map((exercise, index) => {
    const seconds = baseSeconds + (index < remainder ? 1 : 0)
    const time = formatWorkoutTime(seconds)
    const detail = exercise.reps ?? exercise.detail.replace(/ · \d+:\d{2} timed block$/, '')
    return {
      ...exercise,
      time,
      detail: `${detail} · ${time} timed block`,
    }
  })
}

const fitWorkoutToDuration = (workout: Workout): Workout => {
  const counts = getExerciseCounts(workout.duration)
  const warmup = workout.warmup.slice(0, counts.warmup)
  const main = (workout.main.length ? workout.main : workout.exercises ?? []).slice(0, counts.main)
  const cooldown = workout.cooldown.slice(0, counts.cooldown)
  const totalSeconds = workout.duration * 60
  const warmupSeconds = Math.round(totalSeconds * 0.15)
  const cooldownSeconds = Math.round(totalSeconds * 0.15)
  const mainRestSeconds = Math.max(0, main.length - 1) * 15
  const mainSeconds = totalSeconds - warmupSeconds - cooldownSeconds - mainRestSeconds

  return {
    ...workout,
    warmup: timeExercises(warmup, warmupSeconds),
    main: timeExercises(main, mainSeconds),
    cooldown: timeExercises(cooldown, cooldownSeconds),
  }
}

const pickWorkoutPlan = (
  goal: Goal,
  duration: number,
  experience: Experience,
  preferences = '',
  equipment: Equipment = 'NO EQUIPMENT',
  workoutPreference: WorkoutPreference = 'Balanced',
) => {
  const planMap: Record<
    Goal,
    {
      warmup: Exercise[]
      main: Exercise[]
      cooldown: Exercise[]
      rationale: string
    }
  > = {
    'Weight Loss': {
      warmup: [
        { name: 'Jumping jacks', detail: '30 sec', time: '00:30' },
        { name: 'Bodyweight squat to reach', detail: '10 reps', reps: '10 reps' },
        { name: 'High knees', detail: '20 sec', time: '00:20' },
      ],
      main: [
        { name: 'Alternating reverse lunges', detail: '3 rounds', reps: '3 x 10/leg' },
        { name: 'Mountain climbers', detail: '2 rounds', reps: '2 x 20 sec' },
        { name: 'Burpees', detail: '2 rounds', reps: '2 x 8' },
        { name: 'Fast feet', detail: '30 sec', time: '00:30' },
      ],
      cooldown: [
        { name: 'Standing quad stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Hip flexor stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Deep breathing', detail: '60 sec', time: '01:00' },
      ],
      rationale:
        'This plan prioritizes momentum, full-body calorie burn, and lower-body conditioning to help you hit your weight-loss goal without overloading your joints.',
    },
    'Muscle Building': {
      warmup: [
        { name: 'Arm circles', detail: '30 sec', time: '00:30' },
        { name: 'Band pull-aparts', detail: '12 reps', reps: '12 reps' },
        { name: 'Bodyweight squats', detail: '12 reps', reps: '12 reps' },
      ],
      main: [
        { name: 'Goblet squat', detail: '3 rounds', reps: '3 x 10' },
        { name: 'Dumbbell row', detail: '3 rounds', reps: '3 x 12' },
        { name: 'Push-ups', detail: '2 rounds', reps: '2 x 10' },
        { name: 'Overhead press', detail: '2 rounds', reps: '2 x 8' },
      ],
      cooldown: [
        { name: 'Chest stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Lat stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Foam roll calves', detail: '45 sec', time: '00:45' },
      ],
      rationale:
        'The session balances strength stimulus with controlled volume so you build muscle while staying within your time window and recovery capacity.',
    },
    'General Fitness': {
      warmup: [
        { name: 'March in place', detail: '30 sec', time: '00:30' },
        { name: 'Torso twists', detail: '10 reps/side', reps: '10/side' },
        { name: 'Cat-cow', detail: '8 reps', reps: '8 reps' },
      ],
      main: [
        { name: 'Bodyweight squat', detail: '3 rounds', reps: '3 x 12' },
        { name: 'Step-ups', detail: '2 rounds', reps: '2 x 10/leg' },
        { name: 'Incline push-up', detail: '2 rounds', reps: '2 x 10' },
        { name: 'Plank shoulder taps', detail: '2 rounds', reps: '2 x 20 taps' },
      ],
      cooldown: [
        { name: 'Hamstring stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Chest opener', detail: '30 sec', time: '00:30' },
        { name: 'Breathing reset', detail: '60 sec', time: '01:00' },
      ],
      rationale:
        'This keeps your routine balanced and sustainable, blending strength, mobility, and heart-rate elevation to improve whole-body fitness.',
    },
    Strength: {
      warmup: [
        { name: 'Light row', detail: '15 reps', reps: '15 reps' },
        { name: 'Goblet squat hold', detail: '20 sec', time: '00:20' },
        { name: 'Hip hinge', detail: '12 reps', reps: '12 reps' },
      ],
      main: [
        { name: 'Deadlift pattern', detail: '4 rounds', reps: '4 x 8' },
        { name: 'Bench or push-up', detail: '4 rounds', reps: '4 x 8' },
        { name: 'Split squat', detail: '3 rounds', reps: '3 x 8/leg' },
        { name: 'Farmer carry', detail: '3 rounds', reps: '3 x 20 sec' },
      ],
      cooldown: [
        { name: 'Glute stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Upper-back stretch', detail: '30 sec', time: '00:30' },
        { name: 'Recovery walk', detail: '90 sec', time: '01:30' },
      ],
      rationale:
        'This routine focuses on major compound patterns to build force production and muscular coordination in a compact, high-return session.',
    },
    Flexibility: {
      warmup: [
        { name: 'Neck circles', detail: '30 sec', time: '00:30' },
        { name: 'Ankle rolls', detail: '10/side', reps: '10/side' },
        { name: 'World’s greatest stretch', detail: '8 reps', reps: '8 reps' },
      ],
      main: [
        { name: 'Standing hamstring fold', detail: '30 sec/side', time: '00:30' },
        { name: 'Hip flexor stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Seated forward fold', detail: '45 sec', time: '00:45' },
        { name: 'Thoracic rotation', detail: '10 reps/side', reps: '10/side' },
      ],
      cooldown: [
        { name: 'Child’s pose', detail: '60 sec', time: '01:00' },
        { name: 'Calf stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Deep breathing', detail: '60 sec', time: '01:00' },
      ],
      rationale:
        'Your session is tuned toward mobility, recovery, and improved range of motion so you gain flexibility without stressing tight tissues.',
    },
    Endurance: {
      warmup: [
        { name: 'Fast march', detail: '30 sec', time: '00:30' },
        { name: 'Dynamic lunges', detail: '10 reps', reps: '10 reps' },
        { name: 'Skaters', detail: '10 reps/side', reps: '10/side' },
      ],
      main: [
        { name: 'Alternating jump rope', detail: '45 sec', time: '00:45' },
        { name: 'High knees', detail: '40 sec', time: '00:40' },
        { name: 'Fast bodyweight circuit', detail: '3 rounds', reps: '3 x 30 sec' },
        { name: 'Row or bike sprint', detail: '2 rounds', reps: '2 x 40 sec' },
      ],
      cooldown: [
        { name: 'Walk and breathe', detail: '60 sec', time: '01:00' },
        { name: 'Shin stretch', detail: '30 sec/side', time: '00:30' },
        { name: 'Calf release', detail: '30 sec/side', time: '00:30' },
      ],
      rationale:
        'This plan keeps the intensity sustainable while building stamina through repeat intervals, making it ideal for endurance without excessive strain.',
    },
  }

  const styleGoal: Goal = workoutPreference === 'Strength'
    ? 'Strength'
    : workoutPreference === 'Cardio'
      ? 'Endurance'
      : workoutPreference === 'Mobility'
        ? 'Flexibility'
        : goal
  const stylePlan = planMap[styleGoal]
  const intensityAdjustments = {
    Beginner: {
      main: stylePlan.main.map((exercise) => ({
        ...exercise,
        detail: /round/i.test(exercise.detail)
          ? exercise.detail.replace(/(\d+)\s+(?:easy\s+)?rounds?(?:\s+at\s+easy\s+paces?)?/i, '$1 easy rounds')
          : exercise.detail,
      })),
    },
    Intermediate: {
      main: stylePlan.main,
    },
    Advanced: {
      main: stylePlan.main.map((exercise, index) => ({
        ...exercise,
        detail: index < 2 ? `${exercise.detail} + tempo` : exercise.detail,
      })),
    },
  }

  const chosen = intensityAdjustments[experience] ?? intensityAdjustments.Beginner
  const preferenceText = preferences.toLowerCase()
  const equipmentFree = equipment === 'NO EQUIPMENT' || /no equipment|bodyweight|home only/.test(preferenceText)
  const lowImpact = /low[\s-]impact/.test(preferenceText)
  const adaptExercise = (exercise: Exercise): Exercise => {
    let name = exercise.name
    if (equipmentFree) {
      if (/dumbbell row|band row/i.test(name)) name = 'Prone Y-T raise'
      else if (/band pull-aparts|light row/i.test(name)) name = 'Arm circles'
      else if (/goblet squat/i.test(name)) name = 'Tempo bodyweight squat'
      else if (/resistance band squat/i.test(name)) name = 'Bodyweight squat'
      else if (/bench press|dumbbell press/i.test(name)) name = 'Incline push-up'
      else if (/overhead press/i.test(name)) name = 'Wall push-up'
      else if (/deadlift pattern/i.test(name)) name = 'Hip hinge'
      else if (/farmer carry/i.test(name)) name = 'Marching hold'
      else if (/bench or push-up/i.test(name)) name = 'Incline push-up'
    } else if (equipment === 'BASIC EQUIPMENT') {
      if (/goblet squat/i.test(name)) name = 'Resistance band squat'
      else if (/dumbbell row/i.test(name)) name = 'Resistance band row'
      else if (/bench press/i.test(name)) name = 'Dumbbell floor press'
      else if (/deadlift pattern/i.test(name)) name = 'Dumbbell hip hinge'
    } else if (equipment === 'FULL EQUIPMENT') {
      if (/bodyweight squat/i.test(name)) name = 'Goblet squat'
      else if (/step-ups/i.test(name)) name = 'Dumbbell step-ups'
      else if (/incline push-up|wall push-up/i.test(name)) name = 'Bench press'
      else if (/prone y-t raise/i.test(name)) name = 'Dumbbell row'
    }
    if (experience === 'Beginner') {
      if (/burpees/i.test(name)) name = 'Squat-to-reach'
      else if (/jumping jacks/i.test(name)) name = 'Step jacks'
      else if (/high knees/i.test(name)) name = 'March in place'
      else if (/jump rope/i.test(name)) name = 'Brisk march'
      else if (/alternating reverse lunges/i.test(name)) name = 'Supported reverse lunge'
    }
    if (lowImpact) {
      if (/jumping jacks/i.test(name)) name = 'Step jacks'
      else if (/high knees/i.test(name)) name = 'Standing knee drives'
      else if (/mountain climbers/i.test(name)) name = 'Elevated mountain climbers'
      else if (/burpees/i.test(name)) name = 'Squat-to-reach'
      else if (/skaters/i.test(name)) name = 'Lateral step and reach'
      else if (/jump rope|sprint/i.test(name)) name = 'Brisk low-impact march'
    }
    return name === exercise.name ? exercise : { ...exercise, name }
  }

  const counts = getExerciseCounts(duration)
  const main = chosen.main.slice(0, counts.main).map(adaptExercise)
  const styleLabel = workoutPreference === 'Balanced' ? 'balanced' : `${workoutPreference.toLowerCase()}-focused`
  const workout = {
    id: makeWorkoutId(),
    title: `${goal} flow`,
    goal,
    duration,
    experience,
    difficulty: experience === 'Beginner' ? 'Easy' : experience === 'Advanced' ? 'Hard' : 'Moderate',
    rationale: `${planMap[goal].rationale}${equipmentFree ? ' Exercises are adapted for bodyweight training.' : equipment === 'BASIC EQUIPMENT' ? ' Exercises use basic bands or light weights where useful.' : ' Exercises use available full gym equipment where appropriate.'}${lowImpact || experience === 'Beginner' ? ' Higher-impact movements are adapted to lower-impact alternatives.' : ''}`,
    summary: `${goal} • ${duration} min • ${experience}`,
    coachMessage: `Personalized for your ${goal.toLowerCase()} goal, ${duration}-minute availability, ${experience.toLowerCase()} experience, ${styleLabel} preference, and ${equipment.toLowerCase().replaceAll('_', ' ')}.`,
    warmup: stylePlan.warmup.slice(0, counts.warmup).map(adaptExercise),
    main,
    cooldown: stylePlan.cooldown.slice(0, counts.cooldown).map(adaptExercise),
  } satisfies Workout

  return enrichWorkout(fitWorkoutToDuration(workout))
}

const generateProfilePlan = (
  profile: UserProfile,
  duration: number = profile.duration,
  experience = profile.experience,
  goal = profile.goal,
) => pickWorkoutPlan(
  goal,
  duration,
  experience,
  profile.preferences,
  profile.equipment ?? 'NO EQUIPMENT',
  profile.workoutPreference ?? 'Balanced',
)

const normalizeWorkoutEquipment = (workout: Workout, equipment: Equipment): Workout => {
  if (equipment === 'FULL EQUIPMENT') return workout
  const adapt = (exercise: Exercise): Exercise => {
    let name = exercise.name
    if (equipment === 'NO EQUIPMENT') {
      if (/bench press|machine press|dumbbell press|barbell press/i.test(name)) name = 'Incline push-up'
      else if (/dumbbell|barbell|kettlebell|goblet|resistance band|band row|band pull/i.test(name)) {
        name = /row|pull/i.test(name) ? 'Prone Y-T raise'
          : /squat/i.test(name) ? 'Bodyweight squat'
            : /press/i.test(name) ? 'Wall push-up'
              : /carry/i.test(name) ? 'Marching hold' : 'Bodyweight movement'
      }
    } else if (/barbell|machine|bench press/i.test(name)) {
      name = /squat/i.test(name) ? 'Resistance band squat'
        : /row/i.test(name) ? 'Resistance band row'
          : 'Dumbbell floor press'
    }
    return name === exercise.name
      ? exercise
      : { ...exercise, name, instructions: `Equipment-adapted option: ${name}. ${exercise.instructions ?? exercise.detail}` }
  }
  return {
    ...workout,
    warmup: workout.warmup.map(adapt),
    main: workout.main.map(adapt),
    exercises: (workout.exercises ?? workout.main).map(adapt),
    cooldown: workout.cooldown.map(adapt),
  }
}

const initialAssistantMessage = (profile: UserProfile) => ({
  id: makeWorkoutId(),
  role: 'assistant' as const,
  text: `Hi ${profile.name || 'there'} — I’m Flexora. I can build a ${profile.goal.toLowerCase()} session that fits your ${profile.duration}-minute window and ${profile.experience.toLowerCase()} level.`,
})

const readUsers = (): UserRecord[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? (JSON.parse(raw) as UserRecord[]) : []
  } catch {
    return []
  }
}

const writeStoredValue = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const writeUsers = (users: UserRecord[]) => {
  return writeStoredValue(USERS_KEY, users)
}

const readUserData = (email: string | null): Partial<UserRecord> => {
  if (!email) return {}

  try {
    const raw = localStorage.getItem(`fitflow-user-${email}`)
    return raw ? (JSON.parse(raw) as Partial<UserRecord>) : {}
  } catch {
    return {}
  }
}

const writeUserData = (email: string, data: Partial<UserRecord>) => {
  return writeStoredValue(`fitflow-user-${email}`, data)
}

const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as { email: string | null }) : { email: null }
  } catch {
    return { email: null }
  }
}

const writeSession = (email: string | null) => {
  return writeStoredValue(SESSION_KEY, { email })
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const getSuggestedPrompts = (goal: Goal) => [
  'Today’s Workout',
  '10 Min Workout',
  'Make It Easier',
  'Recovery Mode',
  `Focus on ${goal === 'Weight Loss' ? 'legs' : 'abs'}`,
  'My Progress',
]

const parseDurationFromText = (text: string): number | null => {
  const match = text.match(/\b(\d+)\s*(?:minutes?|mins?)\b/)
  const value = match ? Number(match[1]) : null

  return value && value >= 5 && value <= 120 ? value : null
}

const isWorkout = (value: unknown): value is Workout => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Workout>
  const validExercises = (items: unknown) =>
    Array.isArray(items) &&
    items.every((item) => item && typeof item === 'object' && typeof (item as Exercise).name === 'string')

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.goal === 'string' &&
    GOALS.includes(candidate.goal as Goal) &&
    typeof candidate.duration === 'number' &&
    candidate.duration >= 5 &&
    candidate.duration <= 120 &&
    validExercises(candidate.warmup) &&
    validExercises(candidate.main ?? candidate.exercises) &&
    validExercises(candidate.cooldown)
  )
}

type CoachRequest = {
  message: string
  requestedDuration: number
  profile: {
    name: string
    age: number
    goal: Goal
    experience: Experience
    preferredDuration: DurationOption
    preferredWorkoutType: WorkoutPreference
    preferences: string
    equipment: Equipment
  }
  currentWorkout: Workout | null
  history: HistoryItem[]
  conversation: ChatMessage[]
}

const requestFitFlowAi = async (endpoint: string, request: CoachRequest) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`)
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || typeof (payload as { text?: unknown }).text !== 'string') {
      throw new Error('AI endpoint returned an invalid response')
    }
    const result = payload as { text: string; workout?: unknown }
    return result
  } finally {
    window.clearTimeout(timeout)
  }
}

const getLocalDayKey = (date: string | Date) => {
  const value = new Date(date)
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

const parseLocalDay = (dayKey: string) => {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const getTodayKey = () => getLocalDayKey(new Date())

const challengeDayNumber = (startDate?: string | null) => {
  if (!startDate) return null
  const start = parseLocalDay(startDate)
  const today = parseLocalDay(getTodayKey())
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const difference = Math.floor((utcToday - utcStart) / 86400000)
  return difference < 0 ? null : Math.min(30, difference + 1)
}

const countCurrentStreak = (history: HistoryItem[]) => {
  const completedDays = new Set(history.filter((item) => item.completed).map((item) => getLocalDayKey(item.date)))
  const today = new Date()
  let streak = 0
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!completedDays.has(getLocalDayKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  while (completedDays.has(getLocalDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

const getHistorySummary = (history: HistoryItem[]) => {
  const completed = history.filter((item) => item.completed)
  const totalMinutes = completed.reduce((total, item) => total + item.duration, 0)
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const thisWeek = completed.filter((item) => new Date(item.date) >= weekStart).length
  const previousWeekStart = new Date(weekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const previousWeek = completed.filter((item) => {
    const date = new Date(item.date)
    return date >= previousWeekStart && date < weekStart
  }).length
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thisMonth = completed.filter((item) => new Date(item.date) >= monthStart).length
  return {
    completed,
    totalMinutes,
    thisWeek,
    previousWeek,
    thisMonth,
    averageMinutes: completed.length ? Math.round(totalMinutes / completed.length) : 0,
    streak: countCurrentStreak(history),
    completionRate: history.length ? Math.round((completed.length / history.length) * 100) : 0,
  }
}

const getAdaptiveScores = (_history: HistoryItem[], progress: ReturnType<typeof getHistorySummary>) => {
  const recent = [...progress.completed].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
  const difficultyValue = (item: HistoryItem) => item.feedback === 'Hard' || item.difficulty === 'Hard' ? 2
    : item.feedback === 'Easy' || item.difficulty === 'Easy' ? 0 : 1
  const hardCount = recent.filter((item) => difficultyValue(item) === 2).length
  const easyCount = recent.filter((item) => difficultyValue(item) === 0).length
  const sessionsThisWeek = Math.min(100, progress.thisWeek * 25)
  const streakScore = Math.min(100, progress.streak * 20)
  const consistency = Math.round((sessionsThisWeek + streakScore) / 2)
  const completion = progress.completionRate
  const progression = recent.length >= 2
    ? Math.max(0, Math.min(100, 72 + Math.min(3, recent.length - 1) * 6 + (easyCount > 0 && hardCount === 0 ? 8 : hardCount >= 3 ? -16 : 0)))
    : 0
  const recovery = recent.length
    ? Math.max(25, Math.min(100, 100 - hardCount * 18 - Math.max(0, progress.thisWeek - 4) * 8 + Math.min(2, easyCount) * 5))
    : 0
  const score = recent.length >= 3
    ? Math.round((consistency * 0.25) + (completion * 0.25) + (progression * 0.25) + (recovery * 0.25))
    : null
  const recoveryLabel = recovery >= 75 ? 'GOOD' : recovery >= 50 ? 'MODERATE' : 'REST RECOMMENDED'
  const difficultyTrend = !recent.length ? 'No sessions yet'
    : hardCount >= 3 ? 'Several recent sessions felt challenging'
      : easyCount >= 2 ? 'Recent sessions felt manageable'
        : 'Effort is staying balanced'
  return { score, consistency, completion, progression, recovery, recoveryLabel, difficultyTrend, hardCount, easyCount }
}

const getFourWeekActivity = (history: HistoryItem[]) => {
  const startOfCurrentWeek = new Date()
  startOfCurrentWeek.setHours(0, 0, 0, 0)
  startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - ((startOfCurrentWeek.getDay() + 6) % 7))
  return Array.from({ length: 4 }, (_, index) => {
    const offset = 3 - index
    const start = new Date(startOfCurrentWeek)
    start.setDate(start.getDate() - offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const completed = history.filter((item) => {
      const date = new Date(item.date)
      return item.completed && date >= start && date < end
    })
    return {
      label: index === 3 ? 'This week' : `Week ${index + 1}`,
      count: completed.length,
      minutes: completed.reduce((total, item) => total + item.duration, 0),
    }
  })
}

const JOURNEY_REGIONS: JourneyRegion[] = ['Chest', 'Arms', 'Core', 'Legs', 'Back']

const getExerciseRegion = (text: string): JourneyRegion | null => {
  const value = text.toLowerCase()
  if (/chest|push.?up|bench|pec/.test(value)) return 'Chest'
  if (/arm|bicep|tricep|curl|shoulder|press|row|pull.?up|band pull/.test(value)) return 'Arms'
  if (/core|abs|plank|crunch|dead bug|hollow|mountain climber/.test(value)) return 'Core'
  if (/leg|squat|lunge|step.?up|calf|hamstring|glute|hip|knee|walk|march|burpee|jump|skater|fast feet/.test(value)) return 'Legs'
  if (/back|lat|thoracic|cat.?cow|hinge|y.?t raise/.test(value)) return 'Back'
  return null
}

const getRegionActivity = (history: HistoryItem[], region: JourneyRegion) => {
  const recent = history
    .filter((item) => item.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const matching = recent.flatMap((item) => {
    const exercises = item.workout
      ? [...item.workout.warmup, ...item.workout.main, ...item.workout.cooldown]
      : []
    const matches = exercises.filter((exercise) => getExerciseRegion(`${exercise.name} ${exercise.target ?? ''}`) === region)
    return matches.length ? [{ item, count: matches.length }] : []
  })
  const count = matching.reduce((sum, entry) => sum + entry.count, 0)
  const workoutCount = matching.length
  const consistency = workoutCount >= 4 ? 'Consistent' : workoutCount >= 2 ? 'Building' : workoutCount ? 'Getting started' : 'No activity recorded'
  const recommendation = workoutCount >= 4
    ? 'Keep recovery balanced and rotate focus areas.'
    : workoutCount
      ? 'Add a short session for this area when it fits your plan.'
      : 'Try including a movement for this area in your next balanced workout.'
  return {
    count,
    workoutCount,
    consistency,
    recommendation,
    recent: matching.slice(0, 3).map(({ item }, index) => ({
      key: `${item.id}-${index}`,
      label: `${item.title} · ${formatDate(item.date)}`,
    })),
  }
}

const identifyVoiceAction = (transcript: string): VoiceAction => {
  const text = transcript.toLowerCase()
  if (/recovery|sore|tired|too difficult|too hard|yesterday.*hard/.test(text)) return 'RECOVERY_MODE'
  if (/replace|alternative|can't do this|cannot do this/.test(text)) return 'REPLACE_EXERCISE'
  if (/form|how do i|how to do/.test(text)) return 'SHOW_FORM'
  if (/how much time|time left|time remaining/.test(text)) return 'TIME_LEFT'
  if (/pause/.test(text)) return 'PAUSE_WORKOUT'
  if (/resume|continue workout/.test(text)) return 'RESUME_WORKOUT'
  if (/skip|next exercise/.test(text)) return 'SKIP_EXERCISE'
  if (/start workout|begin workout/.test(text)) return 'START_WORKOUT'
  if (/history|past workouts/.test(text)) return 'SHOW_HISTORY'
  if (/journey/.test(text)) return 'SHOW_JOURNEY'
  if (/profile|my settings/.test(text)) return 'SHOW_PROFILE'
  if (/progress|how am i doing|how am i progressing/.test(text)) return 'SHOW_PROGRESS'
  if (/harder|easier|adapt|change my workout/.test(text)) return 'ADAPT_WORKOUT'
  return 'GENERATE_WORKOUT'
}

const generateCoachReply = (
  message: string,
  workout: Workout | null,
  profile: UserProfile,
  history: HistoryItem[],
): { text: string; adjustedWorkout?: Workout | null } => {
  const lower = message.toLowerCase()
  const minutes = parseDurationFromText(lower) ?? profile.duration
  const previous = [...history]
    .filter((item) => item.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const recent = previous.slice(0, 3)
  const recentHardCount = recent.filter((item) => item.feedback === 'Hard' || item.difficulty === 'Hard').length

  if (/progress|how am i doing|fitness journey|my stats|this week/.test(lower)) {
    const summary = getHistorySummary(history)
    if (!summary.completed.length) {
      return { text: 'Complete and save your first workout and I can start sharing progress insights from your real activity history.' }
    }
    const comparison = summary.thisWeek > summary.previousWeek
      ? `That’s up from ${summary.previousWeek} last week.`
      : summary.thisWeek < summary.previousWeek
        ? `Last week you completed ${summary.previousWeek}; a small consistent step this week is a good next move.`
        : `That matches last week’s ${summary.previousWeek}.`
    const recovery = recentHardCount >= 2
      ? 'Your recent feedback includes harder sessions, so consider a lighter recovery day before pushing intensity.'
      : 'Keep a recovery or mobility day in the mix as your routine builds.'
    return {
      text: `${profile.name || 'You'}, you’ve completed ${summary.thisMonth} workout${summary.thisMonth === 1 ? '' : 's'} this month, averaging ${summary.averageMinutes} minutes. This week: ${summary.thisWeek} completed. ${comparison} You’re building a ${profile.goal.toLowerCase()} routine; a sensible next goal is ${Math.max(1, summary.thisWeek)} completed sessions next week, with one ${profile.goal === 'Strength' || profile.goal === 'Muscle Building' ? 'strength-focused' : 'balanced full-body'} session. ${recovery}`,
    }
  }

  if (lower.includes('yesterday') && (lower.includes('do') || lower.includes('workout'))) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayEntries = previous.filter((item) => getLocalDayKey(item.date) === getLocalDayKey(yesterday))
    if (!yesterdayEntries.length) {
      return { text: 'I don’t see a completed workout saved for yesterday yet. I’ll only use activity recorded in your Flexora history.' }
    }
    const latest = yesterdayEntries[0]
    return {
      text: `Yesterday you completed a ${latest.duration}-minute ${latest.goal.toLowerCase()} workout${latest.feedback ? ` and marked it ${latest.feedback.toLowerCase()}` : ''}.`,
    }
  }

  if (/\b\d+\s*(?:minutes?|mins?)\b/.test(lower) || lower.includes('only have') || lower.includes('less time')) {
    const session = generateProfilePlan(profile, minutes)
    return {
      text: minutes === profile.duration
        ? `You’re in your usual ${profile.duration}-minute window today, so I’ve built a focused ${profile.goal.toLowerCase()} session.`
        : `I know you normally prefer ${profile.duration}-minute workouts, but since you have ${minutes} minutes today, I’ve made a compact ${profile.goal.toLowerCase()} session.`,
      adjustedWorkout: session,
    }
  }

  if (lower.includes('harder') || lower.includes('more challenging')) {
    const session = generateProfilePlan(profile, profile.duration, 'Advanced')
    return { text: 'I’ve raised the challenge by adding controlled tempo and a little more work. Keep your form smooth and scale back if anything feels uncomfortable.', adjustedWorkout: { ...session, difficulty: 'Hard' } }
  }

  if (lower.includes('easier') || lower.includes('easy')) {
    const session = generateProfilePlan(profile, profile.duration, 'Beginner')
    return {
      text: 'Absolutely — I’ve reduced the intensity and kept the movements simple so this session feels more manageable.',
      adjustedWorkout: session,
    }
  }

  if (
    lower.includes('recovery') ||
    lower.includes('tired') ||
    lower.includes('sore') ||
    lower.includes('yesterday was hard') ||
    lower.includes('intense workout')
  ) {
    const session = {
      ...(workout ?? generateProfilePlan(profile)),
      id: makeWorkoutId(),
      title: 'Recovery mode · Low-impact flow',
      difficulty: 'Easy' as const,
      rationale:
        recentHardCount > 0
          ? `Your recent completed sessions include ${recentHardCount} high-effort workout${recentHardCount > 1 ? 's' : ''}; today is lighter with mobility, stretching, and easy movement.`
          : 'A low-impact recovery session focused on mobility, stretching, and easy cardio. Stop if movement causes pain.',
      main: [
        { name: 'Easy walk or march', detail: '3 minutes', time: '03:00' },
        { name: 'Cat-cow mobility', detail: '8 slow reps', reps: '8 reps' },
        { name: 'Gentle child’s pose', detail: '30 sec, comfortable range', time: '00:30' },
      ],
      warmup: [{ name: 'Easy breathing and shoulder rolls', detail: '60 sec', time: '01:00' }],
      cooldown: [{ name: 'Relaxed breathing', detail: '60 sec', time: '01:00' }],
    }

    return {
      text: 'Recovery mode is on: today is low-impact with gentle mobility, stretching, and light cardio. This is general fitness guidance, not a medical assessment.',
      adjustedWorkout: session,
    }
  }

  if (lower.includes('abs') || lower.includes('core')) {
    const session = {
      ...(workout ?? generateProfilePlan(profile)),
      id: makeWorkoutId(),
      main: [
        { name: 'Plank shoulder tap', detail: '3 rounds', reps: '3 x 20 taps' },
        { name: 'Hollow hold', detail: '2 rounds', reps: '2 x 20 sec' },
        { name: 'Bicycle crunch', detail: '3 rounds', reps: '3 x 12/side' },
      ],
      rationale: 'Your workout is now focused on core engagement and trunk stability while maintaining your broader goal objectives.',
    }

    return {
      text: 'Nice focus. I’ve shifted the session to prioritize core work without compromising the rest of your training balance.',
      adjustedWorkout: session,
    }
  }

  if (lower.includes('full body')) {
    const session = generateProfilePlan(profile, minutes, profile.experience, 'General Fitness')
    return { text: `Here’s a balanced full-body session for ${minutes} minutes, adapted to your ${profile.experience.toLowerCase()} level.`, adjustedWorkout: session }
  }

  if (lower.includes('what should i do today') || lower.includes('today')) {
    const recovery = recentHardCount >= 2
    const recommendation = recovery
      ? generateCoachReply('recovery workout', workout, profile, history)
      : null
    if (recommendation) return recommendation
    return {
      text: `For today, ${profile.name || 'you'}, I recommend a ${profile.duration}-minute ${profile.goal.toLowerCase()} session at ${profile.experience.toLowerCase()} level${recent.length ? `, building on your latest ${recent[0].duration}-minute workout` : ''}.`,
      adjustedWorkout: workout ?? generateProfilePlan(profile),
    }
  }

  if (lower.includes('change my workout') || lower.includes('create') || lower.includes('workout')) {
    const session = generateProfilePlan(profile, minutes)
    return { text: `I’ve created a fresh ${minutes}-minute ${profile.goal.toLowerCase()} workout based on your profile${profile.preferences ? ` and your preference for ${profile.preferences}` : ''}.`, adjustedWorkout: session }
  }

  const base = workout ?? generateProfilePlan(profile)
  return {
    text: `I’ve got you, ${profile.name || 'there'}. Your plan reflects your ${profile.age}-year-old profile, ${profile.goal.toLowerCase()} goal, ${profile.experience.toLowerCase()} level, and usual ${profile.duration}-minute window. You can ask for less time, an intensity change, a focus area, or recovery mode.`,
    adjustedWorkout: base,
  }
}

function App() {
  const storedSession = useMemo(() => readSession(), [])
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(storedSession.email)
  const [users, setUsers] = useState<UserRecord[]>(() => readUsers())
  const [profile, setProfile] = useState<UserProfile>(() => {
    const sessionEmail = storedSession.email
    const keyedData = sessionEmail ? readUserData(sessionEmail) : {}
    return { ...defaultProfile(sessionEmail ?? ''), ...keyedData.profile }
  })
  const [workout, setWorkout] = useState<Workout | null>(() => {
    const sessionEmail = storedSession.email
    const keyedData = sessionEmail ? readUserData(sessionEmail) : {}
    const equipment = keyedData.profile?.equipment ?? 'NO EQUIPMENT'
    return keyedData.workout ? enrichWorkout(normalizeWorkoutEquipment(keyedData.workout, equipment)) : null
  })
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const sessionEmail = storedSession.email
    const keyedData = sessionEmail ? readUserData(sessionEmail) : {}
    return keyedData.messages && keyedData.messages.length > 0 ? keyedData.messages : []
  })
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const sessionEmail = storedSession.email
    const keyedData = sessionEmail ? readUserData(sessionEmail) : {}
    return keyedData.history ?? []
  })
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [draftProfile, setDraftProfile] = useState<UserProfile>(() => defaultProfile(storedSession.email ?? ''))
  const [challengeIntent, setChallengeIntent] = useState(false)
  const [pendingDuration, setPendingDuration] = useState<5 | 10 | 20 | 30 | null>(null)
  const [reminderNotice, setReminderNotice] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [coachMode, setCoachMode] = useState<'text' | 'voice'>('text')
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<JourneyRegion>('Legs')
  const [toast, setToast] = useState('')
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null)
  const [selectedJourneyDay, setSelectedJourneyDay] = useState<JourneyDay | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playerPaused, setPlayerPaused] = useState(false)
  const [playerIndex, setPlayerIndex] = useState(0)
  const [completedExerciseCount, setCompletedExerciseCount] = useState(0)
  const [playerSeconds, setPlayerSeconds] = useState(45)
  const [playerElapsedSeconds, setPlayerElapsedSeconds] = useState(0)
  const [playerResting, setPlayerResting] = useState(false)
  const [playerMode, setPlayerMode] = useState<'watch' | 'practice'>('watch')
  const [demoPlaying, setDemoPlaying] = useState(true)
  const [slowDemo, setSlowDemo] = useState(false)
  const [practiceProgress, setPracticeProgress] = useState({ exerciseIndex: -1, reps: 0 })
  const [replacementExerciseIndex, setReplacementExerciseIndex] = useState<number | null>(null)
  const [replacementNotice, setReplacementNotice] = useState('')
  const [feedbackPrediction, setFeedbackPrediction] = useState('')
  const [workoutComplete, setWorkoutComplete] = useState(false)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const progress = useMemo(() => getHistorySummary(history), [history])
  const adaptiveScores = useMemo(() => getAdaptiveScores(history, progress), [history, progress])
  const weeklyActivity = useMemo(() => getFourWeekActivity(history), [history])
  const regionActivity = useMemo(() => getRegionActivity(history, selectedRegion), [history, selectedRegion])
  const completedHistory = useMemo(
    () => history.filter((item) => item.completed).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history],
  )
  const recentHardCount = completedHistory.slice(0, 3).filter((item) => item.feedback === 'Hard' || item.difficulty === 'Hard').length
  const speechRecognitionAvailable = typeof window !== 'undefined' && Boolean(
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  )
  const playerExercises = useMemo(
    () => workout ? [...workout.warmup, ...workout.main, ...workout.cooldown] : [],
    [workout],
  )
  const currentExercise = playerExercises[playerIndex]
  const currentGuidance = getExerciseGuidance(currentExercise)
  const replacementOptions = getExerciseAlternatives(currentExercise)
  const showReplacement = replacementExerciseIndex === playerIndex
  const exerciseRepTarget = getExerciseRepTarget(currentExercise)
  const practiceReps = practiceProgress.exerciseIndex === playerIndex ? practiceProgress.reps : 0
  const exerciseTotalSeconds = Math.max(1, getExerciseSeconds(currentExercise))
  const exerciseTimerProgress = Math.min(1, Math.max(0, 1 - playerSeconds / exerciseTotalSeconds))
  const currentExerciseProgress = exerciseRepTarget > 0
    ? practiceReps / exerciseRepTarget
    : exerciseTimerProgress
  const playerProgressPercent = Math.round(
    ((playerIndex + (playerResting ? 0 : currentExerciseProgress)) / Math.max(1, playerExercises.length)) * 100,
  )
  const journeyDays = useMemo(
    () => getJourneyDays(history, profile.challengeStartDate, profile.challengeDayNotes),
    [history, profile.challengeDayNotes, profile.challengeStartDate],
  )
  const currentChallengeDay = challengeDayNumber(profile.challengeStartDate)
  const challengeCompletedCount = profile.challengeStartDate
    ? journeyDays.filter((day) => day.item?.completed).length
    : 0
  const todayHistory = history
    .filter((item) => getLocalDayKey(item.date) === getTodayKey())
    .sort((a, b) => Number(b.completed) - Number(a.completed))[0]
  const todayWorkoutComplete = Boolean(todayHistory?.completed)
  const isRecoveryPlan = Boolean(workout?.title.toLowerCase().includes('recovery'))
  const dailyReminderMessage = todayWorkoutComplete
    ? 'Great job — today’s workout is complete.'
    : isRecoveryPlan
      ? 'Today is a recovery-focused day.'
      : workout
        ? `Your ${workout.duration}-minute workout is ready.`
        : 'You haven’t started today’s workout yet.'
  const nextWorkoutGoal = Math.max(1, Math.min(4, progress.thisWeek + 1))

  const finishWorkout = useCallback((completedCount = completedExerciseCount) => {
    if (!workout) return
    setPlayerOpen(false)
    setPlayerPaused(false)
    setWorkoutComplete(true)
    setHistory((previous) => {
      const existing = previous.find((item) => item.id === workout.id)
      const saved: HistoryItem = {
        id: workout.id,
        date: existing?.date ?? new Date().toISOString(),
        title: workout.title,
        goal: workout.goal,
        duration: workout.duration,
        difficulty: workout.difficulty ?? 'Moderate',
        completed: true,
        exercisesCompleted: completedCount,
        feedback: existing?.feedback,
        workout,
      }
      return [saved, ...previous.filter((item) => item.id !== workout.id)]
    })
    setToast('Workout completed and saved to your history.')
  }, [completedExerciseCount, workout])

  const advancePlayer = useCallback(() => {
    setPlayerElapsedSeconds((elapsed) => elapsed + 1)
    if (playerSeconds > 1) {
      setPlayerSeconds((seconds) => Math.max(0, seconds - 1))
      return
    }
    if (playerResting) {
      setPlayerResting(false)
      setPlayerIndex((index) => Math.min(index + 1, playerExercises.length - 1))
      setPlayerSeconds(getExerciseSeconds(playerExercises[playerIndex + 1]))
      return
    }
    if (playerIndex >= playerExercises.length - 1) {
      finishWorkout(playerExercises.length)
      return
    }
    if (playerIndex >= workout!.warmup.length - 1 && playerIndex < workout!.warmup.length + workout!.main.length - 1) {
      setCompletedExerciseCount(playerIndex + 1)
      setPlayerResting(true)
      setPlayerSeconds(15)
      return
    }
    setCompletedExerciseCount(playerIndex + 1)
    setPlayerIndex((index) => Math.min(index + 1, playerExercises.length - 1))
    setPlayerSeconds(getExerciseSeconds(playerExercises[playerIndex + 1]))
  }, [finishWorkout, playerExercises, playerIndex, playerResting, playerSeconds, workout])

  useEffect(() => {
    if (sessionUserEmail) {
      if (!writeSession(sessionUserEmail) || !writeUserData(sessionUserEmail, { profile, workout, messages, history })) {
        console.error('Flexora could not persist this session to browser storage.')
      }
    }
  }, [history, messages, profile, sessionUserEmail, workout])

  useEffect(() => {
    if (users.length > 0 && !writeUsers(users)) {
      console.error('Flexora could not persist accounts to browser storage.')
    }
  }, [users])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, typing])

  useEffect(() => () => {
    speechRecognitionRef.current?.stop()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    if (!showOnboarding) return
    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
    }
  }, [showOnboarding])

  useEffect(() => {
    if (!playerOpen || playerPaused) return
    const timer = window.setInterval(advancePlayer, 1000)
    return () => window.clearInterval(timer)
  }, [advancePlayer, playerOpen, playerPaused])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!profile.reminderEnabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const [hours, minutes] = (profile.reminderTime ?? '19:00').split(':').map(Number)
    const nextReminder = new Date()
    nextReminder.setHours(hours, minutes, 0, 0)
    if (nextReminder <= new Date()) nextReminder.setDate(nextReminder.getDate() + 1)
    const timeout = window.setTimeout(() => {
      try {
        new Notification('Flexora workout reminder', {
          body: `Your ${profile.duration}-minute adaptive workout is ready.`,
        })
        setToast('Your Flexora workout reminder is ready.')
      } catch {
        setReminderNotice('The browser could not show a notification. Your reminder remains available in the app.')
      }
    }, nextReminder.getTime() - Date.now())
    return () => window.clearTimeout(timeout)
  }, [profile.duration, profile.reminderEnabled, profile.reminderTime])

  const startNewWorkout = (nextProfile = profile) => {
    const recentEasyCount = completedHistory.slice(0, 3).filter((item) => item.feedback === 'Easy').length
    const nextExperience: Experience = recentEasyCount >= 2
      ? nextProfile.experience === 'Beginner' ? 'Intermediate' : 'Advanced'
      : nextProfile.experience
    let nextWorkout = generateProfilePlan(nextProfile, nextProfile.duration, nextExperience)
    const needsRecovery = completedHistory[0]?.feedback === 'Hard' || recentHardCount >= 2
    if (needsRecovery) {
      const recoveryPlan = generateCoachReply('recovery workout', nextWorkout, nextProfile, history).adjustedWorkout
      if (recoveryPlan) nextWorkout = recoveryPlan
    }
    nextWorkout = enrichWorkout(fitWorkoutToDuration(nextWorkout))
    setWorkout(nextWorkout)
    setWorkoutComplete(false)

    setMessages((previous) => [
      ...previous,
      {
        id: makeWorkoutId(),
        role: 'assistant',
        text: needsRecovery
          ? `Your recent effort suggests a lighter session today. I prepared a ${nextProfile.duration}-minute recovery workout around your ${nextProfile.goal.toLowerCase()} goal.`
          : recentEasyCount >= 2
            ? `Your recent sessions felt manageable, so I progressed this ${nextProfile.duration}-minute ${nextProfile.goal.toLowerCase()} workout to ${nextExperience.toLowerCase()} level.`
            : `Workout ready: ${nextWorkout.title}. I designed this around your ${nextProfile.goal.toLowerCase()} goal, ${nextProfile.duration}-minute availability, ${nextProfile.experience.toLowerCase()} level, and ${nextProfile.workoutPreference ?? 'Balanced'} preference.`,
      },
    ])
  }

  const startChallenge = () => {
    const today = getTodayKey()
    const updatedProfile = { ...profile, challengeStartDate: today, challengeDayNotes: {} }
    setProfile(updatedProfile)
    setDraftProfile(updatedProfile)
    setToast('Your 30-day Flexora journey has started.')
  }

  const saveJourneyDayStatus = (day: JourneyDay, status: JourneyDayStatus) => {
    setProfile((current) => ({
      ...current,
      challengeDayNotes: { ...(current.challengeDayNotes ?? {}), [day.key]: status },
    }))
    setSelectedJourneyDay(null)
    setToast(status === 'rest' ? 'Rest day recorded. No workout was added to your history.' : 'Day marked as missed. No workout was added to your history.')
  }

  const setReminderEnabled = async (enabled: boolean) => {
    if (!enabled) {
      setProfile((current) => ({ ...current, reminderEnabled: false }))
      setReminderNotice('Workout reminders are off.')
      return
    }

    try {
      if ('Notification' in window) {
        let permission = Notification.permission
        if (permission === 'default') permission = await Notification.requestPermission()
        if (permission === 'denied') {
          setProfile((current) => ({ ...current, reminderEnabled: true }))
          setReminderNotice('Browser notifications are blocked. Your in-app reminder will remain available.')
          return
        }
        setReminderNotice(permission === 'granted'
          ? 'Reminder enabled. A browser alert can appear at your chosen time while Flexora is open.'
          : 'Reminder enabled in Flexora. Browser notifications were not granted.')
      } else {
        setReminderNotice('Browser notifications are unavailable. Your reminder is shown in the app.')
      }
    } catch {
      setReminderNotice('Browser permission could not be checked. Your in-app reminder is still enabled.')
    }
    setProfile((current) => ({ ...current, reminderEnabled: true }))
  }

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    window.setTimeout(() => {
      document.getElementById('auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const startWorkout = () => {
    if (!workout) return
    const nextHistoryItem: HistoryItem = {
      id: workout.id,
      date: new Date().toISOString(),
      title: workout.title,
      goal: workout.goal,
      duration: workout.duration,
      difficulty: workout.difficulty ?? (workout.experience === 'Beginner' ? 'Easy' : workout.experience === 'Advanced' ? 'Hard' : 'Moderate'),
      completed: false,
      workout,
    }
    setHistory((previous) => previous.some((item) => item.id === workout.id) ? previous : [nextHistoryItem, ...previous])
    setPlayerIndex(0)
    setCompletedExerciseCount(0)
    setPlayerElapsedSeconds(0)
    setPlayerSeconds(getExerciseSeconds(playerExercises[0]))
    setPlayerResting(false)
    setPlayerPaused(false)
    setPlayerMode('watch')
    setSlowDemo(false)
    setDemoPlaying(true)
    setPracticeProgress({ exerciseIndex: -1, reps: 0 })
    setReplacementExerciseIndex(null)
    setWorkoutComplete(false)
    setPlayerOpen(true)
  }

  const replaceCurrentExercise = (replacement: Exercise) => {
    if (!workout) return
    const originalExerciseName = currentExercise?.name ?? 'Current exercise'
    const warmupEnd = workout.warmup.length
    const mainEnd = warmupEnd + workout.main.length
    const nextWorkout = playerIndex < warmupEnd
      ? { ...workout, warmup: workout.warmup.map((item, index) => index === playerIndex ? replacement : item) }
      : playerIndex < mainEnd
        ? { ...workout, main: workout.main.map((item, index) => index === playerIndex - warmupEnd ? replacement : item) }
        : { ...workout, cooldown: workout.cooldown.map((item, index) => index === playerIndex - mainEnd ? replacement : item) }
    setWorkout(nextWorkout)
    setHistory((previous) => previous.map((item) => item.id === workout.id ? { ...item, workout: nextWorkout } : item))
    setReplacementExerciseIndex(null)
    setReplacementNotice(`${originalExerciseName} → ${replacement.name}. Lower difficulty while keeping a similar movement pattern. Your timer and progress were preserved.`)
    setToast('Exercise replaced. Timer and workout progress preserved.')
  }

  const adjustRemainingWorkout = (duration: 5 | 10 | 20 | 30) => {
    if (!workout) return
    const allExercises = [...workout.warmup, ...workout.main, ...workout.cooldown]
    const remainingBudget = Math.max(0, duration * 60 - playerElapsedSeconds - playerSeconds)
    const retainedIndexes = new Set<number>()
    for (let index = 0; index <= playerIndex; index += 1) retainedIndexes.add(index)
    let budgetUsed = 0
    for (let index = playerIndex + 1; index < allExercises.length; index += 1) {
      const seconds = getExerciseSeconds(allExercises[index])
      if (budgetUsed + seconds > remainingBudget) break
      retainedIndexes.add(index)
      budgetUsed += seconds
    }
    const warmupEnd = workout.warmup.length
    const mainEnd = warmupEnd + workout.main.length
    const nextWorkout: Workout = {
      ...workout,
      duration,
      title: `${workout.title.replace(/ · \d+ min$/, '')}`,
      rationale: `Flexora adjusted only the remaining session to fit your new ${duration}-minute target. Your current exercise, elapsed time, and completed work were kept.`,
      coachMessage: `The remaining exercises were shortened to fit your ${duration}-minute target without restarting your session.`,
      warmup: workout.warmup.filter((_, index) => retainedIndexes.has(index)),
      main: workout.main.filter((_, index) => retainedIndexes.has(warmupEnd + index)),
      cooldown: workout.cooldown.filter((_, index) => retainedIndexes.has(mainEnd + index)),
    }
    setWorkout(enrichWorkout(nextWorkout))
    setHistory((previous) => previous.map((item) => item.id === workout.id ? { ...item, duration, workout: nextWorkout } : item))
    setPendingDuration(null)
    setToast(`Remaining workout adapted to ${duration} minutes. Your current exercise and timer stayed in place.`)
  }

  const submitWorkoutFeedback = (feedback: 'Easy' | 'Good' | 'Hard') => {
    if (!workout) return
    setHistory((previous) => previous.map((item) => item.id === workout.id ? { ...item, feedback } : item))
    if (feedback === 'Easy') {
      const priorEasyCount = completedHistory.slice(0, 2).filter((item) => item.feedback === 'Easy').length
      const shouldProgress = priorEasyCount >= 1
      const level: Experience = shouldProgress
        ? profile.experience === 'Beginner' ? 'Intermediate' : 'Advanced'
        : profile.experience
      const adapted = generateProfilePlan(profile, workout.duration, level, workout.goal)
      setWorkout({ ...adapted, difficulty: shouldProgress ? level === 'Advanced' ? 'Hard' : 'Moderate' : workout.difficulty ?? 'Moderate' })
      setWorkoutComplete(false)
      setFeedbackPrediction(shouldProgress ? 'Your last sessions felt manageable. The next workout progresses one step while keeping your duration.' : 'Saved as manageable. Flexora will look for another easy session before progressing difficulty.')
      setMessages((previous) => [...previous, { id: makeWorkoutId(), role: 'assistant', text: shouldProgress
        ? `Your recent sessions felt manageable, so I’ve progressed the next session one step while keeping your ${workout.duration}-minute duration.`
        : `Glad that felt manageable. I’ve saved your feedback and will look for another easy session before progressing difficulty.` }])
    } else if (feedback === 'Hard') {
      const adapted = generateProfilePlan(profile, workout.duration, 'Beginner', workout.goal)
      const easierMain = adapted.main.slice(0, Math.max(1, adapted.main.length - 1)).map((exercise) => ({
        ...exercise,
        reps: exercise.reps?.replace(/(\d+)\s*[x×]\s*(\d+)/, (_, sets: string, reps: string) =>
          `${Math.max(1, Math.floor(Number(sets) * 0.7))} x ${Math.max(6, Math.floor(Number(reps) * 0.8))}`),
      }))
      const lighterWorkout = enrichWorkout(fitWorkoutToDuration({
        ...adapted,
        difficulty: 'Easy',
        main: easierMain,
        rationale: 'Flexora changed your next workout because your previous session was too difficult. This version uses fewer movements, lower volume, and beginner-friendly pacing.',
        coachMessage: 'Your feedback mattered: the next session has fewer movements and lower volume while still fitting your selected time.',
      }))
      setWorkout(lighterWorkout)
      setWorkoutComplete(false)
      setFeedbackPrediction('Flexora changed your next workout because your previous session was too difficult. It now has fewer movements, lower volume, and easier pacing.')
      setMessages((previous) => [...previous, { id: makeWorkoutId(), role: 'assistant', text: 'Thanks for the feedback. I’ve reduced intensity for your next session and can suggest lower-impact alternatives. Stop any movement that causes pain.' }])
    } else {
      setFeedbackPrediction('Next session: maintain a similar level and adapt again from your next feedback.')
      setMessages((previous) => [...previous, { id: makeWorkoutId(), role: 'assistant', text: 'Great — I’ll keep this intensity for your next session.' }])
    }
    setToast('Feedback saved. Your next plan has been adjusted.')
  }

  const sendCoachMessage = async (value: string, fromVoice = false) => {
    const userMessage: ChatMessage = { id: makeWorkoutId(), role: 'user', text: value }
    setMessages((previous) => [...previous, userMessage])
    setChatInput('')
    setTyping(true)
    if (fromVoice) setVoiceStatus('thinking')

    const endpoint = import.meta.env.VITE_FLEXORA_AI_ENDPOINT ?? import.meta.env.VITE_FITFLOW_AI_ENDPOINT
    const requestedDuration = parseDurationFromText(value) ?? profile.duration
    let response: { text: string; adjustedWorkout?: Workout | null }

    try {
      if (!endpoint) throw new Error('No AI endpoint configured')
      const result = await requestFitFlowAi(endpoint, {
        message: value,
        requestedDuration,
        profile: {
          name: profile.name,
          age: profile.age,
          goal: profile.goal,
          experience: profile.experience,
          preferredDuration: profile.duration,
          preferredWorkoutType: profile.workoutPreference ?? 'Balanced',
          preferences: profile.preferences,
          equipment: profile.equipment ?? 'NO EQUIPMENT',
        },
        currentWorkout: workout,
        history: history.slice(0, 10),
        conversation: messages.slice(-12),
      })
      const generated = isWorkout(result.workout)
        ? {
            ...normalizeWorkoutEquipment(result.workout, profile.equipment ?? 'NO EQUIPMENT'),
            id: makeWorkoutId(),
            duration: requestedDuration,
            experience: result.workout.experience ?? profile.experience,
            difficulty: result.workout.difficulty ?? 'Moderate',
            rationale: result.workout.rationale ?? result.workout.coachMessage ?? result.text,
            summary: result.workout.summary ?? `${result.workout.goal} • ${result.workout.duration} min`,
          }
        : undefined
      response = {
        text: result.text,
        adjustedWorkout: generated ?? generateCoachReply(value, workout, profile, history).adjustedWorkout,
      }
      setAiUnavailable(false)
    } catch {
      response = generateCoachReply(value, workout, profile, history)
      setAiUnavailable(true)
      response.text = `Flexora AI is temporarily unavailable. Your local adaptive workout engine is still available. ${response.text}`
    } finally {
      setTyping(false)
    }

    if (response.adjustedWorkout) {
      setWorkout(enrichWorkout(fitWorkoutToDuration(response.adjustedWorkout)))
      setWorkoutComplete(false)
    }
    setMessages((previous) => [...previous, { id: makeWorkoutId(), role: 'assistant', text: response.text }])
    if (fromVoice) {
      setVoiceStatus('responding')
      speakResponseText(response.text)
    }
  }

  const handleVoiceTranscript = async (transcript: string) => {
    if (!transcript.trim()) {
      setVoiceError('I didn’t catch that. Tap the microphone to try again, or use text chat.')
      setVoiceStatus('error')
      return
    }
    setVoiceTranscript(transcript)
    const action = identifyVoiceAction(transcript)

    if (action === 'GENERATE_WORKOUT' || action === 'ADAPT_WORKOUT' || action === 'RECOVERY_MODE') {
      const request = action === 'RECOVERY_MODE' ? 'Recovery mode. I am tired or sore today.' : transcript
      await sendCoachMessage(request, true)
      return
    }

    if (action === 'SHOW_HISTORY' || action === 'SHOW_PROGRESS' || action === 'SHOW_JOURNEY' || action === 'SHOW_PROFILE') {
      const request = action === 'SHOW_HISTORY'
        ? 'Show my workout history.'
        : action === 'SHOW_PROFILE'
          ? `Tell me my profile. My goal is ${profile.goal}, my experience is ${profile.experience}, and I usually prefer ${profile.duration} minutes.`
          : action === 'SHOW_JOURNEY'
            ? 'Tell me about my fitness journey.'
            : 'How am I progressing this week?'
      await sendCoachMessage(request, true)
      const targetId = action === 'SHOW_HISTORY' ? 'history'
        : action === 'SHOW_PROFILE' ? 'profile'
          : action === 'SHOW_PROGRESS' ? 'progress' : 'fitness-journey'
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const userMessage: ChatMessage = { id: makeWorkoutId(), role: 'user', text: transcript }
    const remainingSeconds = playerSeconds + playerExercises.slice(playerIndex + 1).reduce((total, exercise) => total + getExerciseSeconds(exercise), 0)
    const replyByAction: Record<Exclude<VoiceAction, 'GENERATE_WORKOUT' | 'ADAPT_WORKOUT' | 'RECOVERY_MODE' | 'SHOW_HISTORY' | 'SHOW_PROGRESS' | 'SHOW_JOURNEY' | 'SHOW_PROFILE'>, string> = {
      SHOW_FORM: currentExercise
        ? `${currentExercise.name}: ${getExerciseGuidance(currentExercise).tips.join(' ')} ${getExerciseGuidance(currentExercise).breathing}`
        : 'Start a workout and I can show form tips for the current movement.',
      TIME_LEFT: playerOpen
        ? `About ${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remain in this workout.`
        : 'Start a workout to see its remaining time.',
      REPLACE_EXERCISE: playerOpen
        ? 'Opening lower-impact alternatives for your current movement.'
        : 'Start a workout first, and I can replace its current movement.',
      START_WORKOUT: 'Starting your current personalized workout.',
      PAUSE_WORKOUT: 'Pausing your workout timer.',
      RESUME_WORKOUT: 'Resuming your workout timer.',
      SKIP_EXERCISE: 'Moving to the next exercise.',
    }
    const answer = replyByAction[action]
    setMessages((previous) => [...previous, userMessage, { id: makeWorkoutId(), role: 'assistant', text: answer }])
    setVoiceStatus('responding')
    speakResponseText(answer)
    if (action === 'REPLACE_EXERCISE' && playerOpen) setReplacementExerciseIndex(playerIndex)
    if (action === 'START_WORKOUT') startWorkout()
    if (action === 'PAUSE_WORKOUT' && playerOpen) setPlayerPaused(true)
    if (action === 'RESUME_WORKOUT' && playerOpen) setPlayerPaused(false)
    if (action === 'SKIP_EXERCISE' && playerOpen) {
      setCompletedExerciseCount((count) => Math.max(count, playerIndex + 1))
      setPlayerResting(false)
      setPlayerIndex((index) => Math.min(index + 1, playerExercises.length - 1))
      setPlayerSeconds(getExerciseSeconds(playerExercises[playerIndex + 1]))
    }
  }

  const startVoiceRecognition = () => {
    if (voiceStatus === 'listening') {
      speechRecognitionRef.current?.stop()
      setVoiceStatus('idle')
      return
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceError("Voice input isn't supported on this device. Flexora remains available through text.")
      setVoiceStatus('error')
      return
    }
    try {
      const recognition = new Recognition()
      speechRecognitionRef.current = recognition
      recognition.lang = navigator.language || 'en-US'
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ''
        setVoiceError('')
        void handleVoiceTranscript(transcript)
      }
      recognition.onerror = (event) => {
        const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        setVoiceError(denied
          ? 'Microphone access is required for voice conversations. You can continue using text chat.'
          : event.error === 'audio-capture'
            ? 'No microphone was found. You can continue using text chat.'
            : 'Voice input could not start. Please try again or use text chat.')
        setVoiceStatus('error')
      }
      recognition.onend = () => {
        setVoiceStatus((status) => status === 'listening' ? 'idle' : status)
      }
      setVoiceTranscript('')
      setVoiceError('')
      setVoiceStatus('listening')
      recognition.start()
    } catch {
      setVoiceError('Microphone access is required for voice conversations. You can continue using text chat.')
      setVoiceStatus('error')
    }
  }

  const speakLastResponse = () => {
    const lastReply = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!lastReply) {
      setVoiceError('There is no response to play yet.')
      return
    }
    speakResponseText(lastReply.text)
  }

  const speakResponseText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceError('Speech playback is not supported on this device. The response is available as text.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setVoiceStatus((status) => status === 'responding' ? 'idle' : status)
    window.speechSynthesis.speak(utterance)
    setVoiceError('')
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  const handlePromptSubmit = (event: FormEvent) => {
    event.preventDefault()
    const value = chatInput.trim()
    if (value && !typing) void sendCoachMessage(value)
  }

  const askAiProgress = () => {
    setCoachMode('text')
    void sendCoachMessage('How am I progressing?')
    window.setTimeout(() => document.getElementById('coach')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const handleAuthSubmit = (event: FormEvent) => {
    event.preventDefault()
    const normalizedEmail = authForm.email.trim().toLowerCase()

    if (!normalizedEmail || !authForm.password.trim()) {
      setAuthError('Please enter both email and password.');
      return
    }

    if (authMode === 'login') {
      const existingUser = users.find((user) => user.email === normalizedEmail)

      if (!existingUser) {
        setAuthError('No account matches that email. Create an account to continue.')
        return
      }

      if (existingUser.password !== authForm.password) {
        setAuthError('That password does not match the current account.')
        return
      }

      const savedData = readUserData(normalizedEmail)
      const savedProfile = { ...defaultProfile(normalizedEmail, existingUser.password), ...savedData.profile }
      if (challengeIntent && !savedProfile.challengeStartDate) savedProfile.challengeStartDate = getTodayKey()
      setSessionUserEmail(normalizedEmail)
      setProfile(savedProfile)
      setDraftProfile(savedProfile)
      setWorkout(savedData.workout
        ? enrichWorkout(normalizeWorkoutEquipment(savedData.workout, savedProfile.equipment ?? 'NO EQUIPMENT'))
        : generateProfilePlan(savedProfile))
      setMessages(savedData.messages && savedData.messages.length > 0 ? savedData.messages : [initialAssistantMessage(savedProfile)])
      setHistory(savedData.history ?? [])
      setAuthError('')
      setAuthNotice('')
      setChallengeIntent(false)
      return
    }

    const duplicate = users.some((user) => user.email === normalizedEmail)

    if (duplicate) {
      setAuthError('This email is already registered. Please log in instead.')
      return
    }

    const nextUser: UserRecord = {
      email: normalizedEmail,
      password: authForm.password,
      profile: { ...defaultProfile(normalizedEmail, authForm.password), email: normalizedEmail, password: authForm.password },
      workout: null,
      messages: [initialAssistantMessage({ ...defaultProfile(normalizedEmail, authForm.password), email: normalizedEmail, password: authForm.password })],
      history: [],
    }

    setUsers((previous) => [...previous, nextUser])
    setSessionUserEmail(normalizedEmail)
    setProfile(nextUser.profile)
    setMessages(nextUser.messages)
    setWorkout(null)
    setHistory([])
    setShowOnboarding(true)
    setOnboardingStep(0)
    setDraftProfile(nextUser.profile)
    setAuthError('')
    setAuthNotice('')
  }

  const handleResetPassword = () => {
    const email = authForm.email.trim().toLowerCase()
    if (!email) {
      setAuthError('Enter your email to reset your password.')
      return
    }

    setAuthNotice(`A password reset link was prepared for ${email}. For this demo, use your existing password or set a new one in the profile form.`)
    setAuthError('')
  }

  const handleLogout = () => {
    setSessionUserEmail(null)
    if (!writeSession(null)) {
      console.error('Flexora could not clear the saved session from browser storage.')
    }
    setAuthMode('login')
    setAuthForm({ email: '', password: '' })
    setAuthError('')
    setAuthNotice('')
    setShowOnboarding(false)
    setOnboardingStep(0)
  }

  const updateDraftField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    setDraftProfile((current) => ({ ...current, [field]: value }))
  }

  const completeOnboarding = () => {
    const finalizedProfile = {
      ...draftProfile,
      email: sessionUserEmail ?? draftProfile.email,
      password: profile.password || draftProfile.password,
      challengeStartDate: challengeIntent ? (draftProfile.challengeStartDate ?? getTodayKey()) : draftProfile.challengeStartDate ?? profile.challengeStartDate ?? null,
    }

    setProfile(finalizedProfile)
    setDraftProfile(finalizedProfile)
    setShowOnboarding(false)
    const generated = generateProfilePlan(finalizedProfile)
    setWorkout(generated)
    setWorkoutComplete(false)
    const planMessage: ChatMessage = {
      id: makeWorkoutId(),
      role: 'assistant',
      text: `Your plan is ready. I built a ${finalizedProfile.goal.toLowerCase()} session for ${finalizedProfile.duration} minutes at a ${finalizedProfile.experience.toLowerCase()} level.`,
    }
    setMessages((previous) => profile.name.trim()
      ? [...previous, planMessage]
      : [initialAssistantMessage(finalizedProfile), planMessage])

    const userIndex = users.findIndex((user) => user.email === finalizedProfile.email)
    if (userIndex >= 0) {
      const updatedUser = {
        ...users[userIndex],
        profile: finalizedProfile,
      }

      setUsers((previous) => previous.map((user) => (user.email === finalizedProfile.email ? updatedUser : user)))
    }
      setChallengeIntent(false)
  }

  const onboardingSteps = [
    {
      title: 'What is your goal?',
      body: (
        <div className="choice-grid">
          {GOALS.map((goal) => (
            <button
              key={goal}
              className={`choice-card ${draftProfile.goal === goal ? 'selected' : ''}`}
              type="button"
              onClick={() => updateDraftField('goal', goal)}
            >
              <span>{goal === 'Weight Loss' ? '🔥' : goal === 'Muscle Building' ? '💪' : goal === 'General Fitness' ? '⚡' : goal === 'Strength' ? '🏋️' : goal === 'Flexibility' ? '🧘' : '🏃'}
              </span>
              <strong>{goal}</strong>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'How much time do you have today?',
      body: (
        <div className="choice-grid compact">
          {DURATIONS.map((minute) => (
            <button
              key={minute}
              type="button"
              className={`choice-card ${draftProfile.duration === minute ? 'selected' : ''}`}
              onClick={() => updateDraftField('duration', minute)}
            >
              <strong>{minute} min</strong>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'What is your experience?',
      body: (
        <div className="choice-grid compact">
          {EXPERIENCES.map((level) => (
            <button
              key={level}
              type="button"
              className={`choice-card ${draftProfile.experience === level ? 'selected' : ''}`}
              onClick={() => updateDraftField('experience', level)}
            >
              <strong>{level}</strong>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Ready to train?',
      body: (
        <div className="summary-card">
          <div className="summary-row">
            <span>Name</span>
            <strong>{draftProfile.name || profile.name || 'Athlete'}</strong>
          </div>
          <div className="summary-row">
            <span>Goal</span>
            <strong>{draftProfile.goal}</strong>
          </div>
          <div className="summary-row">
            <span>Time</span>
            <strong>{draftProfile.duration} minutes</strong>
          </div>
          <div className="summary-row">
            <span>Level</span>
            <strong>{draftProfile.experience}</strong>
          </div>
          <div className="summary-row">
            <span>Workout style</span>
            <strong>{draftProfile.workoutPreference ?? 'Balanced'}</strong>
          </div>
          <div className="summary-row">
            <span>Equipment</span>
            <strong>{draftProfile.equipment ?? 'NO EQUIPMENT'}</strong>
          </div>
        </div>
      ),
    },
  ]

  const currentStep = onboardingSteps[onboardingStep]

  if (!sessionUserEmail) {
    return (
      <div className="app-shell">
        <header className="topbar topbar-home">
          <div className="brand-wrap">
            <img className="brand-logo" src={fitlifeLogo} alt="FitLife logo" />
            <div>
              <div className="brand-name">Flexora</div>
            </div>
          </div>
          <nav className="nav-links">
            <a href="#features">How it adapts</a>
            <a href="#preview">Workout</a>
          </nav>
        </header>

        <main className="landing-page">
          <section className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">Adaptive fitness, built around you</span>
              <h1>Not sure which workout is right for you?</h1>
              <h2>Flexora creates a workout around you.</h2>
              <p>Tell Flexora your goal, available time, and experience level. Get a personalized short workout in seconds—and a plan that adapts to your feedback.</p>

              <div className="cta-row">
                <button type="button" className="primary-button" onClick={() => {
                  setChallengeIntent(false)
                  openAuth('register')
                }}>
                  Create My Workout
                </button>
                <button type="button" className="secondary-button" onClick={() => {
                  setChallengeIntent(true)
                  openAuth('register')
                }}>
                  Start 30-Day Journey
                </button>
              </div>
            </div>
            <div className="hero-card" id="preview">
              <div className="pulse-orb orb-one" />
              <div className="pulse-orb orb-two" />
              <div className="coach-card">
                <div className="coach-info">
                  <div className="mini-badge">Live</div>
                  <div>
                    <strong>Flexora adaptive engine</strong>
                    <span>Personalized workout guidance</span>
                  </div>
                </div>
                <div className="program-pill">20 min • Fat burn</div>
                <ul>
                  <li>Goal matched</li>
                  <li>Recovery adapted</li>
                  <li>Progress tracked</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="features" className="info-grid">
            <article className="glass-card">
              <span>01</span>
              <h3>Real-life flexibility</h3>
              <p>Adjust workout time and intensity without losing your progress or current session.</p>
            </article>
            <article className="glass-card">
              <span>02</span>
              <h3>Activity-aware guidance</h3>
              <p>Saved sessions and your feedback help shape a sensible next workout.</p>
            </article>
            <article className="glass-card">
              <span>03</span>
              <h3>Alternatives that fit</h3>
              <p>Get a lighter movement when an exercise does not work for you—right in the player.</p>
            </article>
          </section>

          <section id="adaptation-overview" className="showcase-panel">
            <div className="mini-copy">
              <span className="eyebrow">Traditional plans vs Flexora</span>
              <h3>Flexora adapts the workout to you—not you to the workout.</h3>
              <p>Choose your goal, available time, experience, preferred style, and equipment. Flexora uses them to shape a short plan, then adapts future sessions from your feedback.</p>
            </div>
            <div className="adaptation-comparison">
              <div><strong>TRADITIONAL FITNESS APPS</strong><span>Fixed workouts</span><span>Same routine for everyone</span><span>Difficult to adapt</span><span>Little personalization</span></div>
              <div><strong>FLEXORA</strong><span>Goal-based and time-based</span><span>Experience and equipment aware</span><span>Exercise replacement</span><span>Adaptive and recovery-aware</span></div>
            </div>
          </section>
        </main>

        <div className="auth-panel" id="auth-panel">
          <div className="auth-card">
            <div className="auth-header">
              <div>
                <span className="eyebrow">Welcome back</span>
                <h3>{authMode === 'login' ? 'Login to Flexora' : 'Create your account'}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? 'Create Account' : 'Login'}
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="••••••••"
                />
              </label>

              {authError && <p className="status error">{authError}</p>}
              {authNotice && <p className="status success">{authNotice}</p>}

              <div className="auth-actions">
                <button type="submit" className="primary-button wide">{authMode === 'login' ? 'Login' : 'Create Account'}</button>
                <button type="button" className="secondary-button wide" onClick={handleResetPassword}>Forgot Password</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <header className="topbar dashboard-topbar" id="home">
        <div className="brand-wrap">
          <img className="brand-logo" src={fitlifeLogo} alt="FitLife logo" />
          <div>
            <div className="brand-name">Flexora</div>
          </div>
        </div>
        <div className="header-actions">
          <span className="status-pill">Adaptive engine active</span>
          <button type="button" className="ghost-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <nav className="dashboard-nav" aria-label="Main navigation">
        <a href="#home">Home</a>
        <a href="#workout">Workout</a>
        <a href="#fitness-journey">Journey</a>
        <a href="#progress">Progress</a>
        <a href="#history">History</a>
        <a href="#profile">Profile</a>
      </nav>

      <main className="dashboard-layout">
        <aside className="left-column">
          <div className="glass-card profile-card" id="profile">
            <div className="profile-header">
              <div className="avatar-circle">{profile.name?.slice(0, 1).toUpperCase() || 'A'}</div>
              <div>
                <h3>{profile.name || 'New athlete'}</h3>
                <span>{profile.email}</span>
              </div>
            </div>

            <div className="profile-stats">
              <div>
                <strong>{profile.age || 25}</strong>
                <span>Age</span>
              </div>
              <div>
                <strong>{profile.duration}</strong>
                <span>Minutes</span>
              </div>
              <div>
                <strong>{profile.goal}</strong>
                <span>Goal</span>
              </div>
            </div>
            <div className="profile-preference">
              <span>Equipment</span>
              <strong>{profile.equipment ?? 'NO EQUIPMENT'}</strong>
            </div>

            <button type="button" className="secondary-button wide" onClick={() => {
              setDraftProfile(profile)
              setOnboardingStep(0)
              setShowOnboarding(true)
            }}>
              Update Profile
            </button>

            <div className="profile-reminders">
              <div className="section-heading">
                <div><span className="eyebrow">Profile · Reminders</span><h4>Workout reminder</h4></div>
                <button
                  type="button"
                  className={`reminder-toggle ${profile.reminderEnabled ? 'enabled' : ''}`}
                  aria-pressed={Boolean(profile.reminderEnabled)}
                  onClick={() => void setReminderEnabled(!profile.reminderEnabled)}
                >
                  {profile.reminderEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <label className="reminder-period-field">
                <span>Preferred time</span>
                <select
                  value={profile.reminderPeriod ?? 'Evening'}
                  onChange={(event) => {
                    const period = event.target.value as ReminderPeriod
                    const times: Record<Exclude<ReminderPeriod, 'Custom'>, string> = { Morning: '08:00', Afternoon: '13:00', Evening: '19:00' }
                    setProfile((current) => ({
                      ...current,
                      reminderPeriod: period,
                      reminderTime: period === 'Custom' ? current.reminderTime ?? '19:00' : times[period],
                    }))
                  }}
                >
                  {REMINDER_PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
                </select>
              </label>
              {profile.reminderPeriod === 'Custom' && (
                <label className="reminder-period-field">
                  <span>Custom time</span>
                  <input type="time" value={profile.reminderTime ?? '19:00'} onChange={(event) => setProfile((current) => ({ ...current, reminderTime: event.target.value }))} />
                </label>
              )}
              {profile.reminderEnabled && (
                <p className="muted-copy">
                  Your workout reminder is set for {profile.reminderTime ?? '19:00'}.
                  {' '}{'Notification' in window ? 'Browser alerts require permission and Flexora to remain open.' : 'This is an in-app reminder; browser notifications are unavailable.'}
                </p>
              )}
              {reminderNotice && <p className="status" role="status">{reminderNotice}</p>}
            </div>
          </div>

          <div className="glass-card brief-card">
            <span className="eyebrow">Flexora Insight · Today</span>
            <h3>Good to see you, {profile.name || 'athlete'} 👋</h3>
            <div className="daily-reminder-card" role="status">
              <strong>{dailyReminderMessage}</strong>
              {currentChallengeDay
                ? <span>Day {currentChallengeDay} / 30 · challenge activity is recorded from saved workouts only.</span>
                : <span>Your 30-day journey hasn’t started.</span>}
              {!profile.challengeStartDate && <button type="button" className="secondary-button" onClick={startChallenge}>Start challenge</button>}
            </div>
            <p>
              {progress.thisWeek
                ? `You completed ${progress.thisWeek} workout${progress.thisWeek === 1 ? '' : 's'} this week.`
                : 'Your week is ready for a fresh start.'}
              {' '}Today I recommend a {profile.duration}-minute {workout?.difficulty?.toLowerCase() ?? 'moderate'} {profile.goal.toLowerCase()} session.
            </p>
            <div className="brief-metrics">
              <span><strong>{profile.duration} min</strong> recommended</span>
              <span><strong>{progress.streak} day{progress.streak === 1 ? '' : 's'}</strong> streak</span>
            </div>
            <p className="muted-copy">
              {progress.completed[0]
                ? `Latest: ${progress.completed[0].title} · ${formatDate(progress.completed[0].date)}`
                : 'Complete a workout to start building your activity memory.'}
            </p>
            <div className="recovery-indicator">
              <div><span>Flexora recovery indicator</span><strong>{adaptiveScores.recovery ? adaptiveScores.recoveryLabel : 'Not enough activity'}</strong></div>
              {adaptiveScores.recovery > 0 && <div className="progress-track"><span style={{ width: `${adaptiveScores.recovery}%` }} /></div>}
              <small>{adaptiveScores.recovery ? `${adaptiveScores.recovery}% app estimate from recent saved effort; not a medical measurement.` : 'Complete workouts and add effort feedback to build this indicator.'}</small>
            </div>
          </div>

          <div className="glass-card history-card" id="history">
            <div className="section-heading">
              <h3>Workout history</h3>
              <span>{history.length}</span>
            </div>
            {history.length === 0 ? (
              <p className="muted-copy">No sessions yet. Start your first plan.</p>
            ) : (
              history.map((entry) => (
                <button key={entry.id} type="button" className="history-row history-button" onClick={() => setSelectedHistory(entry)}>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{formatDate(entry.date)} · {entry.duration} min · {entry.goal}</span>
                  </div>
                  <span className={`mini-badge ${entry.completed ? 'done' : 'pending'}`}>
                    {entry.completed ? `Done${entry.difficulty ? ` · ${entry.difficulty}` : ''}` : 'In progress'}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="glass-card progress-card" id="progress">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Progress</span>
                <h3>Your consistency</h3>
              </div>
            </div>
            {progress.completed.length === 0 ? (
              <div className="progress-empty">
                <strong>Your journey starts here.</strong>
                <p className="muted-copy">Complete your first workout to unlock progress insights.</p>
              </div>
            ) : (
              <>
                <div className="progress-metrics">
                  <div><strong>{progress.completed.length}</strong><span>Workouts</span></div>
                  <div><strong>{progress.totalMinutes}</strong><span>Minutes</span></div>
                  <div><strong>{progress.streak}</strong><span>Day streak</span></div>
                  <div><strong>{progress.completionRate}%</strong><span>Completion</span></div>
                </div>
                <div className="weekly-activity">
                  <span>This week</span>
                  <strong>{progress.thisWeek} completed</strong>
                  <div className="progress-track"><span style={{ width: `${Math.min(100, progress.thisWeek / 4 * 100)}%` }} /></div>
                </div>
                <button type="button" className="secondary-button wide progress-ask-button" onClick={askAiProgress}>
                  Ask Flexora about my progress
                </button>
              </>
            )}
            {adaptiveScores.score === null ? (
              <div className="score-unlock">
                <span className="eyebrow">Flexora Score</span>
                <p>Complete a few workouts to unlock your Flexora Score.</p>
              </div>
            ) : (
              <div className="score-panel">
                <div className="score-ring" style={{ '--score-value': `${adaptiveScores.score}%` } as CSSProperties}>
                  <strong>{adaptiveScores.score}</strong><span>/ 100</span>
                </div>
                <div className="score-breakdown">
                  <strong>Flexora Score</strong>
                  <span>Consistency <b>{adaptiveScores.consistency}</b></span>
                  <span>Completion <b>{adaptiveScores.completion}</b></span>
                  <span>Progression <b>{adaptiveScores.progression}</b></span>
                  <span>Recovery balance <b>{adaptiveScores.recovery}</b></span>
                  <small>Application-generated motivation score, not a medical assessment.</small>
                </div>
              </div>
            )}
            <div className="recovery-dashboard">
              <span className="eyebrow">Flexora recovery indicator</span>
              <strong>{adaptiveScores.recovery ? `${adaptiveScores.recoveryLabel} · ${adaptiveScores.recovery}%` : 'Building from activity'}</strong>
              <span>{adaptiveScores.recovery ? 'Based on recent logged difficulty and activity frequency; not a physical measurement.' : 'Save a few workouts and effort ratings to establish a trend.'}</span>
            </div>
            <div className="difficulty-trend">
              <span className="eyebrow">Difficulty trend</span>
              <strong>{adaptiveScores.difficultyTrend}</strong>
            </div>
          </div>
        </aside>

        <section className="center-column">
          <div className="glass-card workout-card" id="workout">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Today’s plan</span>
                <h3>{workout?.title || 'Build your workout'}</h3>
              </div>
              <button type="button" className="primary-button" onClick={() => startNewWorkout()}>
                Generate workout
              </button>
            </div>

            {workout ? (
              <>
                <div className="workout-meta">
                  <span>{workout.goal}</span>
                  <span>{workout.duration} min</span>
                  <span>{workout.difficulty ?? workout.experience}</span>
                </div>
                <div className="difficulty-adaptation" aria-label="Workout difficulty progression">
                  <span className={workout.difficulty === 'Easy' ? 'active' : ''}>Easy</span>
                  <i className={workout.difficulty === 'Easy' ? 'active' : ''} />
                  <span className={workout.difficulty === 'Moderate' || !workout.difficulty ? 'active' : ''}>Moderate</span>
                  <i className={workout.difficulty === 'Moderate' || !workout.difficulty ? 'active' : ''} />
                  <span className={workout.difficulty === 'Hard' ? 'active' : ''}>Challenging</span>
                </div>
                {feedbackPrediction && <div className="next-session-prediction" role="status"><strong>Next session</strong><span>{feedbackPrediction}</span></div>}
                <p className="rationale">{workout.coachMessage ?? workout.rationale}</p>
                <div className="adaptive-explanation" aria-label="Why Flexora adapted this workout">
                  <strong>Why Flexora chose this workout</strong>
                  <p className="personalization-proof">Your workout was personalized based on your goal, time, and experience.</p>
                  <span>✓ Goal: {profile.goal}</span>
                  <span>✓ Available time: {workout.duration} min</span>
                  <span>✓ Experience: {workout.experience}</span>
                  <span>✓ Preferred type: {profile.workoutPreference ?? 'Balanced'}</span>
                  <span>✓ Equipment: {profile.equipment ?? 'NO EQUIPMENT'}</span>
                  <span>✓ Recent activity: {completedHistory.length} completed session{completedHistory.length === 1 ? '' : 's'}</span>
                  <span>✓ Recent feedback: {progress.completed[0]?.feedback ?? 'No feedback saved yet'}</span>
                  <span>✓ Recovery signal: {recentHardCount >= 2 || progress.completed[0]?.feedback === 'Hard' ? 'A lighter session is prioritized' : 'No recent high-effort pattern recorded'}</span>
                  {profile.preferences && <span>✓ Preferences: {profile.preferences}</span>}
                  <p>{workout.rationale}</p>
                </div>

                {workout.title.toLowerCase().includes('recovery') && (
                  <div className="recovery-banner">
                    <strong>Recovery mode</strong>
                    <span>Low-impact movement · mobility · stretching · light cardio</span>
                  </div>
                )}

                {workoutComplete ? (
                  <div className="completion-card">
                    <span className="eyebrow">Workout complete 🎉</span>
                    <h4>Nice work, {profile.name || 'athlete'}.</h4>
                    <p>{workout.duration} min · {completedExerciseCount} {completedExerciseCount === 1 ? 'exercise' : 'exercises'} completed · {workout.difficulty ?? 'Moderate'} effort</p>
                    <span className="saved-confirmation">✓ Saved to workout history</span>
                    <p className="muted-copy">{workout.rationale}</p>
                    <strong>How did this feel?</strong>
                    <div className="feedback-options">
                      <button type="button" className="secondary-button" onClick={() => submitWorkoutFeedback('Easy')}>😊 Too Easy</button>
                      <button type="button" className="secondary-button" onClick={() => submitWorkoutFeedback('Good')}>🙂 Just Right</button>
                      <button type="button" className="secondary-button" onClick={() => submitWorkoutFeedback('Hard')}>😓 Too Difficult</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="primary-button wide start-workout-button" onClick={startWorkout}>
                    Start workout
                  </button>
                )}

                <div className="exercise-section">
                  <h4>Warm-up</h4>
                  {workout.warmup.map((exercise) => (
                    <div className="exercise-row" key={`${workout.id}-warm-${exercise.name}`}>
                      <span>{exercise.name}</span>
                      <small>{exercise.detail}</small>
                    </div>
                  ))}
                </div>

                <div className="exercise-section">
                  <h4>Main workout</h4>
                  {workout.main.map((exercise) => (
                    <div className="exercise-row" key={`${workout.id}-main-${exercise.name}`}>
                      <span>{exercise.name}</span>
                      <small>{exercise.detail}</small>
                    </div>
                  ))}
                </div>

                <div className="exercise-section">
                  <h4>Cool down</h4>
                  {workout.cooldown.map((exercise) => (
                    <div className="exercise-row" key={`${workout.id}-cool-${exercise.name}`}>
                      <span>{exercise.name}</span>
                      <small>{exercise.detail}</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <button type="button" className="primary-button" onClick={() => startNewWorkout()}>
                Generate My Workout
              </button>
            )}
          </div>
        </section>

        <aside className="right-column">
          <div className="glass-card chat-card" id="coach">
            <div className="section-heading chat-header">
              <div>
                <span className="eyebrow">Flexora adapts with you</span>
                <h3>Your personal fitness agent</h3>
              </div>
              <button type="button" className="ghost-button" onClick={() => setMessages([initialAssistantMessage(profile)])}>
                Clear chat
              </button>
            </div>

            <div className="coach-modes" role="tablist" aria-label="Coach mode">
              <button type="button" role="tab" aria-selected={coachMode === 'text'} className={coachMode === 'text' ? 'active' : ''} onClick={() => setCoachMode('text')}>💬 Text</button>
              <button type="button" role="tab" aria-selected={coachMode === 'voice'} className={coachMode === 'voice' ? 'active' : ''} onClick={() => setCoachMode('voice')}>🎙️ Voice</button>
            </div>

            <div className="prompt-list">
              {getSuggestedPrompts(profile.goal).map((prompt) => (
                <button key={prompt} type="button" className="prompt-pill" disabled={typing} onClick={() => {
                  if (prompt === 'My Progress') void sendCoachMessage('How am I progressing?')
                  else void sendCoachMessage(prompt)
                }}>
                  {prompt}
                </button>
              ))}
            </div>

            {aiUnavailable && (
              <div className="status ai-fallback" role="status">
                Flexora AI is temporarily unavailable. Your local adaptive workout engine is still available.
              </div>
            )}

            <div className="chat-window" ref={chatRef}>
              {messages.map((message) => (
                <div key={message.id} className={`chat-message ${message.role}`}>
                  {message.text}
                </div>
              ))}

              {typing && <div className="chat-message assistant typing"><span className="typing-dots">Flexora is adapting your plan<span>.</span><span>.</span><span>.</span></span></div>}
            </div>

            {coachMode === 'text' && <form onSubmit={handlePromptSubmit} className="chat-form">
              <input
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask your coach…"
              />
              <button type="submit" className="primary-button" disabled={typing || !chatInput.trim()}>Send</button>
            </form>
            }

            {coachMode === 'voice' && (
              <section className="voice-panel" aria-label="Voice Coach">
                <span className="eyebrow">Voice Coach</span>
                <p className="voice-status" aria-live="polite">
                  {voiceStatus === 'listening'
                    ? 'Listening...'
                    : voiceStatus === 'thinking'
                      ? 'Flexora is thinking...'
                      : voiceStatus === 'responding'
                        ? 'Flexora'
                        : voiceStatus === 'error'
                          ? 'Text chat is ready'
                          : 'Tap to talk'}
                </p>
                <button
                  type="button"
                  className={`voice-microphone ${voiceStatus === 'listening' ? 'listening' : ''}`}
                  aria-label={voiceStatus === 'listening' ? 'Stop listening' : 'Talk to Flexora'}
                  onClick={startVoiceRecognition}
                  disabled={typing || voiceStatus === 'thinking'}
                >
                  <span aria-hidden="true">{voiceStatus === 'listening' ? '■' : '🎙️'}</span>
                </button>
                {voiceStatus === 'listening' && <div className="voice-wave" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
                {voiceTranscript && <p className="voice-transcript"><strong>You said:</strong> {voiceTranscript}</p>}
                {voiceStatus === 'responding' && (
                  <div className="voice-response">
                    <strong>Flexora</strong>
                    <p>{[...messages].reverse().find((message) => message.role === 'assistant')?.text}</p>
                  </div>
                )}
                {!speechRecognitionAvailable && (
                  <p className="voice-error">Voice input isn't supported on this device. Text guidance remains available.</p>
                )}
                {voiceError && <p className="voice-error" role="status">{voiceError}</p>}
                <div className="voice-speech-actions">
                  <button type="button" className="secondary-button" onClick={speakLastResponse} disabled={!messages.some((message) => message.role === 'assistant')}>🔊 Speak response</button>
                  <button type="button" className="ghost-button" onClick={stopSpeaking}>Stop speaking</button>
                </div>
                <p className="voice-memory-note">Voice and text guidance share your workout history and adaptive plan.</p>
              </section>
            )}
          </div>
        </aside>
      </main>

      <section className="journey-section" id="fitness-journey">
        <div className="journey-heading">
          <div>
            <span className="eyebrow">Consistency & Activity Journey</span>
            <h2>Your Fitness Journey</h2>
            <p>Training activity visualization based on completed workouts—not a body measurement or prediction.</p>
          </div>
          <div className="journey-heading-actions">
            {profile.challengeStartDate
              ? <strong className="challenge-day-badge">DAY {currentChallengeDay ?? '—'} / 30</strong>
              : <button type="button" className="primary-button" onClick={startChallenge}>Start 30-day challenge</button>}
            <button type="button" className="secondary-button" onClick={askAiProgress}>Ask Flexora about my progress</button>
          </div>
        </div>

        {!profile.challengeStartDate && (
          <div className="glass-card challenge-start-card">
            <div><span className="eyebrow">30-Day Challenge</span><h3>Your 30-day journey hasn’t started.</h3><p>Start when you’re ready. Challenge days are counted from today, while completed workouts come only from your saved history.</p></div>
            <button type="button" className="primary-button" onClick={startChallenge}>Start challenge</button>
          </div>
        )}

        {completedHistory.length === 0 && (
          <div className="glass-card journey-empty">
            <h3>Complete your first workout to start your fitness journey.</h3>
            <p className="muted-copy">This training progress visualization grows from activity you actually record.</p>
          </div>
        )}
            <div className="journey-layout">
              <div className="glass-card body-visual-card">
                <div className="section-heading">
                  <div><span className="eyebrow">Consistency-based visual representation</span><h3>Training progress visualization</h3></div>
                  <span className="journey-week-indicator">4-week activity</span>
                </div>
                <div className={`body-visual intensity-${Math.min(4, Math.floor(completedHistory.length / 2))}`}>
                  <svg viewBox="0 0 240 390" role="img" aria-label={`Selectable training focus body illustration. Selected area: ${selectedRegion}. No body composition measurement.`}>
                    <circle className="body-head" cx="120" cy="44" r="25" />
                    <path className={`body-shape body-chest ${selectedRegion === 'Chest' ? 'selected' : ''}`} d="M88 91 Q120 75 152 91 L160 143 Q145 160 120 160 Q95 160 80 143 Z" onClick={() => setSelectedRegion('Chest')} />
                    <path className={`body-shape body-core ${selectedRegion === 'Core' ? 'selected' : ''}`} d="M83 148 Q120 162 157 148 L150 222 Q120 232 90 222 Z" onClick={() => setSelectedRegion('Core')} />
                    <path className={`body-shape body-arms ${selectedRegion === 'Arms' ? 'selected' : ''}`} d="M84 96 L62 109 L38 185 L51 191 L81 137 L95 115 M156 96 L178 109 L202 185 L189 191 L159 137 L145 115" onClick={() => setSelectedRegion('Arms')} />
                    <path className={`body-shape body-legs ${selectedRegion === 'Legs' ? 'selected' : ''}`} d="M95 220 L88 286 L79 358 L96 362 L119 296 L125 230 M145 220 L152 286 L161 358 L144 362 L121 296 L115 230" onClick={() => setSelectedRegion('Legs')} />
                    <path className={`body-shape body-back ${selectedRegion === 'Back' ? 'selected' : ''}`} d="M91 100 Q120 83 149 100 L144 139 Q120 149 96 139 Z" onClick={() => setSelectedRegion('Back')} />
                    <path className="body-outline" d="M95 91 Q120 78 145 91 L161 107 L185 180 L197 190 M145 91 L167 133 L151 222 L160 286 L151 360 M95 91 L79 107 L55 180 L43 190 M95 91 L73 133 L89 222 L80 286 L89 360 M89 222 Q120 235 151 222" />
                  </svg>
                  <div className="body-labels">
                    {JOURNEY_REGIONS.map((region) => (
                      <button type="button" key={region} className={selectedRegion === region ? 'selected' : ''} aria-pressed={selectedRegion === region} onClick={() => setSelectedRegion(region)}>{region}</button>
                    ))}
                  </div>
                </div>
                <p className="visual-disclaimer">Visual emphasis reflects recorded training consistency only; it does not represent muscle growth, body fat, or a physical assessment.</p>
              </div>

              <div className="glass-card region-insight-card">
                <span className="eyebrow">Body focus</span>
                <h3>{selectedRegion}</h3>
                <div className="region-stats">
                  <div><strong>{regionActivity.count}</strong><span>recorded exercises</span></div>
                  <div><strong>{regionActivity.workoutCount}</strong><span>workouts with focus</span></div>
                </div>
                <p><strong>Consistency:</strong> {regionActivity.consistency}</p>
                <div className="region-recent">
                  <strong>Recent activity</strong>
                  {regionActivity.recent.length
                    ? regionActivity.recent.map((entry) => <span key={entry.key}>{entry.label}</span>)
                    : <span>No recorded {selectedRegion.toLowerCase()} activity yet.</span>}
                </div>
                <div className="region-next-step"><strong>Next step</strong><p>{regionActivity.recommendation}</p></div>
              </div>
            </div>

            <div className="journey-stats-grid">
              <div className="glass-card"><span>Workouts</span><strong>{progress.completed.length}</strong></div>
              <div className="glass-card"><span>Minutes</span><strong>{progress.totalMinutes}</strong></div>
              <div className="glass-card"><span>Streak</span><strong>{progress.streak} day{progress.streak === 1 ? '' : 's'}</strong></div>
              <div className="glass-card"><span>Completion</span><strong>{progress.completionRate}%</strong></div>
            </div>

            <div className="glass-card journey-calendar">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Activity from saved history</span>
                  <h3>{profile.challengeStartDate ? '30-day challenge map' : 'Recent activity calendar'}</h3>
                </div>
                {profile.challengeStartDate
                  ? <span>Day {currentChallengeDay ?? '—'} / 30</span>
                  : <button type="button" className="secondary-button" onClick={startChallenge}>Start 30-day challenge</button>}
              </div>
              {!profile.challengeStartDate && <p className="muted-copy">Your 30-day journey hasn’t started. Start the challenge to track challenge days.</p>}
              <div className="journey-calendar-grid">
                {journeyDays.map((day) => (
                  <button
                    type="button"
                    key={day.key}
                    className={`journey-day ${day.state}${day.isToday ? ' is-today' : ''}`}
                    aria-label={`${profile.challengeStartDate ? `Day ${day.dayNumber}, ` : ''}${day.date.toLocaleDateString()} · ${day.item ? `${day.item.completed ? 'completed' : 'in progress'} ${day.item.title}` : day.state}`}
                    title={day.item ? `${day.item.title} · ${day.item.duration} min` : `${day.date.toLocaleDateString()} · ${day.state}`}
                    onClick={() => {
                      if (day.item) setSelectedHistory(day.item)
                      else setSelectedJourneyDay(day)
                    }}
                  >
                    <span>{profile.challengeStartDate ? String(day.dayNumber).padStart(2, '0') : String(day.date.getDate()).padStart(2, '0')}</span>
                    <small>{day.state === 'completed' ? 'DONE' : day.state === 'recovery' ? 'REC' : day.state === 'unrecorded' ? '—' : day.state.toUpperCase()}</small>
                  </button>
                ))}
              </div>
              <div className="journey-calendar-legend" aria-label="Journey map legend">
                <span><i className="completed" /> Completed</span>
                <span><i className="recovery" /> Recovery</span>
                <span><i className="today" /> Today</span>
                <span><i className="in-progress" /> In progress</span>
                <span><i className="upcoming" /> Upcoming</span>
                <span><i className="rest" /> Rest</span>
                <span><i className="missed" /> Missed</span>
                <span><i className="no-session" /> Unrecorded</span>
              </div>
            </div>

            <div className="journey-detail-grid">
              <div className="glass-card journey-chart-card">
                <div className="section-heading"><div><span className="eyebrow">Real activity</span><h3>Weekly training</h3></div><span>Completed sessions</span></div>
                <div className="weekly-chart">
                  {weeklyActivity.map((week) => (
                    <div className="week-column" key={week.label}>
                      <strong>{week.count}</strong>
                      <div className="week-bar-track"><span style={{ height: `${week.count ? Math.max(10, (week.count / Math.max(1, ...weeklyActivity.map((item) => item.count))) * 100) : 0}%` }} /></div>
                      <span>{week.label}</span>
                      <small>{week.minutes} min</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card journey-insight-card">
                <span className="eyebrow">AI insight</span>
                {completedHistory.length < 3 ? (
                  <p>Complete a few more sessions to unlock meaningful progress insights.</p>
                ) : (
                  <>
                    <p>You completed {progress.thisMonth} workout{progress.thisMonth === 1 ? '' : 's'} this month. Your average session is {progress.averageMinutes} minutes.</p>
                    <p>{progress.thisWeek > progress.previousWeek
                      ? `You trained ${progress.thisWeek} times this week—up from ${progress.previousWeek} last week.`
                      : `You trained ${progress.thisWeek} times this week${progress.thisWeek === progress.previousWeek ? `, matching last week's ${progress.previousWeek}` : ''}.`}</p>
                    <p>Consistency: {progress.thisWeek >= progress.previousWeek ? 'maintaining or improving' : 'an opportunity to build'} your weekly routine.</p>
                  </>
                )}
                <button type="button" className="secondary-button" onClick={askAiProgress}>Ask Flexora about my progress</button>
              </div>
            </div>

            <div className="glass-card journey-milestones">
              <div className="journey-stage"><span>Start</span><strong>{profile.experience}</strong><small>Your selected experience</small></div>
              <span className="journey-arrow" aria-hidden="true">↓</span>
              <div className="journey-stage"><span>Current</span><strong>{progress.completed.length} workout{progress.completed.length === 1 ? '' : 's'}</strong><small>{progress.totalMinutes} recorded minutes · {progress.thisWeek} this week</small></div>
              <span className="journey-arrow" aria-hidden="true">↓</span>
              <div className="journey-stage"><span>Next goal</span><strong>{nextWorkoutGoal} workout{nextWorkoutGoal === 1 ? '' : 's'} / week</strong><small>Suggested consistency target—not a body measurement</small></div>
            </div>

            <div className="glass-card achievement-card">
              <div className="section-heading"><div><span className="eyebrow">Earned from your activity</span><h3>Milestones</h3></div></div>
              <div className="achievement-list">
                {[
                  { title: 'First Workout', earned: progress.completed.length >= 1 },
                  { title: '3 Day Streak', earned: progress.streak >= 3 },
                  { title: 'Consistency Champion', earned: progress.completed.length >= 10 && weeklyActivity.slice(-4).every((week) => week.count > 0) },
                  { title: '5 Workouts', earned: progress.completed.length >= 5 },
                  { title: '10 Workouts', earned: progress.completed.length >= 10 },
                  { title: '100 Minutes', earned: progress.totalMinutes >= 100 },
                  { title: '7 Day Streak', earned: progress.streak >= 7 },
                  { title: 'Recovery Master', earned: completedHistory.filter((item) => item.title.toLowerCase().includes('recovery')).length >= 3 },
                  { title: '30 Day Finisher', earned: currentChallengeDay === 30 && challengeCompletedCount >= 10 },
                ].map((achievement) => <span key={achievement.title} className={achievement.earned ? 'earned' : ''}>{achievement.earned ? '🏆' : '○'} {achievement.title}</span>)}
              </div>
            </div>
        <p className="fitness-disclaimer">Flexora provides general fitness guidance and progress visualization. It does not replace professional medical advice.</p>
      </section>

      <button
        type="button"
        className="voice-fab"
        aria-label="Open Flexora voice guidance"
        title="Open voice guidance"
        onClick={() => {
          setCoachMode('voice')
          document.getElementById('coach')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
      >
        <span aria-hidden="true">🎙️</span>
        <span>Voice</span>
      </button>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <div className="onboarding-scroll">
              <div className="onboarding-header">
                <div>
                  <span className="eyebrow">Onboarding</span>
                  <h3 id="onboarding-title">{currentStep.title}</h3>
                </div>
                <span className="step-indicator">
                  {onboardingStep + 1}/{onboardingSteps.length}
                </span>
              </div>

              <div className="onboarding-body">{currentStep.body}</div>

              <div className="field-stack">
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={draftProfile.name}
                    onChange={(event) => updateDraftField('name', event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span>Age</span>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={draftProfile.age || ''}
                    onChange={(event) => updateDraftField('age', Number(event.target.value))}
                    inputMode="numeric"
                  />
                </label>
                <fieldset className="workout-preference-picker">
                  <legend>Preferred workout type</legend>
                  <div className="workout-preference-options" role="group" aria-label="Preferred workout type">
                    {WORKOUT_PREFERENCES.map((preference) => (
                      <button
                        type="button"
                        key={preference}
                        className={`secondary-button ${(draftProfile.workoutPreference ?? 'Balanced') === preference ? 'selected' : ''}`}
                        aria-pressed={(draftProfile.workoutPreference ?? 'Balanced') === preference}
                        onClick={() => updateDraftField('workoutPreference', preference)}
                      >
                        {preference}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span>Preferences</span>
                  <input
                    type="text"
                    value={draftProfile.preferences}
                    onChange={(event) => updateDraftField('preferences', event.target.value)}
                    placeholder="Low impact, morning workout..."
                  />
                </label>
                <fieldset className="equipment-picker">
                  <legend>Available equipment</legend>
                  <div className="equipment-options">
                    {EQUIPMENT_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={draftProfile.equipment === option ? 'selected' : ''}
                        aria-pressed={draftProfile.equipment === option}
                        onClick={() => updateDraftField('equipment', option)}
                      >
                        <strong>{option}</strong>
                        <small>{option === 'NO EQUIPMENT' ? 'Bodyweight only' : option === 'BASIC EQUIPMENT' ? 'Bands or light weights' : 'Gym equipment'}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="onboarding-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setOnboardingStep((step) => Math.max(0, step - 1))}
                disabled={onboardingStep === 0}
              >
                Back
              </button>
              {onboardingStep < onboardingSteps.length - 1 ? (
                <button type="button" className="primary-button" onClick={() => setOnboardingStep((step) => step + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={completeOnboarding} disabled={!draftProfile.name.trim() || draftProfile.age < 10 || draftProfile.age > 100}>
                  Generate My Workout
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {playerOpen && currentExercise && (
        <div className="player-overlay">
          <section className="player-modal" role="dialog" aria-modal="true" aria-labelledby="player-title">
            <div className="player-topline">
              <span className="eyebrow">{playerResting ? 'Recovery pause' : 'Today’s adaptive workout'}</span>
              <span>Exercise {Math.min(playerIndex + 1, playerExercises.length)} of {playerExercises.length}</span>
            </div>
            <div className="player-progress"><span style={{ width: `${((playerIndex + (playerResting ? 0.5 : 0)) / playerExercises.length) * 100}%` }} /></div>
            <p className="eyebrow">{playerResting ? 'Take a breather' : 'Current exercise'}</p>
            <h2 id="player-title">{playerResting ? 'Rest and reset' : currentExercise.name}</h2>
            <p className="player-instructions">{playerResting ? 'Get ready for your next movement.' : currentGuidance.tips[0]}</p>

            {!playerResting && (
              <>
                <div className="player-mode-tabs" role="group" aria-label="Exercise mode">
                  <button type="button" aria-pressed={playerMode === 'watch'} className={playerMode === 'watch' ? 'active' : ''} onClick={() => setPlayerMode('watch')}>Watch</button>
                  <button type="button" aria-pressed={playerMode === 'practice'} className={playerMode === 'practice' ? 'active' : ''} onClick={() => setPlayerMode('practice')}>Practice</button>
                </div>
                <ExerciseAnimation exercise={currentExercise.name} playing={demoPlaying} slow={slowDemo} />
                <div className="demo-controls" aria-label="Demonstration controls">
                  <button type="button" className="secondary-button" onClick={() => setDemoPlaying((playing) => !playing)}>{demoPlaying ? 'Pause animation' : 'Play animation'}</button>
                  <button type="button" className="secondary-button" onClick={() => { setDemoPlaying(false); window.setTimeout(() => setDemoPlaying(true), 80) }}>Replay</button>
                  <button type="button" className="secondary-button" aria-pressed={slowDemo} onClick={() => setSlowDemo((slow) => !slow)}>{slowDemo ? 'Normal speed' : 'Slow demonstration'}</button>
                </div>
              </>
            )}

            <div className="player-live-stats">
              <div className="player-timer-ring" style={{ '--timer-progress': `${exerciseTimerProgress * 100}%` } as CSSProperties}>
                <span className="player-timer" aria-live="polite">{String(Math.floor(playerSeconds / 60)).padStart(2, '0')}:{String(playerSeconds % 60).padStart(2, '0')}</span>
                <small>{playerPaused ? 'PAUSED' : 'TIME LEFT'}</small>
              </div>
              <div className="player-stat-copy">
                <strong>{currentExercise.detail}</strong>
                <span>{currentGuidance.target}</span>
                <span>Difficulty: {currentExercise.difficulty ?? workout?.difficulty ?? 'Moderate'}</span>
                <span>Workout progress: {Math.max(playerProgressPercent, Math.round((completedExerciseCount / Math.max(1, playerExercises.length)) * 100))}%</span>
                <span>Elapsed: {String(Math.floor(playerElapsedSeconds / 60)).padStart(2, '0')}:{String(playerElapsedSeconds % 60).padStart(2, '0')}</span>
              </div>
            </div>

            <div className="duration-adjustment">
              <strong>Change duration</strong>
              <div className="duration-options">
                {([5, 10, 20, 30] as const).map((duration) => (
                  <button type="button" key={duration} className="secondary-button" onClick={() => setPendingDuration(duration)}>{duration} min</button>
                ))}
              </div>
              {pendingDuration !== null && (
                <div className="duration-confirmation" role="group" aria-label="Confirm remaining workout adjustment">
                  <p>Adjust the remaining workout to {pendingDuration} minutes? Completed exercises, your current movement, and elapsed time will stay in place.</p>
                  <button type="button" className="primary-button" onClick={() => adjustRemainingWorkout(pendingDuration)}>Adjust remaining workout</button>
                  <button type="button" className="ghost-button" onClick={() => setPendingDuration(null)}>Keep current</button>
                </div>
              )}
            </div>

            {playerMode === 'practice' && !playerResting && (
              <div className="practice-counter">
                {exerciseRepTarget > 0 ? (
                  <>
                    <div><strong>{practiceReps}</strong><span> / {exerciseRepTarget} reps</span></div>
                    <button type="button" className="primary-button" onClick={() => setPracticeProgress({ exerciseIndex: playerIndex, reps: Math.min(exerciseRepTarget, practiceReps + 1) })} disabled={practiceReps >= exerciseRepTarget}>Tap for each rep</button>
                  </>
                ) : (
                  <p>Follow the timer at a comfortable pace. The demonstration remains visible while you practice.</p>
                )}
              </div>
            )}

            {!playerResting && (
              <div className="form-guidance">
                <div><strong>Form tips</strong>{currentGuidance.tips.map((tip) => <span key={tip}>{tip}</span>)}</div>
                <div><strong>Breathing</strong><span>{currentGuidance.breathing}</span></div>
                <div><strong>Watch for</strong><span>{currentGuidance.mistake}</span></div>
                <div><strong>Scale it</strong><span>Easier: {currentGuidance.easier}</span><span>Progression: {currentGuidance.progress}</span></div>
              </div>
            )}

            {!playerResting && (
              <div className="replacement-area">
                <button type="button" className="ghost-button" aria-expanded={showReplacement} onClick={() => setReplacementExerciseIndex(showReplacement ? null : playerIndex)}>Can’t do this? Choose an alternative</button>
                {showReplacement && (
                  <div className="replacement-options">
                    <strong>Choose an alternative to {currentExercise.name}</strong>
                    {replacementOptions.map((option) => (
                      <button type="button" key={option.name} onClick={() => replaceCurrentExercise(option)}>
                        <span><strong>{option.name}</strong><small>{option.detail} · {option.target} · {option.difficulty}</small><small>{option.instructions}</small></span>
                        <span aria-hidden="true">Replace</span>
                      </button>
                    ))}
                    <p>Selected for a similar movement pattern at a more manageable intensity. Your timer and workout position stay the same.</p>
                  </div>
                )}
                {replacementNotice && <p className="replacement-notice" role="status"><strong>Exercise replaced.</strong> {replacementNotice}</p>}
              </div>
            )}

            <div className="player-voice-controls">
              <button type="button" className="secondary-button" onClick={startVoiceRecognition} disabled={typing || voiceStatus === 'thinking'}>
                {voiceStatus === 'listening' ? 'Stop voice command' : '🎙️ Voice command'}
              </button>
              <span role="status" aria-live="polite">
                {voiceStatus === 'listening' ? 'Listening for a workout command…' : voiceError}
              </span>
            </div>

            <div className="player-controls">
              <button type="button" className="secondary-button" onClick={() => setPlayerPaused((paused) => !paused)}>{playerPaused ? 'Resume' : 'Pause'}</button>
              <button type="button" className="secondary-button" onClick={() => {
                setCompletedExerciseCount((count) => Math.max(count, playerIndex + 1))
                setPlayerResting(false)
                setPlayerIndex((index) => Math.min(index + 1, playerExercises.length - 1))
                setPlayerSeconds(getExerciseSeconds(playerExercises[playerIndex + 1]))
              }}>Skip</button>
              <button type="button" className="secondary-button" onClick={() => {
                if (playerIndex >= playerExercises.length - 1) {
                  finishWorkout()
                  return
                }
                setCompletedExerciseCount((count) => Math.max(count, playerIndex + 1))
                setPlayerResting(false)
                setPlayerIndex((index) => Math.min(index + 1, playerExercises.length - 1))
                setPlayerSeconds(getExerciseSeconds(playerExercises[playerIndex + 1]))
              }}>Next exercise</button>
              <button type="button" className="primary-button" onClick={() => finishWorkout(Math.max(completedExerciseCount, playerIndex + (playerResting ? 0 : 1)))}>Finish workout</button>
            </div>
          </section>
        </div>
      )}

      {selectedHistory && (
        <div className="detail-overlay" onClick={() => setSelectedHistory(null)}>
          <section className="history-detail-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <div><span className="eyebrow">Workout details</span><h3 id="history-detail-title">{selectedHistory.title}</h3></div>
              <button type="button" className="ghost-button" onClick={() => setSelectedHistory(null)}>Close</button>
            </div>
            <p>{formatDate(selectedHistory.date)} · {selectedHistory.duration} min · {selectedHistory.goal}</p>
            <p>Difficulty: {selectedHistory.difficulty ?? 'Not recorded'} · {selectedHistory.completed ? `Completed · ${selectedHistory.exercisesCompleted ?? 0} exercises` : 'In progress'}{selectedHistory.feedback ? ` · Feedback: ${selectedHistory.feedback}` : ''}</p>
            {selectedHistory.workout?.main.map((exercise) => <div className="exercise-row" key={`${selectedHistory.id}-${exercise.name}`}><span>{exercise.name}</span><small>{exercise.detail}</small></div>)}
          </section>
        </div>
      )}

      {selectedJourneyDay && (
        <div className="detail-overlay" onClick={() => setSelectedJourneyDay(null)}>
          <section className="history-detail-modal journey-day-modal" role="dialog" aria-modal="true" aria-labelledby="journey-day-title" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <div><span className="eyebrow">{profile.challengeStartDate ? `Day ${selectedJourneyDay.dayNumber} / 30` : 'Activity calendar'}</span><h3 id="journey-day-title">{selectedJourneyDay.date.toLocaleDateString()}</h3></div>
              <button type="button" className="ghost-button" onClick={() => setSelectedJourneyDay(null)}>Close</button>
            </div>
            <p>Status: <strong>{selectedJourneyDay.state.toUpperCase()}</strong></p>
            {selectedJourneyDay.state === 'today' && <p>Your workout is ready when you are. Today is not counted as complete until a workout is saved.</p>}
            {selectedJourneyDay.state === 'upcoming' && <p>This challenge day is upcoming. Activity will appear here only after it is recorded.</p>}
            {selectedJourneyDay.state === 'unrecorded' && <p>No workout is saved for this date. Unrecorded days do not count as completed workouts.</p>}
            {profile.challengeStartDate && ['unrecorded', 'rest', 'missed'].includes(selectedJourneyDay.state) && selectedJourneyDay.date < parseLocalDay(getTodayKey()) && (
              <div className="journey-day-actions">
                <button type="button" className="secondary-button" onClick={() => saveJourneyDayStatus(selectedJourneyDay, 'rest')}>Mark as rest day</button>
                <button type="button" className="ghost-button" onClick={() => saveJourneyDayStatus(selectedJourneyDay, 'missed')}>Mark as missed</button>
              </div>
            )}
            {selectedJourneyDay.state === 'rest' && (
              <button type="button" className="ghost-button" onClick={() => setProfile((current) => {
                const notes = { ...(current.challengeDayNotes ?? {}) }
                delete notes[selectedJourneyDay.key]
                return { ...current, challengeDayNotes: notes }
              })}>Clear rest-day note</button>
            )}
            {selectedJourneyDay.state === 'missed' && (
              <button type="button" className="ghost-button" onClick={() => setProfile((current) => {
                const notes = { ...(current.challengeDayNotes ?? {}) }
                delete notes[selectedJourneyDay.key]
                return { ...current, challengeDayNotes: notes }
              })}>Clear missed-day note</button>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
