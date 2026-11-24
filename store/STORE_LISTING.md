# Chrome Web Store listing

**Name:** Kutipat: Private Web Data Scraper (must match manifest.json)

**Summary (132 characters max):** Turn tables and lists on any page into a spreadsheet, across pages. No tracking, no account, nothing leaves your browser.

**Category:** Productivity (Tools)

## Description
Kutipat turns tables and lists on any web page into a spreadsheet, in a side panel that stays open while you browse.

• Finds the data for you: product listings, search results, directories, feeds and tables. Not the right data? Try another, or click one item and Kutipat finds the rest.
• Clear columns: meaningful names and detected types (price, number, date, link, image, email). Rename columns or leave them out.
• Many pages: follows Next buttons, presses Load more, or scrolls infinite feeds, with a polite wait and a page limit.
• Clean data: remove duplicates and turn prices into real numbers.
• Export to Excel (.xlsx), CSV or JSON, or copy straight into Google Sheets. Exports are protected against spreadsheet formula injection.
• Remembers each site’s setup, on your device.
• Responsible by design: warns when data includes personal details, and shows a site’s robots.txt guidance.

Private by design: no analytics, no tracking, no account. Kutipat never records which sites you visit, and nothing you collect leaves your browser. It asks for access to a site only when you crawl that site, never to every site.

## Permission justifications
- **activeTab:** reads the current page only after the user opens Kutipat on it.
- **scripting:** injects Kutipat’s page engine into that tab to find and read the data.
- **sidePanel:** shows Kutipat’s interface beside the page.
- **storage:** saves each site’s scraping setup locally.
- **Optional host access:** requested at run time for one site, only when the user follows Next onto new pages of that site, because activeTab access ends when a page navigates.

## Data use disclosures
Kutipat does not collect or transmit user data. It does not sell data, use it for unrelated purposes, or use it for creditworthiness or lending.

**Privacy policy:** link to PRIVACY.md in the GitHub repository.

SITEMAPS FOR MANY PAGES
• Build a sitemap of selectors, follow links to detail pages, and page through results, politely, with waits, page limits and robots.txt.
• Import and export sitemaps in the Web Scraper format.

FIND AND TEST SELECTORS
• Get CSS and XPath selectors for any element, with match counts, and test your own.

SAVE A PAGE’S FILES
• Download the images, media, styles and fonts a page loaded, sorted into folders, with a list of where each came from.
