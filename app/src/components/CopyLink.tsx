import { useState } from 'react'

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    await navigator.share({ title: 'Invitación a Budget App', url })
  }

  return (
    <div className="copy-link">
      <input readOnly value={url} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copy}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      {'share' in navigator && (
        <button type="button" onClick={share}>
          Compartir
        </button>
      )}
    </div>
  )
}
