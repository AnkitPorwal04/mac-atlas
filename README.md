# MAC Atlas

An evidence-based MAC address lookup tool with browser-side vendor matching, address analysis, and network-record correlation.

[Live Demo](https://mac-atlas.vercel.app) · [Getting Started](#getting-started) · [CSV Import](#csv-import) · [Privacy](#privacy-and-security)

MAC Atlas separates what an address encodes, what public registries establish, and what your own network records show. It supports a static hosted edition and a local edition with optional macOS ARP-cache lookup. Neither edition performs active scanning or packet interception.

## Features

- **Vendor lookup:** Longest-prefix matching against IEEE MA-L, MA-M, MA-S, and legacy IAB assignments, with source attribution and snapshot date.
- **Address analysis:** Local/universal and individual/group bits, broadcast and all-zero classification, normalized notation, and binary octets.
- **Network-record matching:** Browser-only CSV import for hostnames, IP addresses, access-point labels, switch ports, timestamps, and logged destinations.
- **Local cache lookup:** An explicit, read-only check of the host Mac's existing IPv4 ARP entries.
- **Export:** Download matching evidence as JSON, including its source and relevant timestamps.
- **Responsive interface:** Desktop and mobile layouts, keyboard-accessible controls, and reduced-motion support.

## Choose an Edition

### Hosted Website

Open **[mac-atlas.vercel.app](https://mac-atlas.vercel.app)**. No installation is required.

The website downloads a public IEEE registry snapshot and matches addresses in your browser. CSV imports also remain in the browser. Local ARP lookup is unavailable because a hosted website cannot read your computer's network cache.

### Local Application

Run the app on your computer for registry lookup, CSV matching, and the macOS cache reader. The server listens only on `127.0.0.1`; it is not intended for public exposure or multi-user access.

## Getting Started

### Requirements

- Node.js 22 or later, with npm
- Git, to clone the repository
- `curl`, to download registry snapshots; included with macOS
- macOS, only for the built-in ARP-cache reader

No npm package dependencies need to be installed.

```sh
git clone https://github.com/AnkitPorwal04/mac-atlas.git
cd mac-atlas
npm run update-registry
npm start
```

Open **http://localhost:4176**. To use another port:

```sh
PORT=8080 npm start
```

Without a downloaded snapshot, the local app can still analyze address bits and match imported records, but vendor results are unavailable.

## Usage

1. Enter a MAC address in colon, hyphen, dotted, or compact hexadecimal notation.
2. Review the registry match and address signature.
3. Optionally import authorized network records to find exact address matches.
4. In the local macOS edition, select **Check local ARP cache** for matching cached IP and interface information.
5. Select **Export JSON** to download the evidence.

Accepted representations of the same address:

```text
28:6F:B9:12:34:56
28-6F-B9-12-34-56
286F.B912.3456
286FB9123456
```

## CSV Import

The `mac` column is required. Optional columns are `ip`, `hostname`, `accessPoint`, `switchPort`, `lastSeen`, `destination`, and `bytes`. Header matching ignores casing, spaces, underscores, and hyphens.

```csv
mac,ip,hostname,accessPoint,switchPort,lastSeen,destination,bytes
28:6F:B9:12:34:56,192.0.2.10,example-laptop,Lab AP,port-4,2026-01-01T12:00:00Z,example.test,2048
```

This row is illustrative, not a discovered device. A blank header template is available from the interface.

- Maximum file size: 2 MB
- Maximum row count: 10,000
- Field values are truncated to 1,000 characters
- Invalid MAC rows are skipped; valid addresses are normalized before matching
- The interface displays the first 100 matches; JSON exports include all matches
- Timestamps, destinations, and byte counts are displayed as supplied

Records remain in the current tab's memory. **Clear** removes the imported records, and reloading clears both imports and search state. Router exports must be mapped to the supported columns; the importer does not automatically interpret every vendor's format.

## Data Sources

Registry data comes from the [IEEE Registration Authority](https://standards.ieee.org/products-programs/regauth/):

- [MA-L](https://standards-oui.ieee.org/oui/oui.csv): 24-bit assignments
- [MA-M](https://standards-oui.ieee.org/oui28/mam.csv): 28-bit assignments
- [MA-S](https://standards-oui.ieee.org/oui36/oui36.csv): 36-bit assignments
- [IAB](https://standards-oui.ieee.org/iab/iab.csv): legacy 36-bit assignments

The updater downloads complete public datasets, not individual address queries. Data is stored in the ignored `data/` directory and attributed to IEEE.

```sh
npm run update-registry
```

Restart the local server after updating. For the hosted edition, rebuild and redeploy. The displayed date is the snapshot download date, not the date an assignment was issued. A failed update preserves the previous snapshot.

## Privacy and Security

### Hosted Edition

- Entered MAC addresses and imported CSV records are not uploaded by the app.
- Matching takes place in the browser against the downloaded registry.
- Vercel receives ordinary page and asset requests, including standard request metadata.
- No ARP endpoint or Node.js server source is deployed.

### Local Edition

- Lookup requests go to the server on your own computer and are not logged by the application.
- Cache checks execute the fixed command `/usr/sbin/arp -an`, without scanning or connecting to the target.
- Host, Origin, Fetch-Site, and custom-header checks restrict cache access from websites.
- Static files are served from an explicit allowlist. Imported text is rendered as text rather than HTML.

Other local software can still access the localhost API. Do not expose the local server through a public tunnel or treat it as an authenticated multi-user service.

Both editions have no application analytics or persistent search history. Exported files may contain sensitive network information; store and share them accordingly. Inspect only records you own or are authorized to access.

## Interpreting Results

- A registry match identifies the **assignment holder**, not a confirmed laptop model, owner, or physical location. The registrant's postal address belongs to the organization.
- Locally administered, group, and special addresses are not assigned misleading vendor identities. A local address may be randomized, manually configured, or virtual.
- A MAC address can be changed or spoofed; it does not authenticate a device.
- ARP entries can be stale. A match does not prove current connectivity, and no match does not prove a device is offline. The cache belongs to the computer running the server.
- An access-point label may provide location context from your records. A logged destination records a connection, not screen contents or a complete browsing history.

## Development

```sh
npm test
npm run check
npm run build
```

The automated suite contains 10 tests covering normalization, address flags, prefix matching, CSV parsing, ARP parsing, API validation, origin restrictions, file allowlisting, unavailable-data states, and static build isolation. Server tests use fixtures rather than real neighbor data.

Desktop and mobile browser checks have also exercised lookup, CSV matching, safe rendering of imported text, JSON export, and error recovery. Hosted checks confirmed that lookups do not upload entered addresses and that local-server endpoints are absent.

### Project Structure

```text
public/               Interface, browser logic, and shared address utilities
server.mjs            Local HTTP server and macOS ARP-cache integration
update-registry.mjs   IEEE registry downloader
build.mjs             Static hosted-edition build
tests/                Node.js test suite
vercel.json           Hosting configuration and security headers
```

## Deployment

`npm run build` generates `dist/` containing only the page, browser scripts, stylesheet, and public registry snapshot. It uses an existing snapshot when available, or downloads one if none exists. A failed download stops the build rather than publishing an empty registry.

The included Vercel configuration sets `npm run build` as the build command and `dist` as the output directory. This repository is connected to the live project; pushes to `main` trigger deployments.

Downloaded registry data, build output, and local Vercel settings are excluded from Git. The hosted build intentionally publishes the public registry snapshot, but never imported network records.
