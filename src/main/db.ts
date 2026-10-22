import { join } from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'

export const DATA = app.getPath('userData')

const MIGRATIONS = [
  `create table items (
     id integer primary key,
     file_path text not null,
     thumb_path text not null,
     hash text not null unique,
     width integer not null,
     height integer not null,
     dominant_color text not null,
     source_url text,
     title text,
     created_at integer not null,
     status text not null default 'pending'
   );
   create index items_created on items (created_at desc);

   create table tags (
     id integer primary key,
     dimension text not null,
     value text not null,
     unique (dimension, value)
   );

   create table item_tags (
     item_id integer not null references items (id) on delete cascade,
     tag_id integer not null references tags (id) on delete cascade,
     primary key (item_id, tag_id)
   );`,

  // ponytail: quotes reuse the image columns ('' paths, 0×0) instead of a table rebuild.
  // Split into per-kind tables if a third kind with its own fields shows up.
  `alter table items add column kind text not null default 'image';
   alter table items add column body text;`,

  // quotes are auto-tagged 'quotes' on save (ingestQuote); backfill the ones saved before that
  `insert or ignore into tags (dimension, value) values ('tag', 'quotes');
   insert or ignore into item_tags (item_id, tag_id)
     select i.id, t.id from items i, tags t
     where i.kind = 'quote' and t.dimension = 'tag' and t.value = 'quotes';`,

  // colour per stack, keyed by the renderer's filter key ('kind:quote', 'tag:recipes')
  `create table stack_colors (key text primary key, color text not null);`,

  // Stacks become their own thing, separate from tags: made by the user, items added by hand.
  // Stacks made under the old tag-based scheme (the ones given a colour) carry over with
  // their items. Text saves split into quotes (has a "…" span) and snippets; the automatic
  // 'quotes' tag goes, since the kind now says it.
  `create table stacks (
     id integer primary key,
     name text not null unique collate nocase,
     color text not null,
     created_at integer not null
   );
   create table stack_items (
     stack_id integer not null references stacks (id) on delete cascade,
     item_id integer not null references items (id) on delete cascade,
     added_at integer not null,
     primary key (stack_id, item_id)
   );
   insert into stacks (name, color, created_at)
     select substr(key, 5), color, cast(strftime('%s', 'now') as integer) * 1000
     from stack_colors where key like 'tag:%';
   insert or ignore into stack_items (stack_id, item_id, added_at)
     select s.id, it.item_id, i.created_at from stacks s
     join tags t on t.dimension = 'tag' and t.value = s.name
     join item_tags it on it.tag_id = t.id
     join items i on i.id = it.item_id;
   drop table stack_colors;
   update items set kind = 'snippet' where kind = 'quote' and body not glob '*["“”„«»]*["“”„«»]*';
   delete from tags where dimension = 'tag' and value = 'quotes';`,

  // note: the user's own words about an item. palette: JSON list of up to three hex colours,
  // filled in the first time the item is opened (see items:palette)
  `alter table items add column note text;
   alter table items add column palette text;`,

  // palettes went from three colours to four; drop the cached ones so they're re-extracted
  `update items set palette = null;`,

  // AI analysis results (title and tags go in their usual places)
  `alter table items add column tldr text;
   alter table items add column visible_text text;
   alter table items add column ai_error text;`,

  // CLIP image vectors for same vibe (embed.ts). Their own table, so the 2 KB blobs never
  // ride along on items sent to the window. An empty vector marks a file that failed.
  `create table embeddings (
     item_id integer primary key references items (id) on delete cascade,
     vector blob not null
   );`,

  // trash: deleting sets this; rows and files go for good after 30 days, or on "Empty now"
  `alter table items add column deleted_at integer;
   create index items_deleted on items (deleted_at);`
]

export const db = new Database(join(DATA, 'tessera.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

for (let v = db.pragma('user_version', { simple: true }) as number; v < MIGRATIONS.length; v++) {
  db.transaction((sql: string) => {
    db.exec(sql)
    db.pragma(`user_version = ${v + 1}`)
  })(MIGRATIONS[v])
  console.log('[tessera] migrated to v' + (v + 1))
}

/* ---------- user tags ---------- */

const linkTag = db.prepare('insert or ignore into item_tags (item_id, tag_id) values (?, ?)')
const upsertTag = db.prepare(
  `insert into tags (dimension, value) values ('tag', ?)
   on conflict (dimension, value) do update set value = excluded.value returning id`
)

// Tags typed by the user live under the 'tag' dimension, beside the model's attributes.
// Input is untrusted (IPC, extension): trim, lowercase, cap length.
export const normTag = (t: unknown): string =>
  typeof t === 'string' ? t.trim().toLowerCase().slice(0, 50) : ''

export function addTags(itemId: number, raw: unknown[]): void {
  const tags = new Set(raw.map(normTag).filter(Boolean))
  db.transaction(() => {
    for (const t of tags) linkTag.run(itemId, (upsertTag.get(t) as { id: number }).id)
  })()
}

export function removeTag(itemId: number, value: string): void {
  db.prepare(
    `delete from item_tags where item_id = ?
     and tag_id = (select id from tags where dimension = 'tag' and value = ?)`
  ).run(itemId, normTag(value))
  // a tag on nothing would linger as an empty filter chip
  db.prepare(`delete from tags where dimension = 'tag' and id not in (select tag_id from item_tags)`).run()
}
