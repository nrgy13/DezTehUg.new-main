// Sprint 9 — справочники для прайс-позиций: способ обработки и периодичность.
// Способ — строго из списка (расширенный набор). Периодичность — список + «Своё…».

export const TREATMENT_METHODS = [
  'Сухая обработка',
  'Влажная обработка',
  'Точечное орошение',
  'Туман (ГХО/аэрозоль)',
  'Барьерная защита',
  'Приманка/гель',
  'Опрыскивание',
] as const;

export const TREATMENT_FREQUENCIES = [
  'Разово',
  'Ежемесячно',
  'Раз в 2 месяца',
  'Ежеквартально',
  'Раз в полгода',
  'Ежегодно',
  'По заявке',
] as const;

export type TreatmentMethod = (typeof TREATMENT_METHODS)[number];
export type TreatmentFrequency = (typeof TREATMENT_FREQUENCIES)[number];
