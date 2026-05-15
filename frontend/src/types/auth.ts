export interface AuthMeResponse {
  logged_in: boolean;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
}

export interface FirebaseUserSummary {
  display_name: string | null;
  email: string | null;
  photo_url: string | null;
}
