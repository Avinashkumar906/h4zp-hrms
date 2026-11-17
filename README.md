# H4ZP HR

## Local development

Requires Node.js 18 or newer.

1. Install dependencies: `npm install`
2. Optional: copy `.env.example` to `.env.local` and set your Supabase project URL and anon key.
3. Start the development server: `npm run dev`
4. Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

Without Supabase values, the app uses demo mode and stores demo data in this browser. The demo login is `admin` / `h4zp-demo`.

The `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values are exposed in the browser bundle; use only the Supabase anon/publishable key, never a service-role key. Ensure the Supabase database schema and access policies are configured before using a project with real data.

## Static deployment build

Run `npm run build` to generate `../1-UPLOAD-TO-WEBSITE/hr/index.html`. For this standalone deployment, configure Supabase in `config.js` beside the generated HTML; this keeps the deployment configuration separate when replacing the HTML file.
