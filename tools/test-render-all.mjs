// Smoke-тест для всех DOCX-шаблонов: рендерит каждый с тестовыми данными
// и проверяет что в результате нет `undefined` и leftover-плейсхолдеров.
// Запуск: node tools/test-render-all.mjs

import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// dot-notation parser (зеркало lib/render-docx.ts)
function dotNotationParser(tag) {
  return {
    get(scope) {
      if (tag === '.') return scope;
      const parts = tag.split('.');
      let value = scope;
      for (const key of parts) {
        if (value == null) return '';
        value = value[key];
      }
      return value ?? '';
    },
  };
}

// Общие данные (используются в большинстве шаблонов)
const COMMON = {
  contract: {
    number: 'ДТЮ-28/01/26-16',
    date: '28 января 2026 г.',
    place: 'г. Новороссийск',
    endDate: '31 декабря 2026 г.',
  },
  provider: {
    brand: 'ДЕЗТЕХЮГ',
    fullName: 'Индивидуальный предприниматель Белавина Ольга Владимировна',
    shortName: 'ИП Белавина О.В.',
    signatoryFullName: 'Белавина Ольга Владимировна',
    signatoryShort: 'О.В.Белавина',
    licenseNumber: '№23.КК.08.003.Л.000016.02.25',
    licenseDate: '13.02.2025',
    licenseAuthority:
      'Управлением Федеральной службы по надзору в сфере защиты прав потребителей и благополучия человека по Краснодарскому краю',
    ogrnip: '321237500467390',
    inn: '231507022304',
    legalAddress: '353915, Краснодарский край, г. Новороссийск, ул. Корницкого, д.155, ком. 1,2,3,4,5',
    bankName: 'Краснодарское отделение №8619 ПАО Сбербанк',
    bankAccount: '40802810330000166200',
    bankBik: '040349602',
    bankCorrAccount: '30101810100000000602',
    phone: '8-988-331-33-32',
    email: 'Adm_dty@mail.ru',
  },
  client: {
    shortName: 'ООО «Аппетит»',
    fullName: 'Общество с ограниченной ответственностью «Аппетит»',
    directorName: 'Мороз Анна Евгеньевна',
    directorRole: 'Генеральный директор',
    actingBasis: 'Устава',
    legalAddress: '354340, Краснодарский край, г. Сочи, ул. Гастелло, дом 28',
    postalAddress: '354000, Краснодарский край, г. Сочи, а/я 184',
    inn: '2320155529',
    kpp: '236701001',
    ogrn: '1072320016801',
    bankName: 'В ЮГО-ЗАПАДНОМ БАНКЕ ПАО СБЕРБАНК',
    bankAccount: '40702810030060009260',
    bankBik: '046015602',
    bankCorrAccount: '30101810600000000602',
    phone: '8-988-236-05-07',
    email: 'info@appetit.su',
  },
  // Прайс — массив для {#priceItems}
  priceItems: [
    {
      serviceName: 'Дезинсекция (уничтожение тараканов)',
      area: '530',
      method: 'Сухая / Точечное орошение / Туман',
      frequency: 'По заявке',
      priceNet: '5 714,29',
      priceGross: '6 000,00',
      // для счёта:
      index: '1',
      quantity: '1',
      unit: 'усл.',
      amount: '6 000,00',
    },
    {
      serviceName: 'Дератизация (пест-контроль)',
      area: '530',
      method: 'Сухая',
      frequency: 'По заявке',
      priceNet: '2 857,14',
      priceGross: '3 000,00',
      index: '2',
      quantity: '1',
      unit: 'усл.',
      amount: '3 000,00',
    },
  ],
  // Объекты — для актов
  objects: [
    {
      index: '1',
      name: 'Столовая СОК Анапа Нептун',
      address: 'г. Анапа, Пионерский проспект, д. 106',
      area: '1 026,8',
      service: 'Дератизация (уничтожение грызунов) пест-контроль',
    },
    {
      index: '2',
      name: 'Столовая СОК Анапа Нептун',
      address: 'г. Анапа, Пионерский проспект, д. 106',
      area: '1 026,8',
      service: 'Дезинсекция (уничтожение тараканов)',
    },
  ],
};

