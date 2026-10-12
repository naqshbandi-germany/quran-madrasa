import { prisma } from "@/lib/prisma";

export type Capacity = {
  // null = unbegrenzt
  max: number | null;
  taken: number;
  // null = unbegrenzt
  free: number | null;
  isFull: boolean;
};

export function capacityOf(max: number | null, taken: number): Capacity {
  if (max == null) return { max: null, taken, free: null, isFull: false };
  return { max, taken, free: Math.max(0, max - taken), isFull: taken >= max };
}

// Belegte Plaetze = eingeschriebene Teilnehmer (Personen) des Kurses.
export async function getCourseCapacity(courseId: string, max: number | null): Promise<Capacity> {
  const taken = await prisma.enrollment.count({ where: { courseId } });
  return capacityOf(max, taken);
}
