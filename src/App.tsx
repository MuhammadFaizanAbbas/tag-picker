import { useState, type FormEvent } from "react";
import { TagPicker } from "./TagPicker";
import { ProfileCard } from "./components/ProfileCard";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { MORE_SKILLS, RECOMMENDATIONS, SKILLS } from "./data";
import { sanitizeTagList } from "./lib/tags";

const RULES = { options: [...SKILLS, ...MORE_SKILLS], allowCustom: true, maxChars: 100, maxTagLength: 30, maxTags: 50 };
const FEATURED = 4;
const initial = ["Figma", "React"];

export default function App() {
  const [skills, setSkills] = useState<string[]>(initial);
  const [saved, setSaved] = useState<string[]>(initial);
  const dirty = skills.join("\n") !== saved.join("\n");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Do what the server should do: read the raw field and validate it again.
    // The picker already follows these rules, but a request can skip the page.
    const field = new FormData(event.currentTarget).get("skills");
    const { tags } = sanitizeTagList(field, RULES);
    setSaved(tags);
    setSkills(tags);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="mb-8 flex items-center justify-between gap-4 sm:mb-10">
        <p className="text-sm font-semibold">Tag Picker</p>
        <ThemeSwitch />
      </header>

      <main className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-[minmax(0,1fr)_17.5rem] md:gap-12">
        <form onSubmit={submit} noValidate className="min-w-0">
          <h1 className="headline text-[2rem] font-semibold leading-[1.05] sm:text-[2.5rem]">Your skills</h1>
          <p className="mb-6 mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            Put your strongest first. You have 100 characters, and the first {FEATURED} skills show on your profile card.
          </p>

          <TagPicker
            name="skills"
            label="Skills"
            noun={["skill", "skills"]}
            options={SKILLS}
            searchOptions={MORE_SKILLS}
            value={skills}
            onChange={setSkills}
            recommendations={RECOMMENDATIONS}
            maxChars={RULES.maxChars}
            maxTagLength={RULES.maxTagLength}
            maxTags={RULES.maxTags}
            featuredCount={FEATURED}
            featuredWhere="your card"
            allowCustom
          />

          <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-end gap-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <p className="mr-auto text-[13px] text-muted-2" aria-live="polite">{dirty ? "Unsaved changes" : ""}</p>
            {dirty && (
              <button type="button" onClick={() => setSkills(saved)} className="h-11 whitespace-nowrap rounded-full px-4 text-sm font-medium text-muted hover:text-foreground">
                Discard
              </button>
            )}
            <button
              type="submit"
              disabled={!dirty}
              className="h-11 whitespace-nowrap rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Save skills
            </button>
          </div>
        </form>

        <ProfileCard skills={skills} featured={FEATURED} saved={!dirty} />
      </main>
    </div>
  );
}
