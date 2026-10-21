import { useRef, useState } from 'react'
import { isText, type Item, type Stack } from '@shared/api'
import { STACK_COLORS } from './Filters'
import { url } from './useItems'

// Back to front. Each layer spans the stack box; its card is centred inside, so rotating the
// layer tilts the card about the middle. Hover fans the pile out.
const LAYERS = [
  '-rotate-6 -translate-x-[7%] group-hover:-rotate-[11deg] group-hover:-translate-x-[14%]',
  'rotate-[5deg] translate-x-[7%] -translate-y-[2%] group-hover:rotate-[10deg] group-hover:translate-x-[14%]',
  'group-hover:-translate-y-[4%]'
]

// Every stack as a pile of its three newest items.
export default function Stacks({
  items,
  stacks,
  onOpen,
  onChange
}: {
  items: Item[]
  stacks: Stack[]
  onOpen: (key: string) => void
  onChange: () => void // a stack was created, edited or deleted
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<Stack | null>(null) // null = creating
  const byId = new Map(items.map((i) => [i.id, i]))

  const openDialog = (s: Stack | null) => {
    setEditing(s)
    dialog.current?.showModal()
  }

  return (
    <div className="pt-8 pr-20 pb-16 pl-1">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[36px] leading-none italic">All stacks</h2>
        <button
          onClick={() => openDialog(null)}
          className="flex items-center gap-2.5 rounded-full bg-card px-5 py-2.5 text-[13px] tracking-wider text-dim uppercase shadow-card transition hover:text-fg hover:shadow-lift"
        >
          <span className="size-3.5 rounded-full border-2 border-accent" />
          New stack
        </button>
      </div>

      {stacks.length === 0 && (
        <p className="mt-6 max-w-md text-[14px] leading-relaxed text-dim">
          Stacks are groups you make yourself, like a moodboard. Create one, then add things to it from
          their overlay.
        </p>
      )}

      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-10 gap-y-14">
        {stacks.map((s) => {
          const members = s.items.map((id) => byId.get(id)).filter((i): i is Item => !!i)
          const pile = members.slice(0, LAYERS.length).reverse() // newest on top
          const offset = LAYERS.length - pile.length
          const key = `stack:${s.id}`
          return (
            <div key={s.id} className="flex flex-col items-center">
              <button
                onClick={() => onOpen(key)}
                aria-label={`Open ${s.name}`}
                className="group relative aspect-[4/3] w-full"
              >
                {pile.length ? (
                  pile.map((item, i) => (
                    <div
                      key={item.id}
                      className={`absolute inset-[6%] flex items-center justify-center transition-transform duration-300 ease-out ${LAYERS[offset + i]}`}
                    >
                      <Card item={item} />
                    </div>
                  ))
                ) : (
                  <div className="absolute inset-[10%] grid place-items-center rounded-md border-2 border-dashed border-line px-6 text-center text-[13px] text-dim transition-colors group-hover:border-faint">
                    Empty. Open anything and use “Add to stack”.
                  </div>
                )}
              </button>
              <div className="mt-5 flex items-center gap-2 text-[15px] text-fg">
                <span className="size-3.5 rounded-full border-2" style={{ borderColor: s.color }} />
                <button onClick={() => onOpen(key)} className="hover:underline">
                  {s.name}
                </button>
                <span className="text-[13px] text-dim">{members.length}</span>
                <button
                  onClick={() => openDialog(s)}
                  aria-label={`Edit ${s.name}`}
                  title="Rename, recolour or delete"
                  className="ml-1 grid size-6 place-items-center rounded-full text-dim transition-colors hover:bg-black/[0.05] hover:text-fg"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <StackDialog ref={dialog} editing={editing} onDone={onChange} />
    </div>
  )
}

function Card({ item }: { item: Item }) {
  if (isText(item.kind))
    return (
      <div className="w-4/5 rounded-[4px] bg-card px-5 py-4 shadow-lift">
        {item.kind === 'quote' ? (
          <p className="line-clamp-5 text-center font-serif text-[14px] leading-snug text-fg">“{item.body}”</p>
        ) : (
          <p className="line-clamp-6 text-[12px] leading-relaxed text-fg">{item.body}</p>
        )}
      </div>
    )
  return (
    <img
      src={url(item.thumb_path)}
      alt=""
      draggable={false}
      style={{ background: item.dominant_color }}
      className="max-h-full max-w-full rounded-[4px] object-contain shadow-lift"
    />
  )
}

// Create a stack, or rename / recolour / delete one.
function StackDialog({
  ref,
  editing,
  onDone
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  editing: Stack | null
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(STACK_COLORS[0])
  const [error, setError] = useState('')

  // reset each time the dialog opens; `editing` changes right before showModal()
  const [shownFor, setShownFor] = useState<Stack | null | undefined>(undefined)
  if (shownFor !== editing) {
    setShownFor(editing)
    setName(editing?.name ?? '')
    setError('')
    setColor(editing?.color ?? STACK_COLORS[0])
  }

  const close = () => ref.current?.close()
  const done = () => {
    onDone()
    close()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the stack a name.')
    try {
      if (editing) await window.tessera.updateStack(editing.id, { name, color })
      else await window.tessera.createStack(name, color)
      done()
    } catch (err) {
      setError(String(err).includes('stack exists') ? 'A stack with that name already exists.' : 'Could not save the stack.')
    }
  }

  const remove = async () => {
    if (!editing || !confirm(`Delete the stack “${editing.name}”? The items in it stay in your library.`)) return
    await window.tessera.deleteStack(editing.id)
    done()
  }

  return (
    <dialog
      ref={ref}
      onClose={() => setShownFor(undefined)}
      className="m-auto w-[420px] rounded-lg bg-card p-8 text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submit}>
        <h2 className="font-serif text-[30px] leading-none italic">{editing ? 'Edit stack' : 'New stack'}</h2>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Recipes"
          spellCheck={false}
          maxLength={50}
          aria-label="Stack name"
          className="mt-6 w-full rounded-md bg-ink px-3 py-2.5 text-[15px] placeholder:text-faint focus:outline-2 focus:outline-accent"
        />

        <div className="mt-6 text-[11px] tracking-wider text-dim uppercase">Colour</div>
        <div role="radiogroup" aria-label="Colour" className="mt-3 flex gap-3">
          {STACK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`size-7 rounded-full border-[3px] transition-transform hover:scale-110 ${
                c === color ? 'ring-2 ring-fg/20 ring-offset-2' : ''
              }`}
              style={{ borderColor: c, background: c === color ? c : 'transparent' }}
            />
          ))}
        </div>

        {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

        <div className="mt-8 flex items-center gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="rounded-md px-3 py-2 text-[14px] text-red-600 transition-colors hover:bg-red-50"
            >
              Delete stack
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="ml-auto rounded-md px-4 py-2 text-[14px] text-dim transition-colors hover:bg-ink hover:text-fg"
          >
            Cancel
          </button>
          <button className="rounded-md bg-fg px-5 py-2 text-[14px] text-card transition-opacity hover:opacity-85">
            {editing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
