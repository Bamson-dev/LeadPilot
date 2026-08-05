"use client";

import Link from "next/link";
import { BarChart3, Bell, Gift, HelpCircle, Settings } from "lucide-react";
import { cn } from "@/utils/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface AppTopNavProps {
  credits?: number | null;
  userEmail?: string | null;
  className?: string;
  onCreditsClick?: () => void;
}

function initialsFromEmail(email?: string | null) {
  if (!email) return "LT";
  const local = email.split("@")[0] || "LT";
  return local.slice(0, 2).toUpperCase();
}

export function AppTopNav({
  credits,
  userEmail,
  className,
  onCreditsClick,
}: AppTopNavProps) {
  return (
    <header
      className={cn(
        "flex h-[var(--lt-header-height)] shrink-0 items-center justify-end gap-3 border-b border-[var(--lt-border)] bg-[var(--lt-bg)] px-4 sm:px-6",
        className
      )}
    >
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCreditsClick}
            className="rounded-md px-2 py-1 text-sm font-medium text-[var(--lt-text)] transition-colors hover:bg-[var(--lt-surface-3)]"
          >
            Credits:{" "}
            <span className="tabular-nums text-[var(--lt-accent-soft)]">
              {typeof credits === "number" ? credits.toLocaleString() : "—"}
            </span>
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Insights" asChild>
                <Link href="/dashboard/insights">
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insights</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Affiliate" asChild>
                <Link href="/dashboard/affiliate">
                  <Gift className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Affiliate</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications (unavailable)"
                disabled
              >
                <Bell className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications unavailable</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Settings" asChild>
                <Link href="/dashboard/settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Help" asChild>
                <a
                  href="https://wa.me/2349067285890"
                  target="_blank"
                  rel="noreferrer"
                >
                  <HelpCircle className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Support</TooltipContent>
          </Tooltip>

          <Avatar className="h-8 w-8 border border-[var(--lt-border)]">
            <AvatarFallback className="bg-[var(--lt-surface-3)] text-xs text-[var(--lt-text)]">
              {initialsFromEmail(userEmail)}
            </AvatarFallback>
          </Avatar>
        </div>
      </TooltipProvider>
    </header>
  );
}
