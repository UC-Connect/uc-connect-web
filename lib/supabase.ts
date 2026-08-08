import { createClient } from "@supabase/supabase-js";

export type School = "UCB" | "UCSD" | "UCLA";

export type ProfileRow = {
  id: string;
  display_name: string;
  school: School;
  major: string | null;
  contact_email: string | null;
  phone: string | null;
  wechat_id: string | null;
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
  author_completed_at: string | null;
  applicant_completed_at: string | null;
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
  tasks?: (Pick<TaskRow, "id" | "author_id" | "title" | "school" | "mode" | "reward_amount" | "reward_type" | "status" | "author_completed_at" | "applicant_completed_at" | "created_at"> & {
    profiles?: Pick<ProfileRow, "display_name" | "contact_email" | "phone" | "wechat_id"> | null;
  }) | null;
  profiles?: Pick<ProfileRow, "display_name" | "avatar_initials" | "verified_uc_email" | "school" | "major" | "contact_email" | "phone" | "wechat_id"> | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: "new_application" | "application_status" | "completion_waiting" | "task_completed" | "review_received";
  title: string;
  body: string;
  task_id: string | null;
  application_id: string | null;
  review_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
