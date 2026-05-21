"use client"

import { useEffect, useState } from "react"

const WX_ICONS: [number, string][] = [
  [0,  "☀"],
  [3,  "⛅"],
  [48, "🌫"],
  [55, "🌦"],
  [67, "🌧"],
  [77, "🌨"],
  [82, "🌦"],
  [99, "⛈"],
]

const WX_LABELS: [number, string][] = [
  [0,  "CLEAR SKY"],
  [1,  "MOSTLY CLEAR"],
  [2,  "PARTLY CLOUDY"],
  [3,  "OVERCAST"],
  [48, "FOG"],
  [55, "DRIZZLE"],
  [65, "RAIN"],
  [75, "SNOW"],
  [82, "SHOWERS"],
  [95, "THUNDERSTORM"],
]

function wxIcon(code: number)  { return ([...WX_ICONS].reverse().find(([m]) => code <= m)  ?? WX_ICONS[WX_ICONS.length - 1])[1] }
function wxLabel(code: number) { return ([...WX_LABELS].reverse().find(([m]) => code <= m) ?? WX_LABELS[WX_LABELS.length - 1])[1] }

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

interface Forecast {
  current: { temp: number; code: number }
  daily: { label: string; code: number; max: number; min: number }[]
}

export default function WeatherWidget() {
  const [data, setData] = useState<Forecast | null>(null)

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=50.8503&longitude=4.3517" +
      "&current=temperature_2m,weathercode" +
      "&daily=temperature_2m_max,temperature_2m_min,weathercode" +
      "&timezone=Europe%2FBrussels&forecast_days=5"
    )
      .then(r => r.json())
      .then(d => {
        setData({
          current: {
            temp: Math.round(d.current.temperature_2m),
            code: d.current.weathercode,
          },
          daily: (d.daily.time as string[]).map((dateStr: string, i: number) => ({
            label: i === 0 ? "TODAY" : DAY_NAMES[new Date(dateStr).getDay()],
            code:  d.daily.weathercode[i],
            max:   Math.round(d.daily.temperature_2m_max[i]),
            min:   Math.round(d.daily.temperature_2m_min[i]),
          })),
        })
      })
      .catch(() => {})
  }, [])

  if (!data) return null

  return (
    <div
      className="overflow-hidden border border-[#1c2a3a]/80 shadow-2xl backdrop-blur-sm"
      style={{ width: 240, background: "rgba(8,12,18,0.82)" }}
    >
      {/* Current conditions */}
      <div className="px-3 pt-3 pb-2 border-b border-[#1c2a3a]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{wxIcon(data.current.code)}</span>
            <span className="font-mono text-2xl font-bold text-white tabular-nums leading-none">
              {data.current.temp}°
            </span>
          </div>
          <span className="font-mono text-[9px] text-[#3d4f64] tracking-widest">BXL</span>
        </div>
        <p className="font-mono text-[9px] text-[#6e7f96] tracking-[.15em] mt-1.5">
          {wxLabel(data.current.code)}
        </p>
      </div>

      {/* 5-day forecast */}
      <div className="px-3 py-2 flex flex-col gap-1">
        {data.daily.map((day, i) => (
          <div key={i} className="flex items-center">
            <span className="font-mono text-[9px] tracking-[.12em] w-12 flex-shrink-0"
              style={{ color: i === 0 ? "#c9d1d9" : "#6e7f96" }}>
              {day.label}
            </span>
            <span className="text-sm leading-none w-6 flex-shrink-0">{wxIcon(day.code)}</span>
            <span className="font-mono text-[10px] text-[#c9d1d9] tabular-nums ml-auto">{day.max}°</span>
            <span className="font-mono text-[10px] text-[#3d4f64] tabular-nums ml-2 w-7 text-right">{day.min}°</span>
          </div>
        ))}
      </div>
    </div>
  )
}
