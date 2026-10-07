import { translate, type Language } from './i18n'

type ExerciseAnimationProps = {
  exercise: string
  playing: boolean
  slow: boolean
  language?: Language
}

const getMotion = (exercise: string) => {
  const name = exercise.toLowerCase()
  if (/push.?up|plank|shoulder tap|mountain climber|bird dog/.test(name)) return 'floor'
  if (/squat|lunge|wall sit|calf raise|high knee|march|step/.test(name)) return 'lower'
  if (/jack|jump|fast feet|burpee|skater/.test(name)) return 'cardio'
  if (/crunch|bridge|dead bug|hollow/.test(name)) return 'core'
  if (/stretch|arm circle|breathing|mobility|cat.?cow/.test(name)) return 'stretch'
  return 'flow'
}

export function ExerciseAnimation({ exercise, playing, slow, language = 'en' }: ExerciseAnimationProps) {
  const motion = getMotion(exercise)
  const localizedExercise = translate(exercise, language)

  return (
    <div
      className={`exercise-demo motion-${motion}${playing ? ' is-playing' : ' is-paused'}${slow ? ' is-slow' : ''}`}
      role="img"
      aria-label={language === 'ta'
        ? `${localizedExercise} இயக்க விளக்கம்`
        : `Animated ${exercise} movement demonstration`}
    >
      <span className="demo-orbit demo-orbit-one" aria-hidden="true" />
      <span className="demo-orbit demo-orbit-two" aria-hidden="true" />
      <svg viewBox="0 0 240 180" aria-hidden="true">
        <defs>
          <linearGradient id="demo-body-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb08c" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <ellipse className="demo-ground" cx="120" cy="151" rx="66" ry="8" />
        <g className="demo-figure">
          <circle className="demo-head" cx="120" cy="35" r="13" />
          <path className="demo-torso" d="M120 50 L120 96" />
          <path className="demo-arm demo-arm-left" d="M120 59 L91 78 L79 101" />
          <path className="demo-arm demo-arm-right" d="M120 59 L149 78 L161 101" />
          <path className="demo-leg demo-leg-left" d="M120 96 L99 121 L91 148" />
          <path className="demo-leg demo-leg-right" d="M120 96 L141 121 L149 148" />
          <circle className="demo-joint" cx="120" cy="59" r="4" />
          <circle className="demo-joint" cx="120" cy="96" r="4" />
        </g>
        <path className="demo-motion-line" d="M36 140 Q22 118 36 96 M204 96 Q218 118 204 140" />
      </svg>
      <span className="demo-caption">{language === 'ta'
        ? `இயக்க வழிகாட்டி · ${localizedExercise}`
        : `MOVEMENT GUIDE · ${exercise.toUpperCase()}`}</span>
    </div>
  )
}
