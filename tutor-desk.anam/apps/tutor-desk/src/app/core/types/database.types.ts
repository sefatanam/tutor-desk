// @REVIEW: Auto-generated Supabase Database Types
// Generated: 2026-01-09
// Run `supabase_generate_typescript_types` via MCP to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      asset_comments: {
        Row: {
          asset_id: string
          content: string
          created_at: string
          id: string
          is_visible: boolean | null
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          content: string
          created_at?: string
          id?: string
          is_visible?: boolean | null
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          content?: string
          created_at?: string
          id?: string
          is_visible?: boolean | null
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          is_published: boolean | null
          mime_type: string | null
          sequence_number: number | null
          subject_id: string
          teacher_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          mime_type?: string | null
          sequence_number?: number | null
          subject_id: string
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          mime_type?: string | null
          sequence_number?: number | null
          subject_id?: string
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_submissions: {
        Row: {
          attempt_number: number
          auto_submit_reason: string | null
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          exam_id: string
          id: string
          percentage: number | null
          remarks: string | null
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          total_answered: number | null
          total_correct: number | null
          total_skipped: number | null
          total_wrong: number | null
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          auto_submit_reason?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          exam_id: string
          id?: string
          percentage?: number | null
          remarks?: string | null
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          total_answered?: number | null
          total_correct?: number | null
          total_skipped?: number | null
          total_wrong?: number | null
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          auto_submit_reason?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          exam_id?: string
          id?: string
          percentage?: number | null
          remarks?: string | null
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          total_answered?: number | null
          total_correct?: number | null
          total_skipped?: number | null
          total_wrong?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          allow_retake: boolean
          allow_skip_return: boolean
          auto_submit_on_blur: boolean
          average_score: number | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          fullscreen_required: boolean
          id: string
          instructions: string | null
          max_retakes: number | null
          passing_marks: number | null
          published_at: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["exam_status"]
          subject_id: string | null
          teacher_id: string
          time_per_question_seconds: number
          title: string
          total_marks: number
          total_questions: number
          total_submissions: number | null
          updated_at: string
        }
        Insert: {
          allow_retake?: boolean
          allow_skip_return?: boolean
          auto_submit_on_blur?: boolean
          average_score?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          fullscreen_required?: boolean
          id?: string
          instructions?: string | null
          max_retakes?: number | null
          passing_marks?: number | null
          published_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id?: string | null
          teacher_id: string
          time_per_question_seconds?: number
          title: string
          total_marks?: number
          total_questions?: number
          total_submissions?: number | null
          updated_at?: string
        }
        Update: {
          allow_retake?: boolean
          allow_skip_return?: boolean
          auto_submit_on_blur?: boolean
          average_score?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          fullscreen_required?: boolean
          id?: string
          instructions?: string | null
          max_retakes?: number | null
          passing_marks?: number | null
          published_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id?: string
          teacher_id?: string
          time_per_question_seconds?: number
          title?: string
          total_marks?: number
          total_questions?: number
          total_submissions?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_option_id: string
          created_at: string
          exam_id: string
          explanation: string | null
          id: string
          marks: number
          negative_marks: number | null
          options: Json
          question_image_url: string | null
          question_text: string
          sequence_number: number
          time_limit_seconds: number | null
          updated_at: string
        }
        Insert: {
          correct_option_id: string
          created_at?: string
          exam_id: string
          explanation?: string | null
          id?: string
          marks?: number
          negative_marks?: number | null
          options: Json
          question_image_url?: string | null
          question_text: string
          sequence_number: number
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Update: {
          correct_option_id?: string
          created_at?: string
          exam_id?: string
          explanation?: string | null
          id?: string
          marks?: number
          negative_marks?: number | null
          options?: Json
          question_image_url?: string | null
          question_text?: string
          sequence_number?: number
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          average_score: number | null
          class_name: string | null
          created_at: string
          date_of_birth: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          roll_number: string | null
          section: string | null
          teacher_id: string
          total_exams_taken: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          average_score?: number | null
          class_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          roll_number?: string | null
          section?: string | null
          teacher_id: string
          total_exams_taken?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          average_score?: number | null
          class_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          roll_number?: string | null
          section?: string | null
          teacher_id?: string
          total_exams_taken?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_enrollments: {
        Row: {
          enrolled_at: string
          enrolled_by: string | null
          id: string
          student_id: string
          subject_id: string
        }
        Insert: {
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          student_id: string
          subject_id: string
        }
        Update: {
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          code: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          teacher_id: string
          total_assets: number | null
          total_exams: number | null
          total_students: number | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          teacher_id: string
          total_assets?: number | null
          total_exams?: number | null
          total_students?: number | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          teacher_id?: string
          total_assets?: number | null
          total_exams?: number | null
          total_students?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      submission_answers: {
        Row: {
          answered_at: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          marks_obtained: number | null
          question_id: string
          returned_to: boolean | null
          selected_option_id: string | null
          sequence_answered: number | null
          submission_id: string
          time_remaining_seconds: number | null
          time_spent_seconds: number | null
          updated_at: string
          was_skipped: boolean | null
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          marks_obtained?: number | null
          question_id: string
          returned_to?: boolean | null
          selected_option_id?: string | null
          sequence_answered?: number | null
          submission_id: string
          time_remaining_seconds?: number | null
          time_spent_seconds?: number | null
          updated_at?: string
          was_skipped?: boolean | null
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          marks_obtained?: number | null
          question_id?: string
          returned_to?: boolean | null
          selected_option_id?: string | null
          sequence_answered?: number | null
          submission_id?: string
          time_remaining_seconds?: number | null
          time_spent_seconds?: number | null
          updated_at?: string
          was_skipped?: boolean | null
        }
        Relationships: []
      }
      teachers: {
        Row: {
          allow_student_comments: boolean | null
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          created_at: string
          id: string
          qualification: string | null
          show_exam_results_immediately: boolean | null
          specialization: string | null
          total_exams: number | null
          total_students: number | null
          total_subjects: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_student_comments?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          qualification?: string | null
          show_exam_results_immediately?: boolean | null
          specialization?: string | null
          total_exams?: number | null
          total_students?: number | null
          total_subjects?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_student_comments?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          qualification?: string | null
          show_exam_results_immediately?: boolean | null
          specialization?: string | null
          total_exams?: number | null
          total_students?: number | null
          total_subjects?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_provider: string | null
          auth_provider_id: string | null
          avatar_url: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          password_hash: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          auth_provider?: string | null
          auth_provider_id?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          last_login_at?: string | null
          password_hash?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          auth_provider?: string | null
          auth_provider_id?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      // @REVIEW: New tables for flexible exam assignments
      exam_assignments: {
        Row: {
          id: string
          exam_id: string
          student_id: string
          assigned_by: string
          assigned_at: string
          available_from: string | null
          due_date: string | null
          status: Database["public"]["Enums"]["exam_assignment_status"]
          started_at: string | null
          completed_at: string | null
          max_attempts: number | null
          time_limit_minutes: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_id: string
          student_id: string
          assigned_by: string
          assigned_at?: string
          available_from?: string | null
          due_date?: string | null
          status?: Database["public"]["Enums"]["exam_assignment_status"]
          started_at?: string | null
          completed_at?: string | null
          max_attempts?: number | null
          time_limit_minutes?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_id?: string
          student_id?: string
          assigned_by?: string
          assigned_at?: string
          available_from?: string | null
          due_date?: string | null
          status?: Database["public"]["Enums"]["exam_assignment_status"]
          started_at?: string | null
          completed_at?: string | null
          max_attempts?: number | null
          time_limit_minutes?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_subject_assignments: {
        Row: {
          id: string
          exam_id: string
          subject_id: string
          assigned_by: string
          assigned_at: string
          available_from: string | null
          due_date: string | null
          auto_assign_students: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_id: string
          subject_id: string
          assigned_by: string
          assigned_at?: string
          available_from?: string | null
          due_date?: string | null
          auto_assign_students?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_id?: string
          subject_id?: string
          assigned_by?: string
          assigned_at?: string
          available_from?: string | null
          due_date?: string | null
          auto_assign_students?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      student_dashboard_stats: {
        Row: {
          average_score: number | null
          enrolled_subjects: number | null
          pending_exams: number | null
          student_id: string | null
          total_exams_taken: number | null
          user_id: string | null
        }
        Relationships: []
      }
      teacher_dashboard_stats: {
        Row: {
          active_exams: number | null
          average_student_score: number | null
          teacher_id: string | null
          total_exams: number | null
          total_students: number | null
          total_subjects: number | null
          total_submissions: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      evaluate_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      get_student_id: { Args: Record<string, never>; Returns: string }
      get_teacher_id: { Args: Record<string, never>; Returns: string }
      get_user_role: {
        Args: Record<string, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_super_admin: { Args: Record<string, never>; Returns: boolean }
      is_teacher: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      asset_type: "document" | "image" | "video" | "link" | "other"
      exam_assignment_status: "assigned" | "started" | "completed" | "expired" | "cancelled"
      exam_status: "draft" | "scheduled" | "active" | "completed" | "cancelled"
      submission_status:
        | "in_progress"
        | "submitted"
        | "auto_submitted"
        | "evaluated"
        | "retake_allowed"
      user_role: "super_admin" | "teacher" | "student"
      user_status: "pending" | "active" | "disabled" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]

// Shorthand types
export type User = Tables<"users">
export type UserInsert = TablesInsert<"users">
export type UserUpdate = TablesUpdate<"users">

export type Teacher = Tables<"teachers">
export type TeacherInsert = TablesInsert<"teachers">
export type TeacherUpdate = TablesUpdate<"teachers">

export type Student = Tables<"students">
export type StudentInsert = TablesInsert<"students">
export type StudentUpdate = TablesUpdate<"students">

export type Subject = Tables<"subjects">
export type SubjectInsert = TablesInsert<"subjects">
export type SubjectUpdate = TablesUpdate<"subjects">

export type Exam = Tables<"exams">
export type ExamInsert = TablesInsert<"exams">
export type ExamUpdate = TablesUpdate<"exams">

export type Question = Tables<"questions">
export type QuestionInsert = TablesInsert<"questions">
export type QuestionUpdate = TablesUpdate<"questions">

export type ExamSubmission = Tables<"exam_submissions">
export type SubmissionAnswer = Tables<"submission_answers">
export type Asset = Tables<"assets">
export type AssetComment = Tables<"asset_comments">
export type SubjectEnrollment = Tables<"subject_enrollments">

// @REVIEW: New table types for flexible exam assignments
export type ExamAssignment = Tables<"exam_assignments">
export type ExamAssignmentInsert = TablesInsert<"exam_assignments">
export type ExamAssignmentUpdate = TablesUpdate<"exam_assignments">

export type ExamSubjectAssignment = Tables<"exam_subject_assignments">
export type ExamSubjectAssignmentInsert = TablesInsert<"exam_subject_assignments">
export type ExamSubjectAssignmentUpdate = TablesUpdate<"exam_subject_assignments">

// Enum types
export type UserRole = Enums<"user_role">
export type UserStatus = Enums<"user_status">
export type ExamStatus = Enums<"exam_status">
export type ExamAssignmentStatus = Enums<"exam_assignment_status">
export type SubmissionStatus = Enums<"submission_status">
export type AssetType = Enums<"asset_type">

// View types
export type TeacherDashboardStats = Views<"teacher_dashboard_stats">
export type StudentDashboardStats = Views<"student_dashboard_stats">
