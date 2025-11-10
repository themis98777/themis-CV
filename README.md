# Them_is_tattooer — Portfolio

Static portfolio site for a tattoo artist who also works as a video editor and social media creator.

Live hosting recommended via GitHub Pages.

## Roles

- Tattoo Artist
- Video Editor
- Social Media Creator

## Structure

```
.
├── index.html                 # Main page (hero, about, selected work, contact)
└── assets/
		├── css/
		│   └── styles.css         # Styling
		├── img/                   # Images (put your .jpg/.jpeg/.png here)
		└── video/                 # Videos (put your .mp4 here)
```

## Add images

1. Copy image files into `assets/img/` (e.g., `assets/img/IMG_2429.jpg`).
2. Edit `index.html` and replace a placeholder card with your image:

```html
<figure class="media-card">
	<img
		class="media-card__thumb"
		src="assets/img/IMG_2429.jpg"
		alt="Describe the tattoo, e.g. Blackwork rose on forearm"
		loading="lazy"
		width="800" height="1000"
	/>
	<figcaption class="media-card__caption">Blackwork rose</figcaption>
</figure>
```

Tips:
- Use meaningful alt text to describe the piece (style, body placement).
- Prefer JPEG for photos; keep file size reasonably small (under ~1 MB if possible).
- For advanced setups, add responsive `srcset` later.

## Add videos

1. Copy `.mp4` files into `assets/video/`.
2. Add a video card in `index.html`:

```html
<figure class="media-card">
	<video class="media-card__thumb" controls preload="metadata" playsinline>
		<source src="assets/video/session-01.mp4" type="video/mp4" />
	</video>
	<figcaption class="media-card__caption">Session highlights</figcaption>
</figure>
```

Notes:
- Keep videos short for performance. Consider 720p for web.
- Export with H.264 for compatibility.

## Customize social links

Instagram is already configured to:

```html
<a class="social-link" href="https://www.instagram.com/them_is_tattooer/" target="_blank" rel="noopener noreferrer">
	@them_is_tattooer
</a>
```

If you need to change it, edit the link in `index.html` and the JSON-LD `sameAs` array in the `<head>`.

## Dynamic gallery (media.json)

The gallery is generated from `assets/data/media.json`. Each entry is an object:

```json
{
	"type": "image",            // "image" or "video"
	"src": "assets/img/file.jpg", // path to media inside the repo
	"alt": "Alt text for images", // required for images
	"caption": "Short caption",   // optional
	"width": 800,                  // optional (images)
	"height": 1000,                // optional (images)
	"poster": "assets/img/poster.jpg", // optional (videos)
	"controls": true,              // optional (videos)
	"muted": false,                // optional (videos)
	"loop": false,                 // optional (videos)
	"playsinline": true,           // optional (videos)
	"categories": ["tattoo"]       // optional tags
}
```

How to add more items:
1. Copy files into `assets/img/` or `assets/video/`.
2. Open `assets/data/media.json` and add a new object describing your item.
3. Commit and push. The gallery updates automatically.

### Filters

Filter buttons are generated from each item's `categories` array. Add tags like `"fine-line"`, `"blackwork"`, or `"reel"` to enable filtering.

### Lightbox

Click an image (or tap) to open it larger. Videos open in a modal and can be played there. Use the on-screen arrows or your keyboard (←/→) to navigate between visible items. Press `Esc` or click the backdrop/close button to exit.

### Search and multi-select filters

- Use the search box above the gallery to filter by caption, alt text, or case-study title.
- You can toggle multiple category filters at once. Click “All” to reset.

### Case-study (project detail) modal

For selected works, you can define a `detail` object to show a richer story:

```json
{
	"type": "image",
	"src": "assets/img/example.jpg",
	"alt": "Fine-line snake on forearm",
	"caption": "Fine-line snake",
	"categories": ["tattoo", "fine-line"],
	"detail": {
		"title": "Snake Flow Study",
		"description": "Minimal shading with emphasis on clean curves.",
		"placement": "Forearm",
		"style": ["Fine-line"],
		"date": "2025-11-01",
		"images": ["assets/img/example.jpg"]
	}
}
```

If `detail` exists, a “View story” button appears on the card. Clicking it opens the case-study modal with title, meta tags, description, and an image/video gallery.

## New gallery UX options

- Masonry layout: toggle the masonry view with the “Masonry: On/Off” button above the gallery.
- Reveal-on-scroll: items gently animate in as they appear in the viewport.
- Video hover preview: videos will briefly autoplay (muted, looping) when you hover over the thumbnail.

## Instagram snapshot (static)

If you want to reflect Instagram details without integrating the API, update the snapshot card in `index.html`:

- Avatar: replace `assets/img/instagram-avatar.svg` with a cropped profile image (name it `instagram-avatar.jpg` or update the `src`).
- Bio line: edit the text under the snapshot card.
- Stats: replace the dashes with numbers for Followers / Following / Posts.

Note: Instagram often blocks automated scraping; the snapshot is intended for occasional manual updates.

## Deploy to GitHub Pages

Option A — main branch root (simple):
1. Commit and push to `main`.
2. In the repo Settings → Pages:
	 - Source: Deploy from a branch
	 - Branch: `main` / root
3. Save. Your site will be available at `https://<username>.github.io/<repo>/`.

Option B — docs folder (optional): move files into `/docs` and set Pages to `main`/`/docs`.

## Meta image (optional)

Add an Open Graph image at `assets/img/og-image.jpg` (1200×630 recommended) and it will be used for link previews.

## Development

Any static server will do. For a quick local test:

```sh
# Python 3
python3 -m http.server 5173

# Then open http://localhost:5173
```

## License

All artwork remains the property of the artist. Website code MIT licensed.
 