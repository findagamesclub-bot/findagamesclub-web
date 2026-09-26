"use client";

import { useEffect, useRef, useState } from "react";
import Button, { type ButtonProps } from "@mui/material/Button";
import DownloadIcon from "@mui/icons-material/Download";
import { useToast } from "@/components/ui/Toaster";

/**
 * A button that saves a file, and says so while it does.
 *
 * Not a link. `LinkPending` and `useLinkStatus` report on a client navigation,
 * and a download is not one: the browser hands the response to the file system
 * and the page never changes, so a link-based spinner has nothing to watch and
 * never appears. Routing it through `next/link` is worse than useless — Next
 * asks for an RSC payload, gets a CSV, and falls back to a hard navigation, so
 * the file arrives late and by accident.
 *
 * So it fetches the file itself. That buys three things a plain anchor cannot:
 * a spinner tied to the actual work, a failure the reader hears about rather
 * than a page of JSON opening in a tab, and the filename the server chose.
 *
 * The object URL is revoked once the click has been dispatched, and on unmount,
 * because a blob held open is the whole file kept in memory.
 */
export default function DownloadButton({
  href, label = "Export CSV", pendingLabel = "Preparing", ...props
}: Omit<ButtonProps, "href" | "onClick"> & {
  href: string;
  label?: string;
  pendingLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(href);
      if (!response.ok) {
        // The route answers JSON on a refusal, so it can say which one.
        const said = await response.json().catch(() => null);
        throw new Error(said?.error ?? `The export failed (${response.status}).`);
      }

      // The server names the file. Falling back to the last path segment would
      // save "revenue" with no extension, which Excel will not open.
      const disposition = response.headers.get("content-disposition") ?? "";
      const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "export.csv";

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        severity: "error",
        message: error instanceof Error ? error.message
          : "The export failed. Try again in a moment.",
      });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Button
      onClick={save}
      loading={busy}
      loadingPosition="start"
      startIcon={<DownloadIcon />}
      {...props}
    >
      {busy ? pendingLabel : label}
    </Button>
  );
}
