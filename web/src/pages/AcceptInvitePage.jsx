import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "../components/ui";
import { CheckCircle2, XCircle, Clock, Wallet, Users } from "lucide-react";
import { invitesAPI } from "../services/api";

// ── Error state configs ───────────────────────────────────────────────────────

const ERROR_CONFIGS = {
  not_found: {
    Icon: XCircle,
    iconColor: "text-expense",
    iconBg: "bg-expense-bg",
    title: "Invalid invite",
    desc: "This invite link is not valid or doesn't exist. Please check the link and try again.",
  },
  expired: {
    Icon: Clock,
    iconColor: "text-warning",
    iconBg: "bg-warning/10",
    title: "Invite expired",
    desc: "This invite link has expired. Ask the sender to send a new one.",
  },
  declined: {
    Icon: XCircle,
    iconColor: "text-text-secondary",
    iconBg: "bg-surface-hover",
    title: "Invite declined",
    desc: "This invite was already declined.",
  },
  already_accepted: {
    Icon: CheckCircle2,
    iconColor: "text-income",
    iconBg: "bg-income-bg",
    title: "Already a member",
    desc: "This invite has already been accepted. You're already a member of this profile.",
  },
  error: {
    Icon: XCircle,
    iconColor: "text-expense",
    iconBg: "bg-expense-bg",
    title: "Something went wrong",
    desc: "We couldn't process this invite. Please try again later.",
  },
};

// ── Shared page shell ─────────────────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-border-color p-8 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2 bg-brand-primary/10 rounded-xl">
            <Wallet className="w-6 h-6 text-brand-primary" />
          </div>
          <span className="text-xl font-bold font-heading text-text-primary">SAVIQ</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const token = searchParams.get("token");

  const [inviteInfo, setInviteInfo] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState(null); // "accepted" | "declined"

  // Once auth state is resolved, decide what to do
  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setInviteError("not_found");
      return;
    }

    if (!user) {
      // Not logged in — redirect to login, bring them back after auth
      const returnUrl = `/accept-invite?token=${encodeURIComponent(token)}`;
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
      return;
    }

    // Logged in — fetch invite info to show the UI
    setLoadingInvite(true);
    invitesAPI
      .getInviteInfo(token)
      .then((res) => {
        setInviteInfo(res.data);
      })
      .catch((err) => {
        const status = err.response?.status;
        const detail = err.response?.data?.detail || "";
        if (status === 404) setInviteError("not_found");
        else if (status === 409) setInviteError("already_accepted");
        else if (status === 410) {
          if (detail.toLowerCase().includes("declined")) setInviteError("declined");
          else setInviteError("expired");
        } else {
          setInviteError("error");
        }
      })
      .finally(() => setLoadingInvite(false));
  }, [authLoading, user, token, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    try {
      setAccepting(true);
      await invitesAPI.acceptAuthenticated(token);
      setDone("accepted");
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        // Already accepted — treat as success
        setDone("accepted");
        setTimeout(() => navigate("/"), 2500);
      } else {
        setInviteError("error");
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      setDeclining(true);
      await invitesAPI.decline(token);
      setDone("declined");
      setTimeout(() => navigate("/"), 2000);
    } catch {
      navigate("/");
    } finally {
      setDeclining(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Done: accepted ────────────────────────────────────────────────────────

  if (done === "accepted") {
    return (
      <PageShell>
        <div className="text-center">
          <div className="w-16 h-16 bg-income-bg rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-income" />
          </div>
          <h2 className="text-xl font-bold font-heading text-text-primary mb-2">Welcome aboard!</h2>
          <p className="text-text-secondary mb-6">
            You've joined <strong>"{inviteInfo?.profile_name || "the shared profile"}"</strong>.
            Redirecting to your dashboard…
          </p>
          <Spinner size="sm" className="mx-auto" />
        </div>
      </PageShell>
    );
  }

  // ── Done: declined ────────────────────────────────────────────────────────

  if (done === "declined") {
    return (
      <PageShell>
        <div className="text-center">
          <p className="text-text-secondary mb-4">Invite declined. Redirecting…</p>
          <Spinner size="sm" className="mx-auto" />
        </div>
      </PageShell>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (inviteError) {
    const cfg = ERROR_CONFIGS[inviteError] || ERROR_CONFIGS.error;
    const { Icon, iconColor, iconBg, title, desc } = cfg;

    return (
      <PageShell>
        <div className="text-center">
          <div
            className={`w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}
          >
            <Icon className={`w-8 h-8 ${iconColor}`} />
          </div>
          <h2 className="text-xl font-bold font-heading text-text-primary mb-2">{title}</h2>
          <p className="text-text-secondary mb-6">{desc}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  // ── Main invite UI ────────────────────────────────────────────────────────

  return (
    <PageShell>
      {/* Icon */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">You're invited!</h2>
        <p className="text-text-secondary">
          <strong>{inviteInfo?.inviter_name || "Someone"}</strong> has invited you to join{" "}
          <strong>"{inviteInfo?.profile_name || "a shared profile"}"</strong> on SAVIQ.
        </p>
      </div>

      {/* Info box */}
      <div className="p-4 bg-brand-primary/5 rounded-xl mb-6 border border-brand-primary/10">
        <p className="text-sm text-text-secondary text-center">
          As a member you'll be able to view and add transactions to this shared profile.
        </p>
      </div>

      {/* Invite details */}
      {inviteInfo?.invited_email && (
        <p className="text-xs text-text-secondary text-center mb-5">
          Invited to:{" "}
          <span className="font-medium text-text-primary">{inviteInfo.invited_email}</span>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDecline}
          disabled={declining || accepting}
          className="flex-1 px-4 py-3 border border-border-color rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {declining ? <Spinner size="sm" className="mx-auto" /> : "Decline"}
        </button>
        <button
          onClick={handleAccept}
          disabled={accepting || declining}
          className="flex-1 px-4 py-3 bg-brand-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
          data-testid="accept-invite-button"
        >
          {accepting ? <Spinner size="sm" className="text-white mx-auto" /> : "Accept Invite"}
        </button>
      </div>
    </PageShell>
  );
}
