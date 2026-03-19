import type { ReactNode } from 'react'

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) nodes.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>)
    if (m[2]) nodes.push(
      <code key={m.index} className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono break-all">{m[2]}</code>
    )
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <span className="whitespace-pre-wrap">
      {lines.map((line, i) => {
        const isBullet = line.startsWith('• ') || line.startsWith('- ')
        const text = isBullet ? line.slice(2) : line
        return (
          <span key={i} className={isBullet ? 'flex gap-1.5 my-0.5' : 'block'}>
            {isBullet && <span className="opacity-40 shrink-0 mt-px">•</span>}
            <span>{parseInline(text)}</span>
          </span>
        )
      })}
    </span>
  )
}
