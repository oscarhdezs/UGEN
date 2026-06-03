import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getToolCallLabel, ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

// --- getToolCallLabel ---

test("str_replace_editor create returns Creating with path", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "create", path: "/App.jsx" })
  ).toBe("Creating /App.jsx");
});

test("str_replace_editor str_replace returns Editing with path", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "str_replace", path: "/components/Card.jsx" })
  ).toBe("Editing /components/Card.jsx");
});

test("str_replace_editor insert returns Editing with path", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "insert", path: "/App.jsx" })
  ).toBe("Editing /App.jsx");
});

test("str_replace_editor view returns Viewing with path", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "view", path: "/App.jsx" })
  ).toBe("Viewing /App.jsx");
});

test("str_replace_editor undo_edit returns Undoing edit with path", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })
  ).toBe("Undoing edit /App.jsx");
});

test("file_manager rename returns Renaming with path", () => {
  expect(
    getToolCallLabel("file_manager", { command: "rename", path: "/old.jsx" })
  ).toBe("Renaming /old.jsx");
});

test("file_manager delete returns Deleting with path", () => {
  expect(
    getToolCallLabel("file_manager", { command: "delete", path: "/App.jsx" })
  ).toBe("Deleting /App.jsx");
});

test("unknown tool returns tool name as-is", () => {
  expect(getToolCallLabel("some_other_tool", { command: "run" })).toBe(
    "some_other_tool"
  );
});

test("str_replace_editor with unknown command falls back to tool name", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "unknown_cmd" })
  ).toBe("str_replace_editor");
});

test("label omits path suffix when path is missing", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "create" })
  ).toBe("Creating");
});

test("label omits path suffix when path is not a string", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "create", path: 42 })
  ).toBe("Creating");
});

// --- ToolCallBadge component ---

function makeInvocation(
  overrides: Partial<ToolInvocation> & { toolName: string; args: object }
): ToolInvocation {
  return {
    toolCallId: "test-id",
    state: "call",
    ...overrides,
  } as ToolInvocation;
}

test("shows spinner when state is call", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "call",
      })}
    />
  );
  expect(screen.getByTestId("spinner")).toBeDefined();
  expect(screen.queryByTestId("done-indicator")).toBeNull();
});

test("shows done indicator when state is result with a result value", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "File created: /App.jsx",
      })}
    />
  );
  expect(screen.getByTestId("done-indicator")).toBeDefined();
  expect(screen.queryByTestId("spinner")).toBeNull();
});

test("shows spinner when state is result but result is falsy", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: null,
      })}
    />
  );
  expect(screen.getByTestId("spinner")).toBeDefined();
});

test("renders friendly label for create command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "ok",
      })}
    />
  );
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("renders friendly label for str_replace command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/components/Card.jsx" },
        state: "call",
      })}
    />
  );
  expect(screen.getByText("Editing /components/Card.jsx")).toBeDefined();
});

test("renders friendly label for file_manager delete", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "file_manager",
        args: { command: "delete", path: "/old.jsx" },
        state: "result",
        result: { success: true },
      })}
    />
  );
  expect(screen.getByText("Deleting /old.jsx")).toBeDefined();
});

test("renders raw tool name for unknown tool", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation({
        toolName: "custom_tool",
        args: {},
        state: "call",
      })}
    />
  );
  expect(screen.getByText("custom_tool")).toBeDefined();
});
