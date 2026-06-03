import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

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

import { useRouter } from "next/navigation";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

const ANON_MESSAGES = [{ role: "user", content: "Hello" }];
const ANON_FS_DATA = { "/App.jsx": { type: "file", content: "export default () => <div/>" } };
const ANON_WORK = { messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA };
const EXISTING_PROJECTS = [{ id: "proj-1" }, { id: "proj-2" }];
const NEW_PROJECT = { id: "new-proj-999" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([] as any);
  vi.mocked(createProject).mockResolvedValue(NEW_PROJECT as any);
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
});

describe("useAuth", () => {
  it("starts with isLoading false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  it("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });
});

describe("signIn", () => {
  describe("happy paths", () => {
    it("redirects to anon-work project when user had anonymous messages", async () => {
      const anonProject = { id: "anon-proj-42" };
      vi.mocked(getAnonWorkData).mockReturnValue(ANON_WORK);
      vi.mocked(createProject).mockResolvedValue(anonProject as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: ANON_MESSAGES,
        data: ANON_FS_DATA,
      });
      expect(clearAnonWork).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith(`/${anonProject.id}`);
    });

    it("does not call getProjects when anon work is found", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue(ANON_WORK);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(getProjects).not.toHaveBeenCalled();
    });

    it("redirects to most-recent existing project when no anon work", async () => {
      vi.mocked(getProjects).mockResolvedValue(EXISTING_PROJECTS as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
      expect(createProject).not.toHaveBeenCalled();
    });

    it("creates a new project and redirects when user has no existing projects", async () => {
      vi.mocked(getProjects).mockResolvedValue([]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
    });

    it("returns the result from signInAction", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });
  });

  describe("failure paths", () => {
    it("returns the error result without calling handlePostSignIn", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("isLoading", () => {
    it("sets isLoading true while the action is in-flight", async () => {
      let resolveAction!: (value: any) => void;
      vi.mocked(signInAction).mockImplementation(
        () => new Promise((r) => { resolveAction = r; })
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);

      // Kick off signIn without awaiting completion
      act(() => {
        void result.current.signIn("user@example.com", "password123");
      });
      expect(result.current.isLoading).toBe(true);

      // Resolve and confirm it resets
      await act(async () => {
        resolveAction({ success: false });
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false after a successful signIn", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false after a failed signIn", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpass");
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false when signInAction throws", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("falls through to getProjects when anon work has empty messages", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
      vi.mocked(getProjects).mockResolvedValue(EXISTING_PROJECTS as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });

    it("falls through to getProjects when getAnonWorkData returns null", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue(EXISTING_PROJECTS as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });

    it("does not clear anon work when anon work has empty messages", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(clearAnonWork).not.toHaveBeenCalled();
    });
  });

  describe("error states", () => {
    it("propagates error from signInAction and resets isLoading", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network failure"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await expect(result.current.signIn("user@example.com", "password123")).rejects.toThrow("Network failure");
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("propagates error from createProject (anon work path)", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue(ANON_WORK);
      vi.mocked(createProject).mockRejectedValue(new Error("DB error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await expect(result.current.signIn("user@example.com", "password123")).rejects.toThrow("DB error");
      });
    });

    it("propagates error from getProjects", async () => {
      vi.mocked(getProjects).mockRejectedValue(new Error("Unauthorized"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await expect(result.current.signIn("user@example.com", "password123")).rejects.toThrow("Unauthorized");
      });
    });

    it("propagates error from createProject (new project path)", async () => {
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await expect(result.current.signIn("user@example.com", "password123")).rejects.toThrow("Create failed");
      });
    });
  });
});

describe("signUp", () => {
  describe("happy paths", () => {
    it("redirects to anon-work project when user had anonymous messages", async () => {
      const anonProject = { id: "anon-proj-signup" };
      vi.mocked(getAnonWorkData).mockReturnValue(ANON_WORK);
      vi.mocked(createProject).mockResolvedValue(anonProject as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: ANON_MESSAGES,
        data: ANON_FS_DATA,
      });
      expect(clearAnonWork).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith(`/${anonProject.id}`);
    });

    it("redirects to most-recent existing project when no anon work", async () => {
      vi.mocked(getProjects).mockResolvedValue(EXISTING_PROJECTS as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });

    it("creates a new project when no existing projects", async () => {
      vi.mocked(getProjects).mockResolvedValue([]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
    });

    it("returns the result from signUpAction", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("newuser@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });
  });

  describe("failure paths", () => {
    it("returns the error result without calling handlePostSignIn", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("isLoading", () => {
    it("sets isLoading true while the action is in-flight", async () => {
      let resolveAction!: (value: any) => void;
      vi.mocked(signUpAction).mockImplementation(
        () => new Promise((r) => { resolveAction = r; })
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);

      act(() => {
        void result.current.signUp("newuser@example.com", "password123");
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction({ success: false });
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false after successful signUp", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false after failed signUp", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false when signUpAction throws", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123").catch(() => {});
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("error states", () => {
    it("propagates error from signUpAction and resets isLoading", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await expect(result.current.signUp("newuser@example.com", "password123")).rejects.toThrow("Server error");
      });
      expect(result.current.isLoading).toBe(false);
    });
  });
});
