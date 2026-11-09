# Reddit Client

A small browser app for reading several subreddits side by side. It is built with HTML, CSS, and vanilla JavaScript. There is no build step and no server of your own.

## Open it

1. Download or clone this folder.
2. Open `index.html` in a browser.

The first visit shows two lanes: `r/learnprogramming` and `r/javascript`.

## What you can do

- Read post titles and upvote counts in each lane.
- Open a post on Reddit in a new tab.
- Add a lane with the **Add subreddit** card. `javascript`, `r/javascript`, and `/r/javascript` all work.
- Refresh one lane, or remove it, from the **⋮** menu.
- Try again when a lane fails to load. Other lanes stay on the board.
- Keep your lanes after a reload. Only the subreddit names are saved in `localStorage`. Posts are fetched again each visit.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page header, board, add card, and the add-subreddit popup |
| `styles.css` | Card layout, lane colors, menu, loading skeletons, and popup |
| `script.js` | Lane list, Reddit requests, rendering, and saving |

## Where the posts come from

Each lane first requests Reddit’s public JSON feed:

`https://www.reddit.com/r/<name>.json`

Browsers often cannot read that response. When that happens, the app loads the same fields (title, score, and link) from a public archive that allows browser requests. A missing subreddit shows an error in that lane only.

Up to 10 posts are shown in each lane.
