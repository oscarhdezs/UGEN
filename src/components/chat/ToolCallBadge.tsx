"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

export function getToolCallLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = typeof args.path === "string" ? args.path : "";
  const suffix = path ? ` ${path}` : "";

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":
        return `Creating${suffix}`;
      case "str_replace":
        return `Editing${suffix}`;
      case "insert":
        return `Editing${suffix}`;
      case "view":
        return `Viewing${suffix}`;
      case "undo_edit":
        return `Undoing edit${suffix}`;
    }
  }

  if (toolName === "file_manager") {
    switch (args.command) {
      case "rename":
        return `Renaming${suffix}`;
      case "delete":
        return `Deleting${suffix}`;
    }
  }

  return toolName;
}

export function ToolCallBadge({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation;
}) {
  const args = (toolInvocation.args ?? {}) as Record<string, unknown>;
  const label = getToolCallLabel(toolInvocation.toolName, args);
  const isDone =
    toolInvocation.state === "result" &&
    Boolean((toolInvocation as { result?: unknown }).result);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div
          data-testid="done-indicator"
          className="w-2 h-2 rounded-full bg-emerald-500"
        />
      ) : (
        <Loader2
          data-testid="spinner"
          className="w-3 h-3 animate-spin text-blue-600"
        />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
