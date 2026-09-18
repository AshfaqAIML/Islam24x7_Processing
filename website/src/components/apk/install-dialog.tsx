"use client";

import * as React from "react";
import { Download, Smartphone } from "lucide-react";
import { brand } from "@/config/brand";
import { detectPlatform } from "@/lib/device";
import { useBrowserValue } from "@/hooks/use-client-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarLattice } from "@/components/decor/islamic-pattern";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Captures the browser PWA install prompt when offered (`beforeinstallprompt`)
 * and exposes a direct `install()` trigger. Null-safe on the server.
 */
export function useDeferredInstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(
    null
  );

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = React.useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  return { deferred, install };
}

/**
 * Shared "Get the App" sheet: direct one-tap install when the browser offers
 * it, otherwise step-by-step manual instructions (Add to Home Screen path).
 * Pure UI — persistence is owned by the caller via `onDone`.
 */
export function InstallDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onDone: () => void;
}) {
  const platform = useBrowserValue(detectPlatform, "desktop");
  const { deferred, install } = useDeferredInstallPrompt();

  const steps =
    platform === "ios"
      ? [
          "Tap the Share button in Safari.",
          'Choose "Add to Home Screen", then Add.',
        ]
      : [
          "Tap the ⋮ menu in your browser.",
          'Choose "Add to Home screen" (or "Install app").',
        ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-md"
        showCloseButton={false}
        aria-describedby="install-dialog-desc"
      >
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/10 to-transparent"
          />
          <StarLattice
            tile={40}
            className="absolute inset-x-0 top-0 h-28 w-full text-gold opacity-[0.1]"
          />
          <div className="relative px-6 pb-6 pt-8 text-center sm:px-8">
            <img
              src={brand.appIcon}
              alt={`${brand.name} app icon`}
              width={64}
              height={64}
              className="mx-auto rounded-2xl shadow-md ring-1 ring-black/5"
            />
            <DialogTitle className="mt-3 font-serif text-xl font-semibold tracking-tight">
              Get the {brand.name} App
            </DialogTitle>
            <DialogDescription
              id="install-dialog-desc"
              className="mt-1 text-sm text-muted-foreground"
            >
              Installs in seconds — the library, reader and search on your home
              screen, no Play Store needed.
            </DialogDescription>
            {deferred ? (
              <Button
                size="lg"
                className="mt-5 w-full gap-1.5 text-base"
                onClick={async () => {
                  const outcome = await install();
                  if (outcome === "accepted") onDone();
                  else onOpenChange(false);
                }}
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Install now
              </Button>
            ) : (
              <ol className="mx-auto mt-5 max-w-xs space-y-2.5 text-left text-sm">
                {steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground/90">{s}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5 space-y-2.5">
              <Button
                variant={deferred ? "ghost" : "outline"}
                className="w-full gap-1.5"
                onClick={onDone}
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                Done — I added it
              </Button>
              {deferred ? null : (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}