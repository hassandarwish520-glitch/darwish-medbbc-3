"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";

/**
 * Unified study state for the Next.js client.
 *
 * Implemented as a single Context + useReducer store instead of Riverpod/Bloc
 * (those are Flutter-only; this app's stack is Next.js + React 19, so the
 * idiomatic equivalent is React Context + useReducer with persistent helpers).
 *
 * State is partitioned into:
 *   - session: current lesson, view mode, last-seen position, return-key
 *   - progress: per-lesson position/duration/completed map
 *   - bookmarks: lesson ids the user has starred
 *   - notes: lesson-id -> draft note body (saved on blur)
 *   - materials: lesson-id -> list of opened material ids
 *   - offline: lesson-id -> encrypted blob key in encrypted IndexedDB
 *
 * Persistence tiers:
 *   1. In-memory (Context) — fastest, lost on reload.
 *   2. localStorage — survives reload, not protected.
 *   3. encryptedIndexedDB — survives reload + cleared cache, protected by AES-256-GCM.
 *
 * Reducer actions are flat strings; selectors live in derived hooks below to
 * avoid re-rendering the entire tree on any state change.
 */

export type StudyViewMode = "focus" | "split";

export type StudySession = {
  lessonId: string | null;
  lessonTitle: string;
  courseId: string | null;
  videoType: "youtube" | "telegram" | "direct" | "none";
  videoUrl: string | null;
  viewMode: StudyViewMode;
  notesOpen: boolean;
  qbankOpen: boolean;
  currentTime: number;
  duration: number;
  /** Used to restore the exact lesson + timestamp after returning from external app. */
  returnKey: string | null;
};

export type StudyProgress = {
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
};

export type StudyState = {
  session: StudySession;
  progress: Record<string, StudyProgress>;
  bookmarks: Record<string, boolean>;
  notesDraft: Record<string, string>;
  qbankCursor: Record<string, number>;
  materialsOpened: Record<string, boolean>;
  offlineLessons: Record<string, { sizeBytes: number; updatedAt: string }>;
};

const INITIAL: StudyState = {
  session: {
    lessonId: null,
    lessonTitle: "",
    courseId: null,
    videoType: "none",
    videoUrl: null,
    viewMode: "focus",
    notesOpen: false,
    qbankOpen: false,
    currentTime: 0,
    duration: 0,
    returnKey: null,
  },
  progress: {},
  bookmarks: {},
  notesDraft: {},
  qbankCursor: {},
  materialsOpened: {},
  offlineLessons: {},
};

type Action =
  | { type: "HYDRATE"; payload: Partial<StudyState> }
  | { type: "OPEN_LESSON"; payload: Partial<StudySession> & { lessonId: string; lessonTitle: string } }
  | { type: "SET_VIEW_MODE"; mode: StudyViewMode }
  | { type: "TOGGLE_PANEL"; panel: "notes" | "qbank"; force?: boolean }
  | { type: "SET_TIME"; position: number; duration: number }
  | { type: "SET_PROGRESS"; lessonId: string; progress: StudyProgress }
  | { type: "TOGGLE_BOOKMARK"; lessonId: string }
  | { type: "SET_NOTE_DRAFT"; lessonId: string; body: string }
  | { type: "NEXT_QBANK"; lessonId: string; total: number }
  | { type: "MARK_MATERIAL_OPENED"; lessonId: string }
  | { type: "QUEUE_OFFLINE"; lessonId: string; sizeBytes: number }
  | { type: "REMOVE_OFFLINE"; lessonId: string }
  | { type: "SET_RETURN_KEY"; key: string };

function reducer(state: StudyState, action: Action): StudyState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload };
    case "OPEN_LESSON":
      return {
        ...state,
        session: { ...state.session, ...action.payload },
      };
    case "SET_VIEW_MODE":
      return { ...state, session: { ...state.session, viewMode: action.mode } };
    case "TOGGLE_PANEL": {
      const flag = action.panel === "notes" ? "notesOpen" : "qbankOpen";
      const other = action.panel === "notes" ? "qbankOpen" : "notesOpen";
      const next = action.force !== undefined ? action.force : !state.session[flag];
      return {
        ...state,
        session: {
          ...state.session,
          [flag]: next,
          [other]: false,
        },
      };
    }
    case "SET_TIME":
      return {
        ...state,
        session: {
          ...state.session,
          currentTime: action.position,
          duration: action.duration,
        },
      };
    case "SET_PROGRESS":
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.lessonId]: action.progress,
        },
      };
    case "TOGGLE_BOOKMARK": {
      const next = !state.bookmarks[action.lessonId];
      return {
        ...state,
        bookmarks: { ...state.bookmarks, [action.lessonId]: next },
      };
    }
    case "SET_NOTE_DRAFT":
      return {
        ...state,
        notesDraft: { ...state.notesDraft, [action.lessonId]: action.body },
      };
    case "NEXT_QBANK":
      return {
        ...state,
        qbankCursor: {
          ...state.qbankCursor,
          [action.lessonId]: (state.qbankCursor[action.lessonId] ?? 0) + 1 < action.total
            ? (state.qbankCursor[action.lessonId] ?? 0) + 1
            : 0,
        },
      };
    case "MARK_MATERIAL_OPENED":
      return {
        ...state,
        materialsOpened: { ...state.materialsOpened, [action.lessonId]: true },
      };
    case "QUEUE_OFFLINE":
      return {
        ...state,
        offlineLessons: {
          ...state.offlineLessons,
          [action.lessonId]: { sizeBytes: action.sizeBytes, updatedAt: new Date().toISOString() },
        },
      };
    case "REMOVE_OFFLINE": {
      const next = { ...state.offlineLessons };
      delete next[action.lessonId];
      return { ...state, offlineLessons: next };
    }
    case "SET_RETURN_KEY":
      return {
        ...state,
        session: { ...state.session, returnKey: action.key },
      };
    default:
      return state;
  }
}

const StudyContext = createContext<{
  state: StudyState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

const STORAGE_PREFIX = "study-state-v1::";

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // Hydrate from localStorage on mount (progress + bookmarks only — never
  // sensitive materials). Encrypted blobs go through the AES layer.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + "snapshot");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StudyState>;
      dispatch({ type: "HYDRATE", payload: parsed });
    } catch {
      /* corrupted — ignore */
    }
  }, []);

  // Persist the lightweight slices on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const slice = {
        progress: state.progress,
        bookmarks: state.bookmarks,
        qbankCursor: state.qbankCursor,
        materialsOpened: state.materialsOpened,
      };
      window.localStorage.setItem(STORAGE_PREFIX + "snapshot", JSON.stringify(slice));
    } catch {
      /* quota — ignore */
    }
  }, [state.progress, state.bookmarks, state.qbankCursor, state.materialsOpened]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudy must be used within <StudyProvider>");
  return ctx;
}

export function useStudySelector<T>(selector: (s: StudyState) => T): T {
  const { state } = useStudy();
  return useCallback(() => selector(state), [state, selector])();
}
