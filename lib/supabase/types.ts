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
          identity_pubkey: string;
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

      profile_devices: {
        Row: {
          user_id: string;
          device_id: string;
          identity_pubkey: string;
          label: string | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          user_id: string;
          device_id: string;
          identity_pubkey: string;
          label?: string | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_devices"]["Insert"]>;
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
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          type: "direct" | "group";
          name?: string | null;
          created_by: string;
          created_at?: string;
          last_message_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["chats"]["Insert"]>;
      };

      chat_members: {
        Row: {
          chat_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
          last_read_at: string | null;
          hidden_at: string | null;
        };
        Insert: {
          chat_id: string;
          user_id: string;
          role?: "owner" | "member";
          joined_at?: string;
          last_read_at?: string | null;
          hidden_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["chat_members"]["Insert"]>;
      };

      messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
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

      message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_reactions"]["Insert"]>;
      };

      posts: {
        Row: {
          id: string;
          user_id: string;
          image_path: string | null;
          caption: string | null;
          link_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          image_path?: string | null;
          caption?: string | null;
          link_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };

      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
      };

      events: {
        Row: {
          id: string;
          host_user_id: string;
          name: string;
          description: string | null;
          cover_image_path: string | null;
          starts_at: string;
          ends_at: string;
          reveal: "during" | "after" | "delayed";
          reveal_delay_hours: number;
          max_guests: number;
          join_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_user_id: string;
          name: string;
          description?: string | null;
          cover_image_path?: string | null;
          starts_at: string;
          ends_at: string;
          reveal?: "during" | "after" | "delayed";
          reveal_delay_hours?: number;
          max_guests?: number;
          join_code?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
      };

      event_members: {
        Row: {
          event_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_members"]["Insert"]>;
      };

      event_contributions: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          image_path: string | null;
          caption: string | null;
          link_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          image_path?: string | null;
          caption?: string | null;
          link_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_contributions"]["Insert"]>;
      };

      key_transfers: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          blob: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          blob: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["key_transfers"]["Insert"]>;
      };

      user_devices: {
        Row: {
          id: string;
          user_id: string;
          push_token: string;
          platform: "ios" | "android" | "web";
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          push_token: string;
          platform: "ios" | "android" | "web";
          last_seen_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_devices"]["Insert"]>;
      };
    };

    Views: {
      accepted_friends: {
        Row: {
          user_id: string;
          friend_id: string;
        };
      };
    };

    Functions: {
      get_or_create_direct_chat: {
        Args: { other_user: string };
        Returns: string;
      };
      create_group_chat: {
        Args: { group_name: string; member_ids: string[] };
        Returns: string;
      };
      mark_chat_read: {
        Args: { p_chat_id: string };
        Returns: void;
      };
      my_chat_unread_counts: {
        Args: Record<string, never>;
        Returns: Array<{ chat_id: string; unread_count: number }>;
      };
      add_chat_member: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: void;
      };
      join_event: {
        Args: { p_join_code: string };
        Returns: string;
      };
    };

    Enums: Record<string, never>;
  };
};
