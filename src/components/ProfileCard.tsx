import { cn } from "../lib/cn";

/**
 * Where the skills end up. It updates as you edit, so you can see the point of
 * ordering: only the first few fit on the card.
 */
export function ProfileCard({ skills, featured, saved }: { skills: string[]; featured: number; saved: boolean }) {
  const shown = skills.slice(0, featured);
  const more = skills.length - shown.length;
  return (
    <aside aria-label="Profile card preview" className="md:sticky md:top-8">
      <p className="mb-3 flex items-center justify-between text-sm text-muted-2">
        <span>Your profile card</span>
        <span className={cn("inline-flex items-center gap-1.5 text-xs", saved ? "text-success" : "text-warn")}>
          <span className={cn("size-1.5 rounded-full", saved ? "bg-success" : "bg-warn")} aria-hidden />
          {saved ? "Saved" : "Preview"}
        </span>
      </p>
      <div className="profile-card relative overflow-hidden rounded-[22px] bg-surface p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-on-primary" aria-hidden>
            AL
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Alex Lee</p>
            <p className="text-sm text-muted-2">Product designer in Lahore</p>
          </div>
        </div>
        <ul className="mt-4 flex min-h-8 flex-wrap gap-1.5" aria-label="Skills on the card">
          {shown.map((skill) => (
            <li key={skill} className="max-w-full truncate rounded-full border border-border px-2.5 py-1 text-[13px] font-medium">
              {skill}
            </li>
          ))}
          {more > 0 && <li className="px-1 py-1 text-[13px] text-muted-2">+{more} more</li>}
          {shown.length === 0 && <li className="py-1 text-[13px] text-muted-2">Add skills to show them here.</li>}
        </ul>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-2">
        The first {featured} skills show here. People see the rest when they open your profile.
      </p>
    </aside>
  );
}
