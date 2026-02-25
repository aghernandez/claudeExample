import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MainContent } from "../main-content";

// Mock heavy dependencies
vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">Header</div>,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("shows preview by default", () => {
  render(<MainContent />);

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("clicking Code button switches to code view", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByText("Code"));

  expect(screen.getByTestId("code-editor")).toBeDefined();
  expect(screen.getByTestId("file-tree")).toBeDefined();
  expect(screen.queryByTestId("preview-frame")).toBeNull();
});

test("clicking Preview button switches back to preview view", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByText("Code"));
  fireEvent.click(screen.getByText("Preview"));

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("toggling multiple times works correctly", () => {
  render(<MainContent />);

  // Start: preview
  expect(screen.getByTestId("preview-frame")).toBeDefined();

  // Switch to code
  fireEvent.click(screen.getByText("Code"));
  expect(screen.getByTestId("code-editor")).toBeDefined();

  // Switch back to preview
  fireEvent.click(screen.getByText("Preview"));
  expect(screen.getByTestId("preview-frame")).toBeDefined();

  // Switch to code again
  fireEvent.click(screen.getByText("Code"));
  expect(screen.getByTestId("code-editor")).toBeDefined();
});

test("clicking the currently active button does not break the view", () => {
  render(<MainContent />);

  // Click Preview when already on preview
  fireEvent.click(screen.getByText("Preview"));
  expect(screen.getByTestId("preview-frame")).toBeDefined();

  // Switch to code
  fireEvent.click(screen.getByText("Code"));
  // Click Code when already on code
  fireEvent.click(screen.getByText("Code"));
  expect(screen.getByTestId("code-editor")).toBeDefined();
});

test("Preview button has active styling when on preview view", () => {
  render(<MainContent />);

  const previewButton = screen.getByText("Preview");
  const codeButton = screen.getByText("Code");

  expect(previewButton.className).toContain("bg-white");
  expect(previewButton.className).toContain("text-neutral-900");
  expect(codeButton.className).toContain("text-neutral-600");
  expect(codeButton.className).not.toContain("bg-white");
});

test("Code button has active styling when on code view", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByText("Code"));

  const previewButton = screen.getByText("Preview");
  const codeButton = screen.getByText("Code");

  expect(codeButton.className).toContain("bg-white");
  expect(codeButton.className).toContain("text-neutral-900");
  expect(previewButton.className).toContain("text-neutral-600");
  expect(previewButton.className).not.toContain("bg-white");
});
