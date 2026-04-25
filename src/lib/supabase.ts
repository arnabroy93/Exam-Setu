import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://hklhshjbbuqxryhikkve.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGhzaGpiYnVxeHJ5aGlra3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDk5NzIsImV4cCI6MjA5MTgyNTk3Mn0.K07GYs6YEau5eL5jAkRw5gSOLrAGJBpfMTJKjUBzgvc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
