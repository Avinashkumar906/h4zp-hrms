import { createClient } from '@supabase/supabase-js';

// Keys: set them in the CONFIG block at the top of h4zp-hr.html (single-file version),
// or in .env for a React website (REACT_APP_… or VITE_…).
let url, key;
try { const c = window.H4ZP_HR_CONFIG || {}; url = c.supabaseUrl; key = c.supabaseAnonKey; } catch (e) { /* no window */ }
try { url = url || process.env.REACT_APP_SUPABASE_URL; key = key || process.env.REACT_APP_SUPABASE_ANON_KEY; } catch (e) { /* not CRA */ }
try { url = url || import.meta.env.VITE_SUPABASE_URL; key = key || import.meta.env.VITE_SUPABASE_ANON_KEY; } catch (e) { /* not Vite */ }
url = url && !url.includes('YOUR-PROJECT') ? url : ''; key = key && !key.includes('YOUR-ANON') ? key : '';

export const supabase = url && key ? createClient(url, key) : null;
/** A second client used only to create new logins, so the admin stays signed in. */
export const signupClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'h4zp-hr-signup' } });
/** Without keys H4ZP HR runs in demo mode: data stays in this browser only. */
export const DEMO_MODE = !supabase;
