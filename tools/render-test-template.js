// Валидатор docxtemplater-шаблона: рендерит с тестовыми данными тем же парсером,
// что и приложение (lib/render-docx.ts — dot-notation), и сообщает об ошибках/
// остаточных тегах. Картинки (логотип/QR) проверяй отдельно по <a:blip>.
//
// ЗАПУСК: node tools/render-test-template.js templates/<file>.docx [out.docx]
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Тот же парсер, что в lib/render-docx.ts (docxtemplater 3.x сам точки не резолвит).
function dotNotationParser(tag) {
  return {
    get(scope) {
      if (tag === '.') return scope;
      let v = scope;
      for (const k of tag.split('.')) { if (v == null) return ''; v = v[k]; }
      return v == null ? '' : v;
    },
  };
}

// Репрезентативные данные, повторяющие форму build-data.ts (для всех 4 типов).
const data = {
  provider: { shortName: 'ИП Белавина О.В.', inn: '231507022304', ogrnip: '321237500467390', licenseNumber: '№23.КК.08.003.Л.000016.02.25', licenseDate: '13.02.2025', signatoryShort: 'О.В.Белавина', signatoryFullName: 'Белавина Ольга Владимировна' },
  client: { shortName: 'ООО «Тест»', fullName: 'Общество с ограниченной ответственностью «Тест»', directorName: 'Иванов Иван Иванович', directorShort: 'И.И.Иванов', directorRole: 'Генеральный директор', actingBasis: 'Устава', legalAddress: 'г. Тест, ул. Тестовая, 1', postalAddress: 'г. Тест, а/я 1', inn: '1234567890', kpp: '123401001', ogrn: '1234567890123', phone: '8-900-000-00-00', email: 'test@test.ru', bankName: 'ПАО Сбербанк', bankAccount: '40702810000000000000', bankBik: '040000000', bankCorrAccount: '30101810000000000000' },
  contract: { number: 'ДТЮ-01/01/26-1', date: '1 января 2026 г.', place: 'г. Новороссийск', endDate: '31 декабря 2026 г.' },
  addendum: { number: 2, date: '27 марта 2026 г.', place: 'г. Новороссийск' },
  act: { number: 'АР-2026-001', date: '7 апреля 2026 г.', disinfector: 'Денисов Ю.Л.', responsibleName: 'Сидоров С.С.', responsibleRole: 'Управляющий', responsiblePhone: '8-900-111-22-33', qualityCheck: 'соответствует', areaCheck: 'совпадает', actualArea: '538,42' },
  report: { date: '1 января 2026 г.', objectStatus: 'удовлетворительное', infestationLevel: 'не заселён', hasJournal: 'да', journalStatus: 'удовлетворительное', deviations: '', description: '', recommendation: '' },
  object: { name: 'Столовая', address: 'г. Тест, ул. Тестовая, 1', area: '100' },
  contact: { fio: 'Сидорова Ольга Андреевна', phone: '+7 (988) 123-45-67' },
  master: { fio: 'Денисов Ю.Л.' },
  objectServices: [
    { index: 1, objectName: 'Общежитие №2', objectAddress: 'г. Тест, ул. Тестовая, 1', areaLabel: '715,5 м²', serviceName: 'Дезинсекция', method: 'Туман', quantity: '715,5' },
    { index: 2, objectName: 'Столовая', objectAddress: 'г. Тест, ул. Тестовая, 1', areaLabel: '368,3 м²', serviceName: 'Дератизация', method: 'Точечно', quantity: '368,3' },
  ],
  priceItems: [
    { index: 1, objectName: 'Столовая', objectAddress: 'г. Тест, ул. Тестовая, 1', serviceName: 'Дезинсекция', area: '100', areaUnitLabel: 'м²', method: '', frequency: 'Ежемесячно', priceNet: '4 761,90', priceGross: '5 000,00', vatLine: '238,10', vatRate: 5, amount: '5 000,00' },
  ],
  priceItemsByObject: [
    { objectName: 'Столовая', objectAddress: 'г. Тест, ул. Тестовая, 1', items: [
      { index: 1, serviceName: 'Дезинсекция', area: '100', priceNet: '4 761,90', vatLine: '238,10', priceGross: '5 000,00', frequency: 'Ежемесячно' },
    ] },
  ],
  totalNet: '4 761,90', totalGross: '5 000,00', vatAmount: '238,10', services: 'Дезинсекция — 100 м²',
};

const tpl = process.argv[2] || 'templates/inspection-report.docx';
const outFile = process.argv[3] || 'tmp/_render-test-out.docx';
try {
  const zip = new PizZip(fs.readFileSync(tpl));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, parser: dotNotationParser });
  doc.render(data);
  const out = doc.getZip().generate({ type: 'nodebuffer' });
  fs.writeFileSync(outFile, out);
  const xml = new PizZip(out).file('word/document.xml').asText();
  const text = xml.replace(/<[^>]+>/g, '');
  const blips = (xml.match(/<a:blip/g) || []).length;
  const leftover = text.match(/\{[^{}]*\}/g) || [];
  console.log(`Шаблон: ${tpl}`);
  console.log(`Рендер OK -> ${outFile}`);
  console.log(`Картинок (<a:blip>): ${blips}`);
  console.log(leftover.length ? `⚠️ Остаточные теги: ${leftover.join(', ')}` : '✓ Остаточных тегов нет');
} catch (e) {
  console.log('RENDER ERROR:', e.message);
  if (e.properties && e.properties.errors) for (const x of e.properties.errors) console.log('  -', (x.properties && x.properties.explanation) || x.message);
  process.exit(1);
}
