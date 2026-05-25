import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { notificationsAPI } from "../services/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffSec = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ── skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="px-4 py-3 animate-pulse space-y-1.5 border-b border-border-color/50 last:border-0">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-2.5 bg-gray-100 rounded w-full" />
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── fetch ────────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await notificationsAPI.getAll();
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // best-effort — never break the layout
    } finally {
      setIsLoading(false);
    }
  }, []);

  // initial load + 60-second poll
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // ── outside-click close ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // ── actions ──────────────────────────────────────────────────────────────

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (notif) => {
    setIsOpen(false);
    // optimistically mark all read
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsAPI.markAllRead();
    } catch {
      // ignore
    }
    if (notif.link) {
      // internal paths only — guard against absolute URLs
      const link = String(notif.link);
      if (link.startsWith("/")) {
        navigate(link);
      } else {
        window.location.href = link;
      }
    }
  };

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div ref={wrapperRef} className="relative">
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl hover:bg-surface-hover transition-colors"
        aria-label="Notifications"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none"
            data-testid="notification-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-border-color z-50 overflow-hidden animate-fade-in"
          data-testid="notification-dropdown"
        >
          {/* header row */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-brand-primary hover:underline font-medium disabled:opacity-40"
              disabled={unreadCount === 0}
              data-testid="mark-all-read"
            >
              Mark all read
            </button>
          </div>

          {/* body */}
          <div className="max-h-[24rem] overflow-y-auto">
            {/* loading skeleton — only on first load */}
            {isLoading && notifications.length === 0 ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : notifications.length === 0 ? (
              /* empty state */
              <div className="py-10 flex flex-col items-center gap-2 text-center px-4">
                <Bell className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-text-secondary">No notifications yet</p>
                <p className="text-xs text-text-secondary/70">
                  Budget alerts and goal milestones will appear here
                </p>
              </div>
            ) : (
              /* notification rows */
              notifications.slice(0, 10).map((notif) => (
                <button
                  key={notif.notif_id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`
                    w-full text-left px-4 py-3 transition-colors
                    border-b border-border-color/50 last:border-0
                    hover:bg-surface-hover
                    ${!notif.read ? "bg-brand-primary/5" : ""}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm font-medium text-text-primary truncate">
                          {notif.title}
                        </p>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-0.5 ml-3">
                        {notif.body}
                      </p>
                    </div>
                    <span className="text-[10px] text-text-secondary whitespace-nowrap flex-shrink-0 mt-0.5">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