// Специфичные дополнения для разных шаблонов
const SPECIFIC = {
  contract: {},
  addendum: {
    addendum: {
      number: '4',
      date: '23 апреля 2026 г.',
      place: 'г. Новороссийск',
    },
  },
  inspection: {
    report: {
      number: '12',
      date: '15 апреля 2026 г.',
      objectStatus: 'удовлетворительное',
      deviations: 'не выявлено',
      description:
        'Объект — складское помещение и кухонный блок, общая площадь 530 м². Признаков заселения не обнаружено.',
      recommendation: 'Профилактическая обработка раз в квартал с последующим мониторингом.',
      infestationLevel: 'мало заселён',
      hasJournal: 'да',
      journalStatus: 'удовлетворительное',
    },
  },
  work: {
    act: {
      number: 'А-2026-014',
      date: '30 марта 2026 г.',
      qualityCheck: 'соответствует',
      areaCheck: 'совпадает',
      actualArea: '1 026,8',
      discrepancy: 'не выявлено',
      disinfector: 'Нечепоренко Д.И.',
      responsibleName: 'Сафронов Александр Витальевич',
      responsibleRole: 'Управляющий объектом',
      responsiblePhone: '8-904-492-54-63',
    },
  },
  offer: {
    offer: {
      number: 'КП-2026-007',
      date: '12 апреля 2026 г.',
      validUntil: '30 апреля 2026 г.',
      intro:
        'Предлагаем услуги санитарной обработки для вашего объекта по выгодным тарифам с гарантией результата.',
      totalNet: '8 571,43',
      totalGross: '9 000,00',
      totalInWords: 'Девять тысяч рублей 00 копеек',
    },
  },
  invoice: {
    invoice: {
      number: '152',
      date: '01.04.2026',
      dueDate: '08.04.2026',
      basis: 'Договор № ДТЮ-28/01/26-16 от 28.01.2026',
      totalNet: '8 571,43',
      vatAmount: '428,57',
      totalGross: '9 000,00',
      totalInWords: 'Девять тысяч рублей 00 копеек',
    },
  },
};

const TARGETS = [
  { name: 'contract', file: 'contract-services.docx' },
  { name: 'addendum', file: 'agreement-addendum.docx' },
  { name: 'inspection', file: 'inspection-report.docx' },
  { name: 'work', file: 'work-completion-report.docx' },
  { name: 'offer', file: 'commercial-offer.docx' },
  { name: 'invoice', file: 'invoice.docx' },
];

let allOk = true;

for (const t of TARGETS) {
  const tplPath = path.join('templates', t.file);
  const outPath = path.join('tmp', `rendered-${t.name}.docx`);

  if (!fs.existsSync(tplPath)) {
    console.log(`  [SKIP] ${t.name}: template not found at ${tplPath}`);
    allOk = false;
    continue;
  }

  const data = { ...COMMON, ...SPECIFIC[t.name] };

  const content = fs.readFileSync(tplPath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: dotNotationParser,
  });

  try {
    doc.render(data);
  } catch (err) {
    console.log(`  [FAIL] ${t.name}: ${err.message}`);
    if (err.properties?.errors) {
      for (const e of err.properties.errors) {
        console.log(`         - ${e.message} (tag: ${e.properties?.xtag})`);
      }
    }
    allOk = false;
    continue;
  }

  const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out);

  // Verify: extract plain text and check for issues
  const text = doc.getFullText();
  const undefinedCount = (text.match(/undefined/g) || []).length;
  const leftoverTags = text.match(/\{[^{}]+\}/g) || [];

  const issues = [];
  if (undefinedCount > 0) issues.push(`${undefinedCount}× undefined`);
  if (leftoverTags.length > 0) issues.push(`${leftoverTags.length} leftover tags: ${leftoverTags.slice(0, 3).join(', ')}`);

  if (issues.length > 0) {
    console.log(`  [WARN] ${t.name.padEnd(11)} -> ${outPath} (${out.length.toLocaleString()} bytes)  | ${issues.join('; ')}`);
    allOk = false;
  } else {
    console.log(`  [ OK ] ${t.name.padEnd(11)} -> ${outPath} (${out.length.toLocaleString()} bytes)`);
  }
}

console.log(allOk ? '\n✓ ALL TEMPLATES OK' : '\n✗ SOME TEMPLATES HAVE ISSUES');
process.exit(allOk ? 0 : 1);
