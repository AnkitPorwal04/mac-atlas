# MAC Atlas

Live website: https://mac-atlas.vercel.app

A local MAC-address evidence lookup page. No npm dependencies, remote lookup APIs, analytics, saved search history, active scanning, or packet interception.

## Run

Requires Node.js 22+ and curl (included with macOS).

```sh
npm run update-registry
npm start
```

Open http://localhost:4176. Set `PORT` to choose another port. The server binds only to 127.0.0.1. Do not expose this local utility through a public tunnel or deploy its cache-reader endpoint publicly.

## Available Evidence

- Validates 48-bit MACs in colon, hyphen, dotted, or compact notation. Shows normalized formats, binary octets, local/universal and individual/group bits, and broadcast/all-zero classification.
- Looks up the longest matching MA-L (24-bit), MA-M (28-bit), MA-S (36-bit), or legacy IAB (36-bit) assignment in downloaded IEEE data. Shows assignment holder, registered postal address, block size, source, and download timestamp. This is not the laptop's model, owner, or location. Local/group/special addresses are not given misleading vendor attribution.
- An explicit button reads the macOS host's existing IPv4 ARP cache using a fixed `/usr/sbin/arp -an` command. Only rows matching the entered address are returned. It does not scan the network or contact the target. Cache absence does not establish offline status, and cache presence does not establish current connectivity. This is the server computer's cache, not the browser device's cache.
- Import authorized router or network records as CSV. Supported columns: `mac` (required), `ip`, `hostname`, `accessPoint`, `switchPort`, `lastSeen`, `destination`, `bytes`. Underscores, hyphens, spaces and casing in headers are normalized. Timestamp, destination and byte values are displayed as supplied, without guessing their meaning. Only exact MAC matches are shown. This is an explicit schema, not an automatic parser for every router format. A header template is downloadable in the app.
- CSV records remain in the browser tab's memory, with a clear button. Limits: 2 MB, 10,000 rows, 1,000 characters per field; displays first 100 matches and exports all matching records as JSON. Reloading clears records and search state. Exports may contain sensitive network data; store/share them appropriately.

Access-point labels may suggest an area if your records contain them. Logged destinations are evidence of recorded network connections, not screen or browsing contents. No device location or activity is invented when records are absent.

## Data And Privacy

### Hosted Edition

`npm run build` creates `dist/` for Vercel. It uses the available IEEE snapshot, or downloads one when none exists. Only the page, browser scripts, stylesheet and public registry snapshot are published. No server or ARP endpoint is deployed. MAC matching and CSV processing happen in the browser; the app does not upload entered addresses or records. Vercel still receives ordinary page/asset requests and their standard request metadata.

The GitHub repository can remain private while the hosted site is public. A fresh GitHub deployment downloads registry data during the build; a download failure stops deployment rather than publishing an empty registry. The local `npm start` edition retains its original cache-check functionality.

The update command downloads full public datasets from IEEE's `standards-oui.ieee.org` endpoints (`oui/oui.csv`, `oui28/mam.csv`, `oui36/oui36.csv`, `iab/iab.csv`). Entered addresses are never sent to IEEE. Data is attributed to the [IEEE Registration Authority](https://standards.ieee.org/products-programs/regauth/), not claimed as original app data. Run the update command periodically and restart the app; the displayed date is the snapshot download date, not an assignment date. A failed update preserves the previous snapshot.

Lookups are served locally and are not logged by this server. Host/Origin/Fetch-Site checks and a custom header restrict cache access to the local UI. Files are served from an explicit allowlist; imported strings render as text. Other local software can still access the localhost API; this is not a multi-user authenticated service. macOS is required for the built-in cache reader; other systems can use the registry and CSV import.

## Tests

```sh
npm test
npm run check
```

Node tests cover normalization, address flags, longest-prefix selection, quoted CSV, import limits, ARP parsing, missing-data states, API validation, file allowlisting, and cross-origin restrictions. No real neighbor data is used by the automated server tests.

Verification: 10 Node tests and syntax checks pass, including static build isolation. Desktop (1440px) and mobile (390px) browser checks exercised registry lookup, local-address classification, CSV matching, literal rendering of HTML-like input, JSON download, clearing records, invalid-address recovery, and a mocked positive cache response. The actual macOS cache reader was also exercised with the public example address and returned no match. Live Vercel checks confirmed vendor lookup, CSV matching, export, responsive layout, no lookup uploads, and absent ARP/server endpoints. No target-device investigation or active scanning was performed.
