'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, KeyRound, Plug, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  createMcpToken,
  listMcpTokens,
  revokeMcpToken,
  type McpTokenSummary,
} from './mcp-actions'

type McpConnectDialogProps = {
  mcpUrl: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function McpConnectDialog({ mcpUrl }: McpConnectDialogProps) {
  const [open, setOpen] = useState(false)
  const [tokens, setTokens] = useState<McpTokenSummary[]>([])
  const [name, setName] = useState('My agent')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [baseUrl, setBaseUrl] = useState(mcpUrl)

  useEffect(() => {
    if (mcpUrl) return
    setBaseUrl(`${window.location.origin}/api/mcp`)
  }, [mcpUrl])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      setTokens(await listMcpTokens())
    } catch {
      setError('Could not load your credentials')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setError('')
    setNewToken(null)
    void refresh()
  }, [open, refresh])

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isCreating) return
    setIsCreating(true)
    setError('')

    try {
      const result = await createMcpToken(name)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNewToken(result.token)
      setTokens((prev) => [result.record, ...prev])
      toast.success('Credential created')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    if (revokingId) return
    setRevokingId(tokenId)
    setError('')

    try {
      const result = await revokeMcpToken(tokenId)
      if (!result.success) {
        setError(result.error ?? 'Could not revoke credential')
        return
      }
      setTokens((prev) => prev.filter((token) => token.id !== tokenId))
      toast.success('Credential revoked')
    } finally {
      setRevokingId(null)
    }
  }

  const tokenForSnippet = newToken ?? '<YOUR_TOKEN>'
  const url = baseUrl || '/api/mcp'

  const cursorSnippet = `{
  "mcpServers": {
    "broke-besties": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${tokenForSnippet}"
      }
    }
  }
}`

  const claudeDesktopSnippet = `{
  "mcpServers": {
    "broke-besties": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${url}",
        "--header",
        "Authorization: Bearer ${tokenForSnippet}"
      ]
    }
  }
}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plug />
          Add MCP to your agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Broke Besties to your agent</DialogTitle>
          <DialogDescription>
            Connect Claude, Cursor, or any MCP client to your real groups,
            debts, and friends using a bearer credential.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Connection</h3>
          <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Server URL</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copy(url, 'URL')}
              >
                <Copy />
                Copy
              </Button>
            </div>
            <code className="break-all text-xs">{url}</code>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Authorization header
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!newToken}
                onClick={() =>
                  copy(`Authorization: Bearer ${newToken ?? ''}`, 'Header')
                }
              >
                <Copy />
                Copy
              </Button>
            </div>
            <code className="break-all text-xs">
              Authorization: Bearer {tokenForSnippet}
            </code>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Credentials</h3>
            <Badge variant="secondary">{tokens.length}</Badge>
          </div>

          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <Label htmlFor="mcp-token-name">Name</Label>
              <Input
                id="mcp-token-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Claude Desktop"
              />
            </div>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? <Spinner /> : <KeyRound />}
              Generate
            </Button>
          </form>

          {newToken && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium">
                Copy this credential now — it is shown only once.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">
                  {newToken}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(newToken, 'Credential')}
                >
                  <Copy />
                  Copy
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Loading credentials…
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No credentials yet. Generate one to connect an agent.
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {token.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(token.createdAt)}
                      {token.lastUsedAt
                        ? ` · Last used ${formatDate(token.lastUsedAt)}`
                        : ' · Never used'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revokingId !== null}
                    onClick={() => handleRevoke(token.id)}
                  >
                    {revokingId === token.id ? <Spinner /> : <Trash2 />}
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Client config</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Cursor / clients with header support
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copy(cursorSnippet, 'Config')}
              >
                <Copy />
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
              {cursorSnippet}
            </pre>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Claude Desktop via mcp-remote
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copy(claudeDesktopSnippet, 'Config')}
              >
                <Copy />
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
              {claudeDesktopSnippet}
            </pre>
          </div>
          {!newToken && (
            <p className="text-xs text-muted-foreground">
              Replace <code>&lt;YOUR_TOKEN&gt;</code> with a credential you
              generate above. If your client supports remote MCP with custom
              headers, use the same URL and bearer credential.
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
