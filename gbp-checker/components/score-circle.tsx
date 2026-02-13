'use client'

import { useEffect, useState } from 'react'
import { getScoreStrokeColor, getScoreLabel } from '@/lib/constants'

interface ScoreCircleProps {
  score: number
  size?: number
}

export default function ScoreCircle({ score, size = 200 }: ScoreCircleProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const strokeWidth = size * 0.08
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedScore / 100) * circumference
  const color = getScoreStrokeColor(score)
  const label = getScoreLabel(score)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedScore(score)
    }, 100)
    return () => clearTimeout(timeout)
  }, [score])

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-light"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold leading-none"
          style={{ fontSize: size * 0.28, color }}
        >
          {Math.round(animatedScore)}
        </span>
        <span
          className="mt-1 text-text-secondary"
          style={{ fontSize: size * 0.09 }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
