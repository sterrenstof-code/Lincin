/**
 * Hand-maintained database types.
 *
 * ---------------------------------------------------------------
 * DIT BESTAND MOET MEEGROEIEN MET `supabase/migrations/`
 * ---------------------------------------------------------------
 * Elke tabel die hier ontbreekt, geeft `never` terug uit
 * `supabase.from(...)`. Niet als foutmelding op de plek waar de tabel
 * mist, maar als een regen van "Property 'x' does not exist on type
 * 'never'" verderop in `lib/api/`. Dat is precies wat er gebeurd is: het
 * bestand liep 16 tabellen achter, goed voor ~133 van de 173 typefouten
 * in het project, en daardoor was `npm run typecheck` niet meer bruikbaar
 * als poort — echte fouten verdronken in de ruis.
 *
 * Voeg dus bij élke nieuwe migratie de tabel hier toe. De kolommen komen
 * één op één uit de SQL; de `/** 00xx_naam *\/`-verwijzingen hieronder
 * wijzen naar de migratie die de kolom introduceerde, zodat je bij twijfel
 * de bron terugvindt.
 *
 * Regenereren is beter dan bijhouden zodra je toegang hebt:
 *
 *   supabase link --project-ref <ref>
 *   supabase gen types typescript --linked > lib/supabase/types.ts
 *
 * Dat kon hier niet — de CLI is niet gekoppeld en er draait geen lokale
 * instantie — dus is dit handmatig afgeleid uit de 42 migraties.
 */

/** `posts_kind_check` uit 0042_feed_finds. */
export type PostKind =
  | "note"
  | "image"
  | "link"
  | "video"
  | "music"
  | "fragment"
  | "fact"
  | "idea";

/** `activity_kind`-enum uit 0031_feed_features. */
export type ActivityKind =
  | "friend_accepted"
  | "post_created"
  | "event_created"
  | "event_joined";

/** `entity_comments.entity_type` uit 0038_entity_comments. */
export type CommentEntityType = "post" | "poll" | "call_plan" | "list";

/** `event_join_policy`-enum uit 0043_event_join_policy. */
export type EventJoinPolicyValue = "open" | "closed";

/**
 * De rij die `list_my_events` en `get_event_meta` teruggeven: een event
 * plus de afgeleide tellingen. Staat hier los omdat beide functies exact
 * dezelfde vorm hebben (zie 0041_event_improvements en 0043_event_join_policy).
 */
