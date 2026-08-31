"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

type Project = {
  id: string;
  name: string;
  prompt: string;
  html: string;
  createdAt: string;
  userId: string;
  deploymentUrl?: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [instruction, setInstruction] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [buildStage, setBuildStage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [htmlHistory, setHtmlHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showEntrance, setShowEntrance] = useState(true);
  const [openingEntrance, setOpeningEntrance] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);

  function pushHistory(newHtml: string) {
    setHtmlHistory((current) => {
      const next = current.slice(0, historyIndex + 1);
      next.push(newHtml);
      return next;
    });
    setHistoryIndex((current) => current + 1);
    setHtml(newHtml);
  }

  function undo() {
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setHtml(htmlHistory[newIndex]);
  }

  function redo() {
    if (historyIndex >= htmlHistory.length - 1) return;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setHtml(htmlHistory[newIndex]);
  }

  useEffect(() => {
    const savedProject = sessionStorage.getItem("forgeai-open-project");

    if (savedProject) {
      try {
        const project = JSON.parse(savedProject);

        setPrompt(project.prompt || "");
        setHtml(project.html || "");
        setCurrentProjectId(project.id || null);

        sessionStorage.removeItem("forgeai-open-project");
      } catch {
        sessionStorage.removeItem("forgeai-open-project");
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setProjects([]);
        return;
      }

      const q = query(
        collection(db, "projects"),
        where("userId", "==", currentUser.uid)
      );

      const unsubscribeProjects = onSnapshot(
        q,
        (snapshot) => {
          const loaded = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Project[];

          loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setProjects(loaded);
        },
        (err) => {
          console.error(err);
          setError("Could not load your cloud projects.");
        }
      );

      return () => unsubscribeProjects();
    });

    return () => unsubscribeAuth();
  }, []);

  async function saveProject() {
    if (!html) return;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const name =
      prompt.trim().slice(0, 40) || "Untitled ForgeAI Project";

    try {
      if (currentProjectId) {
        await updateDoc(doc(db, "projects", currentProjectId), {
          name,
          prompt,
          html,
          updatedAt: new Date().toISOString(),
        });

        alert("☁️ Project updated!");
      } else {
        const newProject = await addDoc(collection(db, "projects"), {
          name,
          prompt,
          html,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setCurrentProjectId(newProject.id);

        alert("☁️ Project saved to the cloud!");
      }
    } catch (err) {
      console.error(err);
      setError("Could not save your project.");
    }
  }

  function loadProject(project: Project) {
    setPrompt(project.prompt);
    setHtml(project.html);
    setCurrentProjectId(project.id);
    setHtmlHistory([project.html]);
    setHistoryIndex(0);
    setShowProjects(false);
    setError("");
  }

  async function deleteProject(id: string) {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "projects", id));
    } catch (err) {
      console.error(err);
      setError("Could not delete the project.");
    }
  }

  async function build() {
    if (!prompt.trim()) return;

    setLoading(true);
    setBuildStage(1);
    setError("");

    const stageTimer1 = setTimeout(() => setBuildStage(2), 700);
    const stageTimer2 = setTimeout(() => setBuildStage(3), 1500);
    const stageTimer3 = setTimeout(() => setBuildStage(4), 2500);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("The AI server returned an invalid response.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Generation failed.");
      }

      if (!data.html) {
        throw new Error("The AI returned no website.");
      }

      setBuildStage(5);
      pushHistory(data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed.");
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setLoading(false);
      setTimeout(() => setBuildStage(0), 700);
    }
  }

  async function deploy() {
    if (!html) {
      setError("Build a website before deploying.");
      return;
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    try {
      setError("");

      const idToken = await user.getIdToken();

      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ html }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Deployment failed.");
      }

      if (!data.url) {
        throw new Error("Deployment succeeded but no URL was returned.");
      }

      if (currentProjectId) {
        await updateDoc(doc(db, "projects", currentProjectId), {
          deploymentUrl: data.url,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const name =
          prompt.trim().slice(0, 40) || "Untitled ForgeAI Project";

        const newProject = await addDoc(collection(db, "projects"), {
          name,
          prompt,
          html,
          userId: user.uid,
          deploymentUrl: data.url,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setCurrentProjectId(newProject.id);
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Deployment failed.");
    }
  }

  async function edit() {
    if (!html || !instruction.trim()) return;

    setEditing(true);
    setError("");

    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html,
          instruction,
        }),
      });

      const text = await res.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("The AI server returned an invalid response.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Editing failed.");
      }

      if (!data.html) {
        throw new Error("The AI returned no updated website.");
      }

      pushHistory(data.html);
      setInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed.");
    } finally {
      setEditing(false);
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-zinc-400">⚒️ Loading ForgeAI...</div>
      </main>
    );
  }

  return (
    <>
      {showEntrance && (
        <div
          className={`forge-flight-deck ${openingEntrance ? "forge-flight-opening" : ""}`}
          onClick={() => {
            if (!windowOpen) {
              setWindowOpen(true);
              setTimeout(() => setOpeningEntrance(true), 700);
              setTimeout(() => setShowEntrance(false), 1900);
            }
          }}
        >
          <div className="cabin-ceiling">
            <div className="cabin-light-strip" />
            <div className="cabin-air-vent" />
            <div className="cabin-air-vent second" />
          </div>

          <div className="cabin-wall cabin-wall-left">
            <div className="cabin-window small-window">
              <div className="cabin-sky" />
            </div>
            <div className="seat-back seat-left-one" />
            <div className="seat-back seat-left-two" />
          </div>

          <div className="cabin-wall cabin-wall-right">
            <div className="cabin-window small-window">
              <div className="cabin-sky" />
            </div>
            <div className="seat-back seat-right-one" />
            <div className="seat-back seat-right-two" />
          </div>

          <div className="flight-center">
            <div className="hero-window">
              <div className="hero-window-sky">
                <div className="hero-cloud hero-cloud-one" />
                <div className="hero-cloud hero-cloud-two" />
                <div className="hero-cloud hero-cloud-three" />
                <div className="hero-sun" />
              </div>

              <div className={`hero-window-frame ${windowOpen ? "hero-window-open" : ""}`}>
                <div className="hero-window-glass" />
                <div className="window-handle">
                  <span />
                </div>
              </div>
            </div>

            <div className="flight-brand">
              <div className="flight-logo">⚒️</div>
              <h1>ForgeAI</h1>
              <p>Build beyond imagination.</p>
              <button
                className="flight-enter"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpeningEntrance(true);
                  setTimeout(() => setShowEntrance(false), 1400);
                }}
              >
                Open the window →
              </button>
            </div>
          </div>

          <div className="cabin-floor">
            <div className="floor-aisle" />
          </div>

          <div className="cabin-vignette" />
        </div>
      )}

      <main className="min-h-screen bg-zinc-950 text-white">
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 px-5">
        <div className="text-xl font-bold">⚒️ ForgeAI</div>

        <div className="flex items-center gap-2">
          <a
            href="https://buymeacoffee.com/Ashu13"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            ☕ Support
          </a>

          {user && (
            <span className="hidden max-w-40 truncate text-xs text-zinc-500 sm:block">
              {user.email}
            </span>
          )}

          {html && (
            <>
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-30"
                title="Undo"
              >
                ↩️ Undo
              </button>

              <button
                onClick={redo}
                disabled={historyIndex >= htmlHistory.length - 1}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-30"
                title="Redo"
              >
                ↪️ Redo
              </button>

              <button
                onClick={saveProject}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
              >
                💾 Save
              </button>
            </>
          )}

          <button
            onClick={() => setShowProjects(!showProjects)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
          >
            📁 Projects
          </button>

          {user ? (
            <button
              onClick={() => signOut(auth)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => {
                window.location.href = "/login";
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              🔐 Sign in
            </button>
          )}

          <button
            onClick={deploy}
            disabled={!html}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            🚀 Deploy
          </button>
        </div>
      </header>

      {showProjects && (
        <div className="absolute right-4 top-20 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">📁 Saved Projects</h2>

            <button
              onClick={() => setShowProjects(false)}
              className="text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          {!user ? (
            <div className="py-6 text-center text-sm text-zinc-500">
              <p>Sign in to view your saved projects.</p>
              <button
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                🔐 Sign in
              </button>
            </div>
          ) : projects.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-600">
              No saved projects yet.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-zinc-800 p-3"
                >
                  <button
                    onClick={() => loadProject(project)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium">{project.name}</div>
                      {project.deploymentUrl && (
                        <span className="shrink-0 text-xs text-emerald-400">🌍 Live</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {new Date(project.createdAt).toLocaleString()}
                    </div>
                  </button>

                  <button
                    onClick={() => deleteProject(project.id)}
                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-[calc(100vh-4rem)] md:grid-cols-2">
        <section className="border-b border-zinc-800 p-5 md:border-b-0 md:border-r">
          <div className="mb-4">
            <div className="text-sm text-zinc-400">🤖 AI Builder</div>
            <p className="mt-1 text-xs text-zinc-600">
              Describe what you want ForgeAI to build.
            </p>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build a gaming community website..."
            className="min-h-40 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none placeholder:text-zinc-600"
          />

          <button
            onClick={build}
            disabled={loading}
            className="mt-3 w-full rounded-xl bg-white px-5 py-3 font-bold text-black disabled:opacity-50"
          >
            {loading ? "⚙️ Building..." : "✨ Build Website"}
          </button>

          {loading && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 text-white">
                <span className="animate-pulse">⚒️</span>
                <span>ForgeAI is building your website...</span>
              </div>

              <div className="space-y-2 text-zinc-400">
                {[
                  "Analyzing your idea",
                  "Planning the layout",
                  "Designing the interface",
                  "Writing the website",
                  "Preparing live preview",
                ].map((stage, index) => {
                  const stageNumber = index + 1;
                  const complete = buildStage > stageNumber;
                  const active = buildStage === stageNumber;

                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-3 transition-colors ${
                        complete
                          ? "text-emerald-400"
                          : active
                            ? "text-white"
                            : "text-zinc-600"
                      }`}
                    >
                      <span className="w-5 text-center">
                        {complete ? "✓" : active ? "●" : "○"}
                      </span>
                      <span>{stage}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              ❌ {error}
            </div>
          )}

          {html && (
            <div className="mt-8">
              <div className="mb-3">
                <div className="text-sm text-zinc-400">
                  ✏️ Edit your website
                </div>

                <p className="mt-1 text-xs text-zinc-600">
                  Tell ForgeAI what you want to change.
                </p>
              </div>

              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Make the buttons blue and add a leaderboard..."
                className="min-h-28 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none placeholder:text-zinc-600"
              />

              <button
                onClick={edit}
                disabled={editing || !instruction.trim()}
                className="mt-3 w-full rounded-xl border border-zinc-700 px-5 py-3 font-semibold disabled:opacity-50"
              >
                {editing ? "🧠 Editing..." : "✏️ Apply Change"}
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Make it more modern",
                  "Add a leaderboard",
                  "Add a pricing section",
                  "Make the buttons blue",
                ].map((idea) => (
                  <button
                    key={idea}
                    onClick={() => setInstruction(idea)}
                    className="rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-600 hover:text-white"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="min-h-[600px] bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            👀 Live Preview
          </div>

          {html ? (
            <iframe
              title="ForgeAI Preview"
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-[calc(100vh-7rem)] min-h-[600px] w-full border-0"
            />
          ) : (
            <div className="flex min-h-[600px] items-center justify-center text-center text-zinc-500">
              <div>
                <div className="text-4xl">🪄</div>
                <p className="mt-3">
                  {loading
                    ? "ForgeAI is creating your website..."
                    : "Your generated website will appear here."}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
    </>
  );
}
