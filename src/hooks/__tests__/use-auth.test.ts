import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { useAuth } from "../use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import {
  getAnonWorkData,
  clearAnonWork,
} from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { useRouter } from "next/navigation";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  const mockPush = vi.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial state", () => {
    test("returns signIn, signUp functions and isLoading state", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.signIn).toBeTypeOf("function");
      expect(result.current.signUp).toBeTypeOf("function");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signIn", () => {
    test("successfully signs in and navigates to project with anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "test" } },
      };
      const mockProject = { id: "anon-project-123" };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      const response = await result.current.signIn("test@example.com", "password");

      expect(signInAction).toHaveBeenCalledWith("test@example.com", "password");
      expect(getAnonWorkData).toHaveBeenCalled();
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-123");
      expect(response.success).toBe(true);
    });

    test("successfully signs in and navigates to most recent project when no anonymous work", async () => {
      const mockProjects = [
        { id: "project-1", name: "Recent Project" },
        { id: "project-2", name: "Old Project" },
      ];

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("successfully signs in and creates new project when no existing projects", async () => {
      const mockNewProject = { id: "new-project-456" };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue(mockNewProject);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/New Design #\d+/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/new-project-456");
    });

    test("returns error result when sign in fails", async () => {
      const errorResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      const response = await result.current.signIn("test@example.com", "wrong");

      expect(response).toEqual(errorResult);
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets loading state during sign in", async () => {
      (signInAction as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      const signInPromise = result.current.signIn("test@example.com", "password");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await signInPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test("clears loading state even if sign in throws error", async () => {
      (signInAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signIn("test@example.com", "password")
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });

    test("handles anonymous work with empty messages array", async () => {
      const mockAnonWork = {
        messages: [],
        fileSystemData: {},
      };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (getProjects as any).mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      // Should not create project from anon work since messages is empty
      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(clearAnonWork).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    test("successfully signs up and navigates to project with anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "test" } },
      };
      const mockProject = { id: "signup-project-789" };

      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      const response = await result.current.signUp("new@example.com", "password123");

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "password123");
      expect(getAnonWorkData).toHaveBeenCalled();
      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/signup-project-789");
      expect(response.success).toBe(true);
    });

    test("successfully signs up and creates new project when no anonymous work or existing projects", async () => {
      const mockNewProject = { id: "first-project-123" };

      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue(mockNewProject);

      const { result } = renderHook(() => useAuth());

      await result.current.signUp("new@example.com", "password123");

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/New Design #\d+/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/first-project-123");
    });

    test("returns error result when sign up fails", async () => {
      const errorResult = { success: false, error: "Email already exists" };
      (signUpAction as any).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      const response = await result.current.signUp("existing@example.com", "password");

      expect(response).toEqual(errorResult);
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets loading state during sign up", async () => {
      (signUpAction as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      const signUpPromise = result.current.signUp("new@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await signUpPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test("clears loading state even if sign up throws error", async () => {
      (signUpAction as any).mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        result.current.signUp("new@example.com", "password123")
      ).rejects.toThrow("Database error");

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles undefined anonymous work data", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(undefined);
      (getProjects as any).mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(clearAnonWork).not.toHaveBeenCalled();
    });

    test("handles project creation name with specific timestamp format", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test" }],
        fileSystemData: {},
      };
      const mockProject = { id: "time-project" };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      const createProjectCall = (createProject as any).mock.calls[0][0];
      expect(createProjectCall.name).toMatch(/Design from \d{1,2}:\d{2}:\d{2}/);
    });

    test("generates unique random project names", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "random-project" });

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      const createProjectCall = (createProject as any).mock.calls[0][0];
      expect(createProjectCall.name).toMatch(/New Design #\d+/);

      const number = parseInt(createProjectCall.name.match(/\d+/)[0]);
      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThan(100000);
    });

    test("does not navigate or create projects if sign in action fails", async () => {
      (signInAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("handles router push being called multiple times correctly", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test" }],
        fileSystemData: {},
      };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProject as any).mockResolvedValue({ id: "project-1" });

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password");

      // Should only push once
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/project-1");
    });
  });

  describe("concurrent operations", () => {
    test("properly manages loading state after completion", async () => {
      (signInAction as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 50))
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      // Start sign in operation
      const signInPromise = result.current.signIn("test@example.com", "password");

      // Wait for loading state to be set
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Wait for completion
      await signInPromise;

      // Verify loading state is cleared
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
