import { createClient } from "@supabase/supabase-js";

export type School = "UCB" | "UCSD" | "UCLA";

export type ProfileRow = {
  id: string;
  display_name: string;
  school: School;
  major: string | null;
  avatar_initials: string;
  bio: string | null;
  verified_uc_email: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  school: School;
  category: string;
  mode: "线上" | "线下";
  reward_amount: number | null;
  reward_type: "paid" | "mutual_help";
  location: string;
  due_date: string | null;
  applications_count: number;
  status: "open" | "matched" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  profiles?: Pick<ProfileRow, "display_name" | "avatar_initials" | "verified_uc_email"> | null;
};

export type ApplicationRow = {
  id: string;
  task_id: string;
  applicant_id: string;
  message: string;
  available_time: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  tasks?: Pick<TaskRow, "title" | "school" | "mode" | "reward_amount" | "reward_type" | "created_at"> | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
