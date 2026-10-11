export interface EventTypeTranslation { locale: string; name: string; description?: string }
export interface EventTypeDefinition {
  code: string; defaultLocale: string; hostRoles: string[]; enabledSections: string[];
  requiredFieldsForPublish: string[]; compatibleTemplateTags: string[]; translations: EventTypeTranslation[];
}
export function translateEventType(type: EventTypeDefinition, locale: string): EventTypeTranslation {
  return type.translations.find((item) => item.locale === locale)
    ?? type.translations.find((item) => item.locale === type.defaultLocale)
    ?? { locale: type.defaultLocale, name: type.code };
}
export const eventTypeSeeds: EventTypeDefinition[] = [
  { code: 'WEDDING', defaultLocale: 'es-BO', hostRoles: ['BRIDE', 'GROOM'], enabledSections: ['story', 'schedule', 'gifts'], requiredFieldsForPublish: ['title', 'eventDate', 'venueName'], compatibleTemplateTags: ['wedding'], translations: [{ locale: 'es-BO', name: 'Boda' }, { locale: 'en-US', name: 'Wedding' }] },
  { code: 'QUINCEANERA', defaultLocale: 'es-BO', hostRoles: ['CELEBRANT'], enabledSections: ['story', 'schedule', 'gifts'], requiredFieldsForPublish: ['title', 'eventDate', 'celebrantName'], compatibleTemplateTags: ['quinceanera'], translations: [{ locale: 'es-BO', name: 'Quinceaños' }, { locale: 'en-US', name: 'Fifteenth birthday' }] },
  { code: 'BAUTIZO', defaultLocale: 'es-BO', hostRoles: ['PARENT'], enabledSections: ['story', 'schedule'], requiredFieldsForPublish: ['title', 'eventDate', 'childName'], compatibleTemplateTags: ['baptism'], translations: [{ locale: 'es-BO', name: 'Bautizo' }, { locale: 'en-US', name: 'Baptism' }] }
];
