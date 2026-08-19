"use client"

import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const

interface StarRatingProps {
  value: number | null
  onChange: (value: number) => void
  id?: string
}

export function StarRating({ value, onChange, id }: StarRatingProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="评分，最高五星，可点选半星"
      className="flex items-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fullValue = star
        const halfValue = star - 0.5
        const filled = value != null && value >= fullValue
        const half = value != null && value >= halfValue && value < fullValue

        return (
          <span key={star} className="relative inline-flex size-8">
            <Star
              className="size-8 text-[#C4B5FD]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-0 overflow-hidden"
              style={{ width: filled ? "100%" : half ? "50%" : "0%" }}
              aria-hidden="true"
            >
              <Star
                className="size-8 fill-[#8B5CF6] text-[#8B5CF6]"
                strokeWidth={1.5}
              />
            </span>
            <button
              type="button"
              role="radio"
              aria-checked={value === halfValue}
              aria-label={`${halfValue} 星`}
              className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer rounded-l-sm touch-manipulation"
              onClick={() => onChange(halfValue)}
            />
            <button
              type="button"
              role="radio"
              aria-checked={value === fullValue}
              aria-label={`${fullValue} 星`}
              className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer rounded-r-sm touch-manipulation"
              onClick={() => onChange(fullValue)}
            />
          </span>
        )
      })}
      <span
        className={cn(
          "ml-2 min-w-10 text-sm tabular-nums",
          value ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {value ? `${value} / 5` : "未评分"}
      </span>
    </div>
  )
}

export function isValidStarRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (STEPS as readonly number[]).includes(value)
  )
}
