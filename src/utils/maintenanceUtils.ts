import { supabase } from '../lib/supabase';
import { Equipment, PreventiveMaintenance } from '../types';
import { addDays, isBefore, startOfDay } from 'date-fns';

/**
 * Checks all equipments and generates preventive maintenance records if they are due.
 * A maintenance is due if (last_completed_date + interval) <= today.
 */
export async function checkAndGeneratePreventives() {
  try {
    // 1. Fetch all equipments
    const { data: equipments, error: eqError } = await supabase
      .from('equipments')
      .select('*');

    if (eqError) throw eqError;
    if (!equipments) return;

    const today = startOfDay(new Date());
    const results = [];

    for (const equipment of equipments) {
      // 2. Check if there's already a pending or in-progress preventive for this equipment
      const { data: existing, error: existError } = await supabase
        .from('preventive_maintenances')
        .select('id')
        .eq('equipment_id', equipment.id)
        .in('status', ['pending', 'in_progress'])
        .limit(1);

      if (existError) continue;
      if (existing && existing.length > 0) continue; // Already has an active preventive

      // 3. Find the last completed preventive
      const { data: lastCompleted, error: lastError } = await supabase
        .from('preventive_maintenances')
        .select('finished_at, created_at')
        .eq('equipment_id', equipment.id)
        .eq('status', 'completed')
        .order('finished_at', { ascending: false })
        .limit(1);

      let lastDate: Date;
      if (lastCompleted && lastCompleted.length > 0 && lastCompleted[0].finished_at) {
        lastDate = new Date(lastCompleted[0].finished_at);
      } else {
        // Fallback to equipment creation date if no maintenance has been done yet
        lastDate = new Date(equipment.created_at);
      }

      // 4. Calculate next due date
      const nextDueDate = addDays(lastDate, equipment.preventive_interval_days);

      // 5. If due, generate new preventive
      if (isBefore(nextDueDate, today) || nextDueDate.getTime() === today.getTime()) {
        const { data: newPrev, error: createError } = await supabase
          .from('preventive_maintenances')
          .insert({
            equipment_id: equipment.id,
            status: 'pending',
            created_at: new Date().toISOString(),
            version: 1
          })
          .select()
          .single();

        if (!createError && newPrev) {
          results.push({ equipment: equipment.name, status: 'generated' });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error in checkAndGeneratePreventives:', error);
    throw error;
  }
}

/**
 * Gets the maintenance schedule for the next 30 days.
 */
export async function getMaintenanceSchedule() {
  const { data: equipments } = await supabase.from('equipments').select('*');
  if (!equipments) return [];

  const schedule = [];
  const today = new Date();

  for (const eq of equipments) {
    const { data: last } = await supabase
      .from('preventive_maintenances')
      .select('finished_at, created_at')
      .eq('equipment_id', eq.id)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1);

    const baseDate = (last && last.length > 0 && last[0].finished_at) 
      ? new Date(last[0].finished_at) 
      : new Date(eq.created_at);

    const nextDate = addDays(baseDate, eq.preventive_interval_days);
    
    schedule.push({
      equipmentId: eq.id,
      equipmentName: eq.name,
      lastDate: baseDate,
      nextDate: nextDate,
      daysRemaining: Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      interval: eq.preventive_interval_days
    });
  }

  return schedule.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}
