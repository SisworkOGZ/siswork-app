import { supabase } from "@/core/services/supabase";
import type { Session } from "@supabase/supabase-js";

export interface StudentRegistrationData {
  nisn: string;
}

export async function saveStudentRegistration(
  userId: string,
  session: Session,
  registration: StudentRegistrationData,
) {
  const { data: authData, error: sessionError } =
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  if (sessionError) {
    throw new Error(
      `Gagal memulihkan sesi registrasi: ${sessionError.message}`,
    );
  }
  if (!authData.user || authData.user.id !== userId) {
    throw new Error("Sesi login tidak cocok dengan akun yang didaftarkan.");
  }

  const { error } = await supabase.rpc("complete_student_registration", {
    p_nisn: registration.nisn,
  });
  if (error) {
    throw new Error(`Gagal menyelesaikan registrasi siswa: ${error.message}`);
  }
}
