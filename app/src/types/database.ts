// Hand-written to match docs/05-schema.sql (source of truth).
// Once a real Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// and reconcile any drift against docs/05-schema.sql.

export type DietType = 'veg' | 'egg' | 'nonveg';
export type Allergen = 'peanut' | 'dairy' | 'gluten' | 'shellfish' | 'soy';
export type CookLanguage = 'hi' | 'kn' | 'en';
export type FlatRole = 'admin' | 'member';
export type PollStatus = 'open' | 'closed' | 'cancelled' | 'dispatched';
export type WinnerReason = 'votes' | 'tiebreak_lru' | 'auto_no_votes';
export type IngredientUnit = 'piece' | 'g' | 'ml' | 'bunch' | 'packet' | 'cup' | 'tbsp' | 'tsp';
export type IngredientCategory = 'vegetable' | 'dairy' | 'staple' | 'protein' | 'other';
export type DispatchMode = 'mock' | 'live';
export type DispatchStatus = 'queued' | 'mocked' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          diet_type: DietType;
          is_jain: boolean;
          allergies: Allergen[];
          push_token: string | null;
          notifications_muted: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      flats: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          poll_open_time: string;
          poll_close_time: string;
          dispatch_time: string;
          tz: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['flats']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['flats']['Row']>;
      };
      flat_members: {
        Row: {
          flat_id: string;
          user_id: string;
          role: FlatRole;
          joined_at: string;
        };
        Insert: Partial<Database['public']['Tables']['flat_members']['Row']> & {
          flat_id: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['flat_members']['Row']>;
      };
      cooks: {
        Row: {
          id: string;
          flat_id: string;
          name: string;
          phone: string;
          language: CookLanguage;
          is_active: boolean;
          audit_note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cooks']['Row']> & {
          flat_id: string;
          name: string;
          phone: string;
        };
        Update: Partial<Database['public']['Tables']['cooks']['Row']>;
      };
      recipes: {
        Row: {
          id: string;
          slug: string;
          name: string;
          cuisine: string;
          base: string;
          diet_class: DietType;
          jain_ok: boolean;
          allergens: Allergen[];
          seasons: string[];
          instructions_en: string;
          image_path: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['recipes']['Row']> & {
          slug: string;
          name: string;
          cuisine: string;
          base: string;
          diet_class: DietType;
          instructions_en: string;
        };
        Update: Partial<Database['public']['Tables']['recipes']['Row']>;
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          name_en: string;
          name_hi: string | null;
          name_kn: string | null;
          qty_per_person: number;
          unit: IngredientUnit;
          category: IngredientCategory;
          is_staple: boolean;
          sort_order: number;
        };
        Insert: Partial<Database['public']['Tables']['recipe_ingredients']['Row']> & {
          recipe_id: string;
          name_en: string;
          qty_per_person: number;
          unit: IngredientUnit;
          category: IngredientCategory;
        };
        Update: Partial<Database['public']['Tables']['recipe_ingredients']['Row']>;
      };
      recipe_translations: {
        Row: {
          recipe_id: string;
          language: Extract<CookLanguage, 'hi' | 'kn'>;
          instructions: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['recipe_translations']['Row']> & {
          recipe_id: string;
          language: Extract<CookLanguage, 'hi' | 'kn'>;
          instructions: string;
        };
        Update: Partial<Database['public']['Tables']['recipe_translations']['Row']>;
      };
      daily_polls: {
        Row: {
          id: string;
          flat_id: string;
          poll_date: string;
          status: PollStatus;
          winner_recipe_id: string | null;
          winner_reason: WinnerReason | null;
          flat_note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['daily_polls']['Row']> & {
          flat_id: string;
          poll_date: string;
        };
        Update: Partial<Database['public']['Tables']['daily_polls']['Row']>;
      };
      poll_options: {
        Row: {
          poll_id: string;
          recipe_id: string;
          position: 1 | 2 | 3;
        };
        Insert: Database['public']['Tables']['poll_options']['Row'];
        Update: Partial<Database['public']['Tables']['poll_options']['Row']>;
      };
      votes: {
        Row: {
          poll_id: string;
          user_id: string;
          recipe_id: string;
          voted_at: string;
        };
        Insert: Partial<Database['public']['Tables']['votes']['Row']> & {
          poll_id: string;
          user_id: string;
          recipe_id: string;
        };
        Update: Partial<Database['public']['Tables']['votes']['Row']>;
      };
      day_attendance: {
        Row: {
          flat_id: string;
          user_id: string;
          poll_date: string;
          is_out: boolean;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['day_attendance']['Row']> & {
          flat_id: string;
          user_id: string;
          poll_date: string;
        };
        Update: Partial<Database['public']['Tables']['day_attendance']['Row']>;
      };
      grocery_checks: {
        Row: {
          poll_id: string;
          ingredient_id: string;
          checked_by: string | null;
          checked_at: string;
        };
        Insert: Partial<Database['public']['Tables']['grocery_checks']['Row']> & {
          poll_id: string;
          ingredient_id: string;
        };
        Update: Partial<Database['public']['Tables']['grocery_checks']['Row']>;
      };
      dispatch_log: {
        Row: {
          id: string;
          poll_id: string;
          mode: DispatchMode;
          language: string;
          headcount: number;
          payload_en: string;
          payload_translated: string;
          bsp_message_id: string | null;
          status: DispatchStatus;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['dispatch_log']['Row']> & {
          poll_id: string;
          mode: DispatchMode;
          language: string;
          headcount: number;
          payload_en: string;
          payload_translated: string;
        };
        Update: Partial<Database['public']['Tables']['dispatch_log']['Row']>;
      };
      meal_feedback: {
        Row: {
          poll_id: string;
          user_id: string;
          thumbs_up: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['meal_feedback']['Row']> & {
          poll_id: string;
          user_id: string;
          thumbs_up: boolean;
        };
        Update: Partial<Database['public']['Tables']['meal_feedback']['Row']>;
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          flat_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['feedback']['Row']> & { body: string };
        Update: Partial<Database['public']['Tables']['feedback']['Row']>;
      };
      pipeline_errors: {
        Row: {
          id: string;
          stage: 'create_poll' | 'close_poll' | 'dispatch_cook' | 'wa_webhook';
          flat_id: string | null;
          detail: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['pipeline_errors']['Row']> & {
          stage: 'create_poll' | 'close_poll' | 'dispatch_cook' | 'wa_webhook';
          detail: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['pipeline_errors']['Row']>;
      };
    };
  };
}
