import { supabase } from '../lib/supabase';

export async function createNotification(userId: string, title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', link?: string) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link,
      read: false
    });
    return { error };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { error };
  }
}

export async function notifyAdmins(title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', link?: string) {
  try {
    // Fetch all admins
    const { data: admins, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (fetchError) throw fetchError;
    if (!admins || admins.length === 0) return { error: null };

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message,
      type,
      link,
      read: false
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    return { error };
  } catch (error) {
    console.error('Error notifying admins:', error);
    return { error };
  }
}
