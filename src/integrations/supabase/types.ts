export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analysis_of_results_students: {
        Row: {
          created_at: string
          id: string
          marks: (number | null)[]
          row_number: number
          row_percentage: number
          row_total: number
          student_name: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marks: (number | null)[]
          row_number: number
          row_percentage?: number
          row_total?: number
          student_name: string
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marks?: (number | null)[]
          row_number?: number
          row_percentage?: number
          row_total?: number
          student_name?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_of_results_students_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "moderation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      moderation_scores: {
        Row: {
          comment: string | null
          id: string
          item_key: string
          item_label: string
          max_score: number
          score: number
          sort_order: number
          submission_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          item_key: string
          item_label: string
          max_score?: number
          score?: number
          sort_order?: number
          submission_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          item_key?: string
          item_label?: string
          max_score?: number
          score?: number
          sort_order?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "moderation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_submissions: {
        Row: {
          academic_year: number
          class_name: string | null
          created_at: string
          created_by: string
          cycle: number
          general_comments: string | null
          grade_id: string | null
          head_of_subject_id: string | null
          id: string
          max_score: number
          moderation_date: string
          moderation_type: Database["public"]["Enums"]["moderation_type"]
          percentage: number
          quarter: number
          question_max_marks: (number | null)[] | null
          recommendations: string | null
          status: Database["public"]["Enums"]["submission_status"]
          subject_id: string | null
          submitted_at: string | null
          teacher_id: string
          total_score: number
          type_of_assessment: string | null
          type_of_moderation: string | null
          updated_at: string
          weeks: string
        }
        Insert: {
          academic_year: number
          class_name?: string | null
          created_at?: string
          created_by: string
          cycle: number
          general_comments?: string | null
          grade_id?: string | null
          head_of_subject_id?: string | null
          id?: string
          max_score?: number
          moderation_date: string
          moderation_type: Database["public"]["Enums"]["moderation_type"]
          percentage?: number
          quarter: number
          question_max_marks?: (number | null)[] | null
          recommendations?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          subject_id?: string | null
          submitted_at?: string | null
          teacher_id: string
          total_score?: number
          type_of_assessment?: string | null
          type_of_moderation?: string | null
          updated_at?: string
          weeks: string
        }
        Update: {
          academic_year?: number
          class_name?: string | null
          created_at?: string
          created_by?: string
          cycle?: number
          general_comments?: string | null
          grade_id?: string | null
          head_of_subject_id?: string | null
          id?: string
          max_score?: number
          moderation_date?: string
          moderation_type?: Database["public"]["Enums"]["moderation_type"]
          percentage?: number
          quarter?: number
          question_max_marks?: (number | null)[] | null
          recommendations?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          subject_id?: string | null
          submitted_at?: string | null
          teacher_id?: string
          total_score?: number
          type_of_assessment?: string | null
          type_of_moderation?: string | null
          updated_at?: string
          weeks?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_submissions_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_submissions_head_of_subject_id_fkey"
            columns: ["head_of_subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_submissions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_submissions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          initials: string | null
          is_approved: boolean
          preferred_language: string
          surname: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          initials?: string | null
          is_approved?: boolean
          preferred_language?: string
          surname?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          initials?: string | null
          is_approved?: boolean
          preferred_language?: string
          surname?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          grade_id: string | null
          id: string
          phase: string
          subject_id: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          grade_id?: string | null
          id?: string
          phase: string
          subject_id?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          grade_id?: string | null
          id?: string
          phase?: string
          subject_id?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_improvement_items: {
        Row: {
          challenge: string
          created_at: string
          id: string
          learner_groups: string[]
          performance_indicator: string
          sort_order: number
          strategy: string
          submission_id: string
          timeframe: string
        }
        Insert: {
          challenge: string
          created_at?: string
          id?: string
          learner_groups?: string[]
          performance_indicator: string
          sort_order: number
          strategy: string
          submission_id: string
          timeframe: string
        }
        Update: {
          challenge?: string
          created_at?: string
          id?: string
          learner_groups?: string[]
          performance_indicator?: string
          sort_order?: number
          strategy?: string
          submission_id?: string
          timeframe?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_improvement_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "moderation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          department_id: string | null
          id: string
          name: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          name: string
        }
        Update: {
          department_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          grade_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          subject_id: string | null
          user_id: string
        }
        Insert: {
          grade_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          subject_id?: string | null
          user_id: string
        }
        Update: {
          grade_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          subject_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_principal: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "administrator"
        | "principal"
        | "hod"
        | "head_of_subject"
        | "teacher"
      moderation_type:
        | "pre_moderation"
        | "post_moderation"
        | "book_control"
        | "analysis_of_results"
        | "subject_improvement_plan"
      submission_status: "draft" | "submitted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "administrator",
        "principal",
        "hod",
        "head_of_subject",
        "teacher",
      ],
      moderation_type: [
        "pre_moderation",
        "post_moderation",
        "book_control",
        "analysis_of_results",
        "subject_improvement_plan",
      ],
      submission_status: ["draft", "submitted"],
    },
  },
} as const
