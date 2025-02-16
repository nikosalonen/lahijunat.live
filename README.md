<div align="center">
  <img src="public/Juna-meta-header.png" alt="Juna-meta-header">
</div>



# lahijunat.live
[![Netlify Status](https://api.netlify.com/api/v1/badges/4ed9ab1e-8726-4a3b-b1e4-6010e92f50b8/deploy-status)](https://app.netlify.com/sites/beautiful-sable-b9b106/deploys)

Real-time commuter train schedules for Finnish trains.

## Features

- Real-time departure and arrival times
- Live updates for schedule changes and delays
- Easy station selection with origin and destination
- Track information for departures
- Journey duration info in minutes
- Mobile-friendly interface
- Automatic location-based station selection
- Progressive Web App (PWA) support

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
