"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

export type Toast = { message: string; severity?: "success" | "error" | "info" };
type Queued = Toast & { key: number };

const ToastContext = createContext<(toast: Toast) => void>(() => {});

/** Raise a toast from anywhere under the provider. */
export function useToast() {
  return useContext(ToastContext);
}

/**
 * One place for "that worked" and "that did not".
 *
 * These were inline Alerts sitting inside the panel that did the work, which
 * pushed everything below them down the page and left a green box behind long
 * after the reader had moved on. A toast says the same thing without moving
 * anything, and takes itself away.
 *
 * Queued rather than replaced: two quick actions should both be reported,
 * not have the second overwrite the first mid-read.
 */
export default function Toaster({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  // Which toast has been waved away. Derived openness rather than a second
  // piece of state kept in step by an effect, which is a cascading render.
  const [dismissed, setDismissed] = useState<number | null>(null);
  const nextKey = useRef(0);

  const show = useCallback((toast: Toast) => {
    nextKey.current += 1;
    setQueue((current) => [...current, { ...toast, key: nextKey.current }]);
  }, []);

  const current = queue[0] ?? null;
  const open = Boolean(current) && current!.key !== dismissed;

  return (
    <ToastContext.Provider value={show}>
      {children}

      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={current?.severity === "error" ? 6000 : 4000}
        onClose={(_event, reason) => {
          // A click elsewhere on the page is not a dismissal: somebody reading
          // the thing they just changed should not lose the confirmation.
          if (reason === "clickaway") return;
          if (current) setDismissed(current.key);
        }}
        // Drops the message once it has faded, so the next one animates in.
        slotProps={{ transition: { onExited: () => setQueue((rest) => rest.slice(1)) } }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={current?.severity ?? "success"}
          variant="filled"
          onClose={() => current && setDismissed(current.key)}
          sx={{ boxShadow: "0 8px 28px rgba(16,27,45,0.22)", alignItems: "center" }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

/**
 * Report a server action's result as a toast.
 *
 * useActionState hands back a new object on every run, so the ref is what
 * stops the same result being announced twice on an unrelated re-render.
 */
export function useActionToast(state: { error?: string; notice?: string }) {
  const show = useToast();
  const last = useRef<{ error?: string; notice?: string } | null>(null);

  useEffect(() => {
    if (last.current === state) return;
    last.current = state;
    if (state.error) show({ message: state.error, severity: "error" });
    else if (state.notice) show({ message: state.notice, severity: "success" });
  }, [state, show]);
}
