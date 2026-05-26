/**
 * Hand-maintained database types. Once the Supabase schema is stable you can
 * regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > lib/supabase/types.ts
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          identity_pubkey: string; // base64-encoded X25519 public key
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          identity_pubkey: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted" | "blocked";
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: "pending" | "accepted" | "blocked";
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["friendships"]["Insert"]>;
      };
      chats: {
        Row: {
          id: string;
          type: "direct" | "group";
          name: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: "direct" | "group";
          name?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chats"]["Insert"]>;
      };
      chat_members: {
        Row: {
          chat_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
        };
        Insert: {
          chat_id: string;
          user_id: string;
          role?: "owner" | "member";
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_members"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
          // Per-recipient encrypted payloads. Each entry contains the
          // ciphertext + ephemeral pubkey + nonce for one recipient.
          //
          // Shape: { [recipient_user_id: string]: {
          //   ephemeral_pub: string; // base64
          //   nonce: string;         // base64
          //   ciphertext: string;    // base64
          // } }
          recipient_payloads: Record<
            string,
            { ephemeral_pub: string; nonce: string; ciphertext: string }
          >;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          recipient_payloads: Database["public"]["Tables"]["messages"]["Row"]["recipient_payloads"];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          image_path: string; // path inside the 'posts' storage bucket
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          image_path: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