export type EventMetaRow = Database["public"]["Tables"]["events"]["Row"] & {
  /** `bigint` in SQL; komt als number over de wire. */
  members_count: number;
  contributions_count: number;
  /** Openstaande toegangsverzoeken. Alleen gevuld voor de host; anders 0. */
  pending_requests_count: number;
};

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
          /** Base64 X25519 privé-sleutel. Alleen ophalen voor de eigen user. */
          identity_privkey: string | null;
          created_at: string;
          /** 0035_last_seen — voedt de activiteitsindicator. */
          last_seen_at: string | null;
          /** 0044_bio_follows_boosts — vrije tekst op je profiel. */
          bio: string | null;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          identity_pubkey: string;
          identity_privkey?: string | null;
          created_at?: string;
          last_seen_at?: string | null;
          bio?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };

      chats: {
        Row: {
          id: string;
          type: "direct" | "group";
          name: string | null;
          created_by: string;
          created_at: string;
          last_message_at: string | null;
          /** 0029_chat_avatar */
          avatar_url: string | null;
        };
        Insert: {
          id?: string;
          type: "direct" | "group";
          name?: string | null;
          created_by: string;
          created_at?: string;
          last_message_at?: string | null;
          avatar_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["chats"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
          /** 0030_message_edit_delete */
          edited_at: string | null;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          recipient_payloads: Database["public"]["Tables"]["messages"]["Row"]["recipient_payloads"];
          created_at?: string;
          edited_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
      };

      posts: {
        Row: {
          id: string;
          user_id: string;
          image_path: string | null;
          caption: string | null;
          link_url: string | null;
          created_at: string;
          /** 0042_feed_finds — de soort vondst; zie `posts_kind_check`. */
          kind: PostKind;
          source_title: string | null;
          source_author: string | null;
          body_text: string | null;
          tags: string[];
          meta: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          user_id: string;
          image_path?: string | null;
          caption?: string | null;
          link_url?: string | null;
          created_at?: string;
          kind?: PostKind;
          source_title?: string | null;
          source_author?: string | null;
          body_text?: string | null;
          tags?: string[];
          meta?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
          join_policy: EventJoinPolicyValue;
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
          join_policy?: EventJoinPolicyValue;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };

      /** 0043_event_join_policy — verzoeken om binnen te mogen. */
      event_join_requests: {
        Row: {
          event_id: string;
          user_id: string;
          status: "pending" | "approved" | "declined";
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: {
          event_id: string;
          user_id: string;
          status?: "pending" | "approved" | "declined";
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["event_join_requests"]["Insert"]
        >;
        Relationships: [];
      };

      event_members: {
        Row: {
          event_id: string;
          user_id: string;
          role: "host" | "guest";
          joined_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          role?: "host" | "guest";
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_members"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };

      // =============================================================
      // 0031_feed_features — activiteit, polls, belafspraken
      // =============================================================

      activity_events: {
        Row: {
          id: string;
          actor_id: string;
          kind: ActivityKind;
          post_id: string | null;
          event_id: string | null;
          friend_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          kind: ActivityKind;
          post_id?: string | null;
          event_id?: string | null;
          friend_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_events"]["Insert"]>;
        Relationships: [];
      };

      polls: {
        Row: {
          id: string;
          user_id: string;
          question: string;
          /** `null` = geen deadline. */
          ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question: string;
          ends_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["polls"]["Insert"]>;
        Relationships: [];
      };

      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          label: string;
          position: number;
        };
        Insert: {
          id?: string;
          poll_id: string;
          label: string;
          position?: number;
        };
        Update: Partial<Database["public"]["Tables"]["poll_options"]["Insert"]>;
        Relationships: [];
      };

      poll_votes: {
        Row: {
          id: string;
          poll_option_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          poll_option_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["poll_votes"]["Insert"]>;
        Relationships: [];
      };

      call_plans: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_plans"]["Insert"]>;
        Relationships: [];
      };

      call_plan_slots: {
        Row: {
          id: string;
          call_plan_id: string;
          starts_at: string;
          ends_at: string;
        };
        Insert: {
          id?: string;
          call_plan_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_plan_slots"]["Insert"]>;
        Relationships: [];
      };

      call_plan_votes: {
        Row: {
          id: string;
          call_plan_slot_id: string;
          user_id: string;
          available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_plan_slot_id: string;
          user_id: string;
          available?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_plan_votes"]["Insert"]>;
        Relationships: [];
      };

      /** 0033_call_plan_invites */
      call_plan_invites: {
        Row: {
          id: string;
          call_plan_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_plan_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_plan_invites"]["Insert"]>;
        Relationships: [];
      };

      // =============================================================
      // 0032_notifications / 0034_post_reactions / 0009_invites
      // =============================================================

      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          /** Bijv. 'comment_on_post' | 'comment_on_thread'. */
          type: string;
          post_id: string | null;
          comment_id: string | null;
          /** 0041_event_improvements */
          event_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          type: string;
          post_id?: string | null;
          comment_id?: string | null;
          event_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };

      post_reactions: {
        Row: {
          post_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_reactions"]["Insert"]>;
        Relationships: [];
      };

      // 0044_bio_follows_boosts
      post_follows: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_follows"]["Insert"]>;
        Relationships: [];
      };

      post_boosts: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_boosts"]["Insert"]>;
        Relationships: [];
      };

      // 0045_post_images — meerdere foto's onder één vondst
      post_images: {
        Row: {
          id: string;
          post_id: string;
          image_path: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          image_path: string;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_images"]["Insert"]>;
        Relationships: [];
      };

      pending_invites: {
        Row: {
          id: string;
          inviter_user_id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inviter_user_id: string;
          email: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pending_invites"]["Insert"]>;
        Relationships: [];
      };

      // =============================================================
      // 0036_shared_lists / 0038_entity_comments / 0042_feed_finds
      // =============================================================

      shared_lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          emoji?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shared_lists"]["Insert"]>;
        Relationships: [];
      };

      list_items: {
        Row: {
          id: string;
          list_id: string;
          user_id: string;
          text: string;
          checked: boolean;
          checked_by: string | null;
          checked_at: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          user_id: string;
          text: string;
          checked?: boolean;
          checked_by?: string | null;
          checked_at?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["list_items"]["Insert"]>;
        Relationships: [];
      };

      list_members: {
        Row: {
          list_id: string;
          user_id: string;
        };
        Insert: {
          list_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["list_members"]["Insert"]>;
        Relationships: [];
      };

      entity_comments: {
        Row: {
          id: string;
          entity_type: CommentEntityType;
          entity_id: string;
          user_id: string;
          body: string;
          created_at: string;
          /** 0046_comment_media — gif of meme bij een reactie. */
          image_path: string | null;
        };
        Insert: {
          id?: string;
          entity_type: CommentEntityType;
          entity_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          image_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["entity_comments"]["Insert"]>;
        Relationships: [];
      };

      /**
       * Cache voor link-unfurls. Wordt gevuld door de `unfurl`-edge function,
       * niet door de app zelf — vandaar dat de app hem alleen leest.
       */
      link_previews: {
        Row: {
          url_hash: string;
          url: string;
          canonical_url: string | null;
          provider: string | null;
          kind: string;
          title: string | null;
          description: string | null;
          image_url: string | null;
          site_name: string | null;
          author: string | null;
          embed_url: string | null;
          duration_s: number | null;
          favicon_url: string | null;
          word_count: number | null;
          error: string | null;
          fetched_at: string;
        };
        Insert: {
          url_hash: string;
          url: string;
          canonical_url?: string | null;
          provider?: string | null;
          kind?: string;
          title?: string | null;
          description?: string | null;
          image_url?: string | null;
          site_name?: string | null;
          author?: string | null;
          embed_url?: string | null;
          duration_s?: number | null;
          favicon_url?: string | null;
          word_count?: number | null;
          error?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["link_previews"]["Insert"]>;
        Relationships: [];
      };
    };

    Views: {
      accepted_friends: {
        Row: {
          user_id: string;
          friend_id: string;
        };
        Relationships: [];
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
      /**
       * 0043_event_join_policy — geeft niet langer een kale event-id terug
       * maar ook wát er gebeurde: bij een gesloten event sta je nog niet
       * binnen, en dan is `status` gelijk aan `"pending"`.
       */
      join_event: {
        Args: { p_join_code: string };
        Returns: {
          event_id: string;
          status: "joined" | "pending" | "member";
        };
      };
      list_event_join_requests: {
        Args: { p_event_id: string };
        Returns: Array<{ user_id: string; created_at: string }>;
      };
      approve_event_join: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: void;
      };
      decline_event_join: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: void;
      };

      /**
       * 0041_event_improvements — de tellingen komen uit een SECURITY
       * DEFINER-functie zodat ze kloppen ook als bijdragen door RLS nog
       * verborgen zijn. `bigint` komt als number binnen over de wire.
       */
      list_my_events: {
        Args: Record<string, never>;
        Returns: EventMetaRow[];
      };
      get_event_meta: {
        Args: { p_event_id: string };
        Returns: EventMetaRow[];
      };

      /** 0027_rekey_rpc — voegt één ontvanger toe aan een bestaand bericht. */
      add_recipient_payload: {
        Args: {
          p_message_id: string;
          p_user_id: string;
          p_payload: Record<string, unknown>;
        };
        Returns: void;
      };
    };

    Enums: Record<string, never>;
  };
};
