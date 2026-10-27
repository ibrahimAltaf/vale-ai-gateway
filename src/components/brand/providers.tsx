import { cn } from "@/lib/cn";

export function ProviderMark({ id, className }: { id: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-raised ring-1 ring-line", className)} aria-hidden>
      {id === "openai" ? <OpenAiIcon /> : id === "anthropic" ? <AnthropicIcon /> : id === "google" ? <GoogleIcon /> : <span className="text-xs">{id.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export function providerLabel(id: string): string {
  if (id === "openai") return "OpenAI";
  if (id === "anthropic") return "Anthropic";
  if (id === "google") return "Google";
  return id;
}

function OpenAiIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#10a37f]" fill="currentColor">
      <path d="M22.28 12.63a4.95 4.95 0 0 0-.43-3.53 5.02 5.02 0 0 0-5.4-2.4 5.02 5.02 0 0 0-3.72-3.35 5.05 5.05 0 0 0-4.7 1.3 5.02 5.02 0 0 0-3.35.86A5.04 5.04 0 0 0 1.72 9.4a4.95 4.95 0 0 0 .43 3.53 5.02 5.02 0 0 0 5.4 2.4 5.02 5.02 0 0 0 3.72 3.35 5.05 5.05 0 0 0 4.7-1.3 5.02 5.02 0 0 0 3.35-.86 5.04 5.04 0 0 0 2.96-3.89Zm-9.7 4.4a3.72 3.72 0 0 1-2.39-.85l.12-.07 4.02-2.32a.21.21 0 0 0 .1-.18v-5.66l1.7.98a.2.2 0 0 1 .1.15v4.68a3.74 3.74 0 0 1-3.65 3.27Zm-7.85-3.36a3.72 3.72 0 0 1-.45-2.5l.12.07 4.03 2.32c.06.04.14.04.2 0l4.91-2.83v1.96a.2.2 0 0 1-.08.17l-4.06 2.34a3.74 3.74 0 0 1-4.67-1.53Zm-.51-6.1a3.72 3.72 0 0 1 1.96-1.66v4.77c0 .07.04.14.1.18l4.91 2.83-1.7.98a.21.21 0 0 1-.2 0L6.82 11.4a3.74 3.74 0 0 1-2.6-3.83Zm13.4 3.12-4.91-2.83 1.7-.98a.21.21 0 0 1 .2 0l4.06 2.34a3.74 3.74 0 0 1-.56 6.74v-4.77a.2.2 0 0 0-.1-.18Zm1.62-2.51-.12-.07-4.03-2.32a.21.21 0 0 0-.2 0l-4.91 2.83V6.94a.2.2 0 0 1 .08-.17l4.06-2.34a3.74 3.74 0 0 1 5.12 4.87Z" />
    </svg>
  );
}

function AnthropicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#d4a27f]" fill="currentColor">
      <path d="M16.7 5H13.9L8.1 19h2.8l1.1-2.8h5.8L19 19h2.9L16.7 5Zm-3.4 8.6 2-5.1 2 5.1h-4Zm-5.5-3.3L6.3 13H2.1L7.1 5h2.7l5 12.3-1.6 1.7L7.8 10.3Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3A7.2 7.2 0 0 1 4.9 12c0-.8.1-1.6.4-2.3V6.6H1.2A12 12 0 0 0 0 12c0 1.9.5 3.8 1.2 5.4l4.1-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.1 15.2 0 12 0A12 12 0 0 0 1.2 6.6l4.1 3.1C6.2 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}
