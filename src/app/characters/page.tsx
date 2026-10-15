"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, useConfirm, useToast } from "@/components/ui";
import { CharacterEditor } from "@/components/CharacterEditor";
import type { CharacterView } from "@/components/ProjectContext";

export default function CharactersPage() {
  const [q, setQ] = useState("");
  const { data, reload } = useApi<{ characters: CharacterView[] }>(`/api/characters${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const { data: status } = useApi<{ providers: { keyframe: { id: string; label: string } | null } }>("/api/status");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nw, setNw] = useState({ name: "", fruit: "" });
  const confirm = useConfirm();
  const toast = useToast();

  async function create() {
    const { character } = await api<{ character: CharacterView }>("/api/characters", { body: nw });
    setCreating(false);
    setNw({ name: "", fruit: "" });
    reload();
    setOpen(character.id);
  }
  async function remove(c: CharacterView) {
    if (!(await confirm({ title: `Delete ${c.name}?`, body: "Removes the character and its reference images from the library and every project that uses it.", confirmLabel: "Delete", tone: "danger" }))) return;
    await api(`/api/characters/${c.id}`, { method: "DELETE" });
    toast(`${c.name} deleted`);
    reload();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Character Bible"
        title="Character Library"
        subtitle="Every character's canonical look, personality, voice and approved reference image. Reused across scenes and projects so designs never silently change."
        actions={<Button variant="primary" onClick={() => setCreating(true)}>+ New character</Button>}
      />
      <input placeholder="Search by name or fruit…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" aria-label="Search characters" />
      {data?.characters.length === 0 ? (
        <Empty title="No characters yet" action={<Button variant="primary" onClick={() => setCreating(true)}>+ New character</Button>}>
          Characters are created automatically when you write a story, or add your own here.
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data?.characters ?? []).map((c) => (
            <Card key={c.id} className="group overflow-hidden">
              <button className="block w-full text-left" onClick={() => setOpen(c.id)}>
                <div className="relative grid aspect-square place-items-center bg-gradient-to-br from-ink-800 to-ink-900">
                  {c.approvedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.approvedImageUrl} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex gap-1">
                      {c.palette.map((p, i) => (
                        <span key={i} className="h-10 w-10 rounded-full border border-white/10" style={{ background: p }} />
                      ))}
                    </div>
                  )}
                  <div className="absolute left-2 top-2">{c.approvedImageId ? <Badge tone="approved">approved ref</Badge> : <Badge tone="awaiting_approval">no reference</Badge>}</div>
                </div>
                <div className="p-4">
                  <div className="font-display font-semibold text-white">{c.name}</div>
                  <div className="text-sm capitalize text-ink-400">
                    {c.fruit} · {c.voice.engine} voice
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-ink-500">{c.personality}</div>
                </div>
              </button>
              <div className="flex justify-end border-t border-ink-800 px-3 py-2">
                <Button size="sm" variant="ghost" className="hover:text-berry-400" onClick={() => remove(c)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title="Edit character" wide>
        {open && <CharacterEditor id={open} ai={status?.providers.keyframe} onSaved={reload} />}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="New character" footer={<Button variant="primary" disabled={!nw.name || !nw.fruit} onClick={create}>Create</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} placeholder="Pip" />
          </Field>
          <Field label="Fruit">
            <input value={nw.fruit} onChange={(e) => setNw({ ...nw, fruit: e.target.value })} placeholder="orange" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
