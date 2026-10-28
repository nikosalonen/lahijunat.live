<div align="center">
  <img src="public/Juna-meta-header.png" alt="Juna-meta-header">
</div>



# lahijunat.live
[![Netlify Status](https://api.netlify.com/api/v1/badges/4ed9ab1e-8726-4a3b-b1e4-6010e92f50b8/deploy-status)](https://app.netlify.com/sites/beautiful-sable-b9b106/deploys) ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/nikosalonen/lahijunat.live?utm_source=oss&utm_medium=github&utm_campaign=nikosalonen%2Flahijunat.live&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

Real-time commuter train schedules for Finnish trains.

## Features

- Real-time departure and arrival times
- Live updates for schedule changes and delays
- Easy station selection with origin and destination
- Track information for departures
- Journey duration info in minutes
- Mobile-friendly interface
- ~~Automatic location-based station selection~~
- Progressive Web App (PWA) support
- Dark mode

## Tech Stack

- [Astro](https://astro.build/) - Web framework
- [Preact](https://preactjs.com/) - UI components
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Biome](https://biomejs.dev/) - Linting and formatting
- Data provided by [Fintraffic's Railway Traffic API](https://www.digitraffic.fi/rautatieliikenne/)

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. For production build:
   ```bash
   npm run build
   ```

## Push alerts

Push alerts tell users about announcements for their favorite trains. They use Web Push. A scheduled Netlify function checks Digitraffic every minute and sends the alerts.

### Setup

1. Make a VAPID key pair on your machine:
   ```bash
   pnpm dlx web-push generate-vapid-keys
   ```
2. In Netlify, add these environment variables to the site:
   - `PUBLIC_VAPID_PUBLIC_KEY`: the public key. Set it for all scopes. The build and the functions both read it.
   - `VAPID_PRIVATE_KEY`: the private key. Set it for the Functions scope only. Keep it secret.
   - `PUBLIC_PUSH_ALERTS_ENABLED`: `true`. Set it for all scopes.
3. Redeploy the site.

For local work, copy `.env.example` to `.env` and fill in the values. Git ignores `.env`.

### Off switch

To turn alerts off, set `PUBLIC_PUSH_ALERTS_ENABLED` to `false` in Netlify and redeploy. The browser reads this value at build time, so the redeploy is needed. The job then calls no Digitraffic API and sends no alerts. It still deletes saved alerts once they expire, as the privacy text promises.

Remove `schedule` from `netlify/functions/check-alerts.mts` to stop the job entirely; then also clear the `push-alerts` store in the Netlify UI, because nothing will delete the records.

### Checking that it runs

- In the Netlify Functions tab, `check-alerts` should show the schedule `* * * * *`.
- In Netlify Blobs, open the `push-alerts` store. The `meta/last-run` key shows the last run time and counts. It updates only while alerts are on and at least one favorite train is saved. Keys starting with `sub/` are the saved alerts.
- On the Netlify usage page, expect about 1,440 function calls a day from the job.

Scheduled functions run only on the production site, not on deploy previews.

## Scripts

- `dev`: Start development server
- `build`: Build for production
- `preview`: Preview production build
- `lint`: Run Biome linter
- `format`: Format code with Biome


## License

This project is open source and available under the MIT license.

## Data Source

Train data is provided by Fintraffic's digitraffic.fi service under the CC 4.0 BY license.
