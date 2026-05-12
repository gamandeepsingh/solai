interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  positive?: boolean
}

export default function SparklineChart({ data, width = 64, height = 28, positive = true }: SparklineProps) {
  if (data.length < 2) return <div style={{ width, height }} />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return [x, y] as [number, number]
  })

  const d = pts
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ')

  const fillPts = [
    `M${pts[0][0]},${height}`,
    ...pts.map(([x, y]) => `L${x},${y}`),
    `L${pts[pts.length - 1][0]},${height}`,
    'Z',
  ].join(' ')

  const color = positive ? '#ABFF7A' : '#FF6B6B'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${positive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPts} fill={`url(#sg-${positive ? 'pos' : 'neg'})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
