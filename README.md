<img src="icons/logo.svg" alt="Kutipat logo" width="80" height="80">

# Kutipat: Private Web Data Scraper

**Kutipat** (from the Malay *kutip*, “to collect”, and *tepat*, “precise”: collect precisely) is a free, private data scraper for Chrome. It turns tables and lists on any web page into a spreadsheet, across many pages, in a side panel that stays open while you browse. There are no accounts and no tracking: Kutipat never records which sites you visit, and nothing you collect leaves your browser.

## Features at a glance

| Area | What Kutipat does |
| --- | --- |
| **Finding data** | Detects repeated records and real tables automatically, with **Try another** to step through candidates, or **Pick by clicking** one item |
| **Columns** | Meaningful names, detected types (price, number, date, link, image, email), rename and leave out columns |
| **More pages** | **Next button**, **Load more button** and **Infinite scroll**, found automatically or pointed to |
| **Cleaning** | Remove duplicates, trim text, and turn prices such as “S$1,299.00” into numbers |
| **Export** | Excel (`.xlsx`), CSV, JSON, or **Copy for Sheets** |
| **Saved setups** | Remembers each site’s setup, on this device only |
| **Responsible use** | Warns when data includes personal details, and shows a site’s robots.txt guidance before crawling it |

## Interface
- **Four steps:** Find the data, Review, More pages (optional) and Export, each in its own card, with an empty state that explains how to start.
- **Clear feedback:** colour-coded messages for information, success and warnings, and progress bars while collecting pages or saving files.
- **Column headings:** an on/off switch, an editable name, and an icon for each column’s type.
- **Original icons:** the extension icon and interface icons were drawn for Kutipat, so no third-party icon licences apply.
- **Light and dark mode:** follows the system setting. Every state passes the automated WCAG 2.x A and AA checks in axe-core, in both modes.

## Finding data
- **Automatic detection:** finds repeated record structures (product cards, search results, listings, feeds) and real HTML tables, and highlights the chosen one on the page. Navigation menus and other decoys rank lower than rich, repeated records.
- **Try another:** steps through up to 12 candidates, with each one’s row count and a sample.
- **Pick by clicking:** click any part of one item, such as a price, and Kutipat finds every item like it.
- **How it works:** detection follows the idea behind MDR, “Mining Data Records in Web Pages” (Liu, Grossman and Zhai, KDD 2003): data records are repeated sibling structures. Kutipat groups elements by their structure and scores the groups by how many records there are, how much content each has and how much of the page they cover.

## Columns
- **Meaningful names:** from table headings, from the site’s own class names (such as “Price” or “Title”), or from what the content is (Link, Image, Image text, Heading, Date).
- **Types:** each column is labelled as a price, number, date, link, image, email or text, from its values.
- **Links and images:** full web addresses, with the largest available image from responsive images, and machine-readable dates from `<time>` elements.
- **Edit:** rename a column by editing its heading, and untick it to leave it out of exports.

## More pages
- **Next button:** finds “Next”, “›” or `rel="next"` links automatically, or you point to the button. Kutipat follows it page by page, re-finding Next on each page unless you chose the button yourself.
- **Load more button:** presses it until it disappears or is disabled.
- **Infinite scroll:** scrolls to the bottom until no new rows appear.
- **Polite by default:** a wait between pages (2 seconds, adjustable, with a little variation), a page limit (10 by default, up to 500), and a Stop button. Kutipat stops by itself when a page shows the same rows again.
- **One site at a time:** following Next onto new pages needs permission to read that one site, which Kutipat asks for only then. It never asks for access to every site.

## Cleaning and export
- **Remove duplicates** and **Clean numbers** (prices and numbers become real numbers, with the separators used in the data understood).
- **Excel (`.xlsx`):** a real Excel file with a bold heading row, frozen headings, filters, and numbers stored as numbers.
- **CSV:** UTF-8 with a byte-order mark, so Excel opens accents and non-Latin text correctly.
- **JSON:** an array of objects, using your column names.
- **Copy for Sheets:** tab-separated, ready to paste into Google Sheets or Excel.
- **Safe for spreadsheets:** values that start with `=`, `+`, `-` or `@` are prefixed with an apostrophe, so a scraped value can never run as a formula (“formula injection”).

## Saved setups
- **Per site, on this device:** the data’s location, column names and choices, and the More pages setting are saved for each site, and offered when you return.
- **Your choice:** untick **Remember this setup** to remove a site’s saved setup.

## Saving pages and lessons (academic testing)
- **Extract text:** the visible text of every frame, as Markdown and JSON.
- **Limits by design:** only content your browser can already access is saved. Kutipat doesn’t get round logins, DRM, encryption or other access controls. Packages published from authoring tools (such as Articulate Storyline or Rise) contain compiled output, not the editable source file. Copyright stays with the content’s owners.

