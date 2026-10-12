"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/validation";

/**
 * Shows a toast for each new server action result and calls `onSuccess` once.
 * Field errors are left for the form to render inline.
 */
export function useActionFeedback(state: ActionResult | null, onSuccess?: () => void) {
  const handled = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    } else if (!state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
}
