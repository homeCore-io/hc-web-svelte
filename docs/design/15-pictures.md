# 15 · Pictures: your own pictures and videos, and where they go

**Status:** agreed, 2026-11-08. Building in rounds: §5 says what's built.

**Where it came from.** The only way to use a picture of your own was the
Picture card, which uploaded a fresh copy each time, kept no name or owner,
and never deleted anything. The user asked for real file management (upload,
delete) and noted that pictures make customizing very personal. The canvas
board "Pictures" is the mockup this design was agreed on.

---

## 1. The decisions

- **P1. Kept by the UI server.** Pictures and videos live in the UI server's
  data folder (`pictures/`), never in homeCore. A backup of that data volume
  holds them. (The in-app backup, Settings › Data, saves the UI server's
  documents only; pictures aren't in it yet, §6.)
- **P2. One library.** Settings › Pictures lists everything this person may
  see: named, who added it and when, everyone's or just theirs, in albums.
  Upload from there or from any picker.
- **P3. One picker, everywhere.** Rooms, people, displays and Picture cards
  choose the same way: from the library or upload new. Where words go over
  it, the picker also says which part stays in view and how dark it goes
  behind the words.
- **P4. Each picture knows where it's used.** Not by keeping a list: its
  address is looked for in the household's, the displays' and people's
  documents when asked, so it's never out of date. Delete says where it's
  used and takes it off them all. One used nowhere is deleted at once, with
  Undo.
- **P5. Shared places take shared pictures.** A room, a display and a
  household page are everyone's, so a picture used there is shared. Choosing
  one of your own there says so first. One used somewhere shared can't go
  back to being just yours while it's used there.
- **P6. Video, silent.** MP4 or WebM, played silent and looping in a room's
  header, once through in a display's frame. Anywhere else it shows its
  first frame.
- **P7. Sizes made for the screen.** The server keeps the original, and the
  app makes smaller copies when a picture is added: a tile (480 px), one a
  screen wide (1920 px), and a video's first frame. They're served by
  `?size=tile|screen|poster`, the original standing in until a copy exists.
  Pictures up to 20 MB, videos up to 200 MB.
- **P8. Who may.** Anyone signed in adds pictures and changes or deletes
  their own. Changing or deleting someone else's shared picture, or one from
  before the library, is for people who edit the house's pages
  (`content:write`). A display looks, and adds nothing.

## 2. On the server

One index document, `pictures/library`, holds each picture: its id (the
random file name), kind, size in bytes, owner and their name, when it was
added, shared or not, albums, and its copies. Pictures from before the
library are taken in as everyone's, by nobody in particular.

| Route | What |
|---|---|
| `GET /ui/pictures` | What this person sees, each with where it's used and its albums |
| `POST /ui/pictures?name=&shared=1` | The body is the file; kept as it arrives, by its first bytes |
| `GET /ui/pictures/<file>?size=` | The file or a copy; ranges, for a video |
| `PATCH /ui/pictures/<file>` | Name, shared, albums |
| `DELETE /ui/pictures/<file>` | Takes it off every document, then removes its files |
| `PUT /ui/pictures/<file>/<size>` | A copy the app made |

A picture's file is served to whoever may see it: everyone's to anyone
signed in and to displays, someone's own only to them.

## 3. In the app

- **Settings › Pictures**: the library (P2), for anyone who reads the house.
- **The picker** (`PicturePicker`): P3, P5.
- **A Picture card's settings**: the picker; chosen in Edit mode, it's shared.

## 4. Where pictures go

Built or building: a Picture card; a room's photo, behind its header and its
box on Home; a person's picture, in place of their initial; a display's
picture frame at rest, from an album. Later, with the same picker: a thing's
own photo in place of its icon, a scene's picture, a page's backdrop.

## 5. Built

- **Round 1, the library on the UI server:** P1, P4, P7 (serving), P8.
- **Round 2, the library and picker in the app:** Settings › Pictures, the
  picker, the Picture card's settings.

## 6. Still to do

- Room photos, people's pictures (round 3); a display's picture frame
  (round 4).
- The in-app backup to include pictures.
- Replacing a picture's file while keeping its uses.