## Responsible use
- **Personal data warning:** when collected data includes email addresses or phone numbers, Kutipat reminds you that data protection laws such as GDPR or the PDPA may apply, and to keep only what you need for a lawful purpose.
- **robots.txt:** before crawling a site, Kutipat reads its `robots.txt` and tells you if it asks automated tools not to visit that section.
- **Your responsibility:** only scrape data you’re allowed to use, and follow each site’s terms.

## Compatibility
- **Browsers:** Chrome 116 or later, and other Chromium browsers with side panels (such as Edge). It doesn’t work on Chrome’s own pages, the Chrome Web Store or PDF files.
- **Access to a page:** clicking Kutipat’s toolbar button on a page opens the panel and gives Kutipat one-time access to that page, which Chrome ends when the page changes or you switch tabs. Kutipat then offers **Allow on [site]** for lasting access to that one site, or, if you click the toolbar button again, carries on automatically. The page’s address is remembered only for this browser session, in memory.
- **Pages:** ordinary web pages, including pages that load content with JavaScript. Data inside frames from other sites, or drawn on a canvas, can’t be read.
- **Files it saves:** `.xlsx`, `.csv`, `.json`, or the clipboard.
- **Accessibility:** keyboard-operable controls, visible focus, and the system’s light or dark theme.

## Privacy
- **No tracking:** no analytics, no counters, and no record of the sites you visit.
- **Nothing leaves your browser:** collected data stays in the side panel until you export it. Kutipat makes no network requests, except reading a site’s own `robots.txt` when you crawl that site.
- **No remote code:** everything Kutipat runs is in the extension.
- **Permissions:** see `PRIVACY.md`.

## Honest limits
- **Detection is a best guess:** use **Try another** or **Pick by clicking** when the first suggestion isn’t the data you want.
- **Sites change:** a saved setup stops matching when a site’s layout changes; Kutipat says so, and Find data starts afresh.
- **Login and anti-bot pages:** Kutipat reads what your browser shows. It doesn’t log in for you or get around CAPTCHAs or access controls, by design.

## Files
- **Extension:** `manifest.json`, `background.js`, `panel.html`, `panel.css` and `panel.js`.
- **Page engine:** `engine.js`, injected only into the page you are scraping, only when you use Kutipat.
- **Excel writer:** `xlsx-lite.js`, which writes `.xlsx` files with no library.
- **Store listing:** `store/`.

## Licence
This repository does not yet include a licence file, so by default all rights are reserved. To let others reuse the code, add a `LICENSE` file (for example the MIT licence).

## Selector finder (like SelectorsHub)
Pick any element to get six selectors, each with how many elements it matches: a unique CSS selector, a CSS selector for all similar items, a relative XPath, an XPath by its text, an absolute XPath and a JS path. Copy any of them, or test your own CSS or XPath: matches are outlined in orange.

## Sitemaps: collect from many pages (like Web Scraper)
- **Start pages:** one per line, with ranges such as `?page=[1-5]`, `[01-10]` (zero-padded) or `[0-100:20]` (in steps).
- **Selectors in a tree:** an **element** makes one row per match; **text**, **link**, **image**, **attribute**, **HTML** and **table** fill its columns; a **link** set to **follow** opens each page it points to, where its own child selectors run, and the results join the row; **pagination** visits the next pages.
- **Pick** each selector on the page (inside its parent when it has one), **Test** it, and **Preview** the rows before collecting.
- **Polite by default:** a wait between pages (2 seconds), a page limit (25, up to 500), staying on the same site and following its robots.txt. Collecting happens in a separate window, which closes when it finishes.
- **Export** the rows as Excel, CSV or JSON, with a warning when they look like personal data.
- **Web Scraper sitemaps** can be imported, and exported sitemaps open in Web Scraper too. Its click and scroll selectors become plain element selectors.

## Save everything on this page
The first card in the panel. **Save everything** looks at the page and lists what it found; **Download everything (ZIP)** saves it all:
- `data.xlsx`: every table and list Kutipat finds, one sheet each (numbers stay numbers), and the same tables as CSV files in `tables/`
- `links.csv` (text and address of every link), `images.csv` (address, alt text and size of every image) and `page.md` (the page's text)
- `files/`: the page's images, media, styles and fonts, sorted into folders, with `files/resources.csv` saying where each came from
- `about.txt`: the address, the date, and what is in the ZIP

It takes two clicks because Chrome only lets Kutipat ask for the other sites the files come from straight after a click, and Kutipat
can only know which sites once it has looked. Untick **Include the page's files** to save everything else without asking. Scripts are
left out (they are the page's code, not its content); the resources section below can save them. Everything is made in your browser.

## Save the page’s resources
Finds the files the page loaded (images, media, styles, scripts, fonts and documents), lets you choose which kinds to save, and downloads them in one ZIP, sorted into folders, with `resources.csv` listing where each came from. Data requests the page made are left out. Up to 400 files or 250 MB. Check that you may reuse what you download.

## Address bar
Type `kutip` and press Enter to open Kutipat on the page you’re on. If Chrome asks for a click first, the toolbar button shows a “!”: click it to open Kutipat.
