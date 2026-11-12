export type ProPreferences = { region: string; models: string; budget: number; minMargin: number };
export type DealDecision = "review" | "visit" | "call" | "skip";
export type ProDeal = {
  id: string; title: string; url: string; purchase: number; resale: number; repair: number;
  logistics: number; reserve: number; defects: string; notes: string; checklist: string[];
  decision: DealDecision; revision: number; updatedAt: number;
};
export type ProEvent = { id: string; dealId: string | null; type: string; message: string; createdAt: number };
export type ProAccess = { email: string; expiresAt: number };
export type ProState = {
  admin: boolean; email: string; expiresAt: number | null; telegramReady: boolean;
  preferences: ProPreferences; deals: ProDeal[]; events: ProEvent[]; access: ProAccess[];
};
export const CHECKLIST = ["История ремонта", "Дисплей и True Tone", "Face ID / Touch ID", "Аккумулятор", "Камеры и звук", "Зарядка и связь", "Следы влаги", "Плата и корпус", "Выход из аккаунта и блокировки", "Комплект и документы"];
export function dealMargin(d: Pick<ProDeal, "purchase" | "resale" | "repair" | "logistics" | "reserve">) {
  return d.resale - d.purchase - d.repair - d.logistics - d.reserve;
}
export function sellerQuestions(d: Pick<ProDeal, "defects">) {
  return ["Какие детали менялись и был ли ремонт платы?", "Есть ли следы влаги, падений или скрытые неисправности?", "Какое состояние аккумулятора, работают ли Face ID / Touch ID и True Tone?", "Можно ли проверить телефон и выйти из аккаунта перед покупкой?", ...(d.defects.trim() ? ["Уточните, пожалуйста, дефекты: " + d.defects.trim()] : []), "Какая комплектация и уместен ли торг после осмотра?"];
}
export const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
