import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Простой parser для docxtemplater, поддерживающий dot-notation тегов:
 *   {client.shortName}, {provider.bankAccount} и т.д.
 *
 * docxtemplater 3.x по умолчанию dot-notation НЕ резолвит — без custom parser
 * получим undefined в ренде. Этот parser проходит по точкам и возвращает значение
 * либо пустую строку (чтобы не было «undefined» в готовом DOCX).
 */
function dotNotationParser(tag: string) {
  return {
    get(scope: unknown, _context: unknown) {
      if (tag === '.') return scope;
      const parts = tag.split('.');
      let value: unknown = scope;
      for (const key of parts) {
        if (value == null) return '';
        value = (value as Record<string, unknown>)[key];
      }
      return value ?? '';
    },
  };
}

export type RenderDocxOptions = {
  /** Бинарное содержимое DOCX-шаблона (Buffer или Uint8Array) */
  template: Buffer | Uint8Array;
  /** Данные для подстановки. Поддерживается dot-notation: {client.shortName} → data.client.shortName */
  data: Record<string, unknown>;
};

/**
 * Рендерит DOCX-шаблон с подстановкой данных через docxtemplater.
 * Возвращает Buffer готового документа.
 */
export function renderDocx({ template, data }: RenderDocxOptions): Buffer {
  const zip = new PizZip(template);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: dotNotationParser,
  });

  doc.render(data);

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}
