import React from "react";
import { cn } from "../lib/utils";

/**
 * Profile-switcher <select> shared by the pages that just need a plain
 * dropdown (Budgets, Goals, Net Worth, Analytics, Export). Dashboard has its
 * own richer profile switcher (shared-member avatar pills) and is not
 * covered by this component.
 */
export default function ProfileSelector({
  profiles,
  activeProfile,
  onChange,
  testId = "profile-select",
  responsive = false,
}) {
  return (
    <select
      value={activeProfile?.profile_id || ""}
      onChange={(e) => {
        const profile = profiles.find((p) => p.profile_id === e.target.value);
        onChange(profile || null);
      }}
      className={cn(
        "px-4 py-2 bg-white border border-border-color rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
        responsive && "w-full sm:w-auto",
      )}
      data-testid={testId}
    >
      {profiles.map((profile) => (
        <option key={profile.profile_id} value={profile.profile_id}>
          {profile.name}
        </option>
      ))}
    </select>
  );
}
