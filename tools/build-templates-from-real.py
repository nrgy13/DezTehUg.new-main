#!/usr/bin/env python3
"""
Сборка docxtemplater-шаблонов «точь-в-точь» из РЕАЛЬНЫХ доков ИП Белавина.

Идея: берём реальный .docx компании и хирургически заменяем конкретику на
{плейсхолдеры} build-data.ts, СОХРАНЯЯ форматирование, логотип, QR, подписи.
Это НЕ python-docx-генерация с нуля (её не повторить 1:1), а правка живого файла.

Источники (gitignored, лежат у Сани локально):
  DTUdocs/ — акты/ДС ИП Белавина
  DTU_docs_clients/Договора на заключение — копия/ — клиентские договоры
Выходы: templates/*.docx (активный seed читает их, см. lib/templates/get-template.ts).

ЗАПУСК:  python tools/build-templates-from-real.py ao   (ao|avr|dogovor|ds|all)
Зависимость: pip install python-docx. Валидация рендера: tools/render-test-template.js.

═══ КРИТИЧЕСКАЯ ГРАБЛЯ ═══
python-docx `run.text = ""` УДАЛЯЕТ ВСЁ содержимое run'а, включая <w:drawing>
(логотип/QR живут в run'ах!). Поэтому set_merge() ПРОПУСКАЕТ run'ы с картинками —
чистит только текстовые. Проверка: <a:blip> в выводе должно совпадать с исходником.

═══ ПЛЕЙСХОЛДЕРЫ (из build-data.ts) ═══
provider.* (ИП Белавина, фикс — можно статикой); client.shortName/fullName/
directorName/directorShort(инициалы)/directorRole/actingBasis/legalAddress/
postalAddress/inn/kpp/ogrn/phone/email/bankName/bankAccount/bankBik/bankCorrAccount;
contract.number/date/place/endDate; addendum.number/date/place;
act.number/date/disinfector/responsibleName/responsibleRole/responsiblePhone
(qualityCheck/areaCheck — НЕ используем в АВР: выбор руками, решение Сани);
report.date (АО: только дата + таблица; чекбоксы руками);
contact.fio/phone; object.name/address/area; totalNet/totalGross/vatAmount;
Циклы: {#objectServices}{index}{objectName}{objectAddress}{areaLabel}{serviceName}{/objectServices}
       {#priceItems}{objectName}{serviceName}{area}{priceGross}{vatLine}{frequency}{objectAddress}{/priceItems}
       {#priceItemsByObject}{objectName}{objectAddress}{#items}...{/items}{/priceItemsByObject}  (ДС, мульти-объект)
"""
import re
import sys
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn

ROOT = __import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__), '..'))


def has_drawing(run):
    return run._r.find(qn('w:drawing')) is not None or run._r.find(qn('w:pict')) is not None


def full_text(p):
    return "".join(r.text for r in p.runs if not has_drawing(r))


def set_merge(p, new_text):
    """Записать new_text в первый ТЕКСТОВЫЙ run, остальные текстовые очистить.
    Run'ы с картинками (drawing) НЕ трогаем — иначе теряем логотип/QR."""
    text_runs = [r for r in p.runs if not has_drawing(r)]
    if not text_runs:
        p.add_run(new_text)
        return
    text_runs[0].text = new_text
    for r in text_runs[1:]:
        r.text = ""


# ─────────────────────────────── АО (act_inspection) ✅ ГОТОВ ───────────────────────────────
def build_ao():
    src = f"{ROOT}/DTUdocs/Акт обледования шаблон ИП Белавина.docx"
    out = f"{ROOT}/templates/inspection-report.docx"
    doc = Document(src)
    # 1) Заголовок «АКТ-ОБСЛЕДОВАНИЯ от ___» → + {report.date}
    for p in doc.paragraphs:
        t = full_text(p)
        if "АКТ" in t and "ОБСЛЕДОВАНИ" in t:
            nt = re.sub(r"от\s*$", "от {report.date}", t.rstrip())
            if "{report.date}" not in nt:
                nt = nt + " {report.date}"
            set_merge(p, nt)
            break
    # 2) Строка контакта перед «Санитарное состояние» (после таблицы) — пожелание Сани
    for p in doc.paragraphs:
        if "Санитарное состояние" in full_text(p):
            newp = p.insert_paragraph_before("Контактное лицо на объекте: {contact.fio}, тел. {contact.phone}")
            for r in newp.runs:
                r.font.name = "Times New Roman"; r.font.size = Pt(12)
            break
    # 3) Таблица объектов (header + 4 пустых) → один цикл-ряд
    t = doc.tables[0]
    vals = ["{#objectServices}{index}", "{objectName}", "{objectAddress}", "{areaLabel}", "{serviceName}{/objectServices}"]
    for c, v in list(zip(t.rows[1].cells, vals)):
        set_merge(c.paragraphs[0], v)
        for extra in c.paragraphs[1:]:
            extra._p.getparent().remove(extra._p)
    for tr in [r._tr for r in t.rows[2:]]:
        tr.getparent().remove(tr)
    doc.save(out)
    print("OK ao ->", out)


# ─────────────────────────────── АВР (act_work) — TODO ───────────────────────────────
def build_avr():
    """Источник: DTUdocs/Акт по проведению работ ... Столовая СОК Анапа.docx → templates/work-completion-report.docx
    Замены: «№___ от <дата>»→«№{act.number} от {act.date} г.»; заказчик→{client.shortName}, ИНН→{client.inn};
      контакт ФИО/тел→{act.responsibleName}/{act.responsiblePhone}; «Дезинфектор: <фио>»→{act.disinfector};
      ссылка на договор «№<num> от <дата>»→«№{contract.number} от {contract.date}».
    «соответствует/не соответствует» и «совпадает/не совпадает» — ОСТАВИТЬ статикой (выбор руками, решение Сани).
    «Уполномоченное лицо» внизу — АВТО: {act.responsibleName}/{act.responsibleRole}/{act.responsiblePhone}.
    Таблица №|Объект|Адрес|Площадь|Услуга → цикл {#objectServices} (как в АО).
    ⚠️ ПРОВЕРИТЬ <a:blip> в выводе (логотип+QR)."""
    raise NotImplementedError("build_avr: см. tmp/plans/templates-plan.md и карту замен в плане")


# ─────────────────────────────── Договор (contract) — TODO ───────────────────────────────
def build_dogovor():
    """Источник: DTU_docs_clients/Договора на заключение — копия/Договор ООО АРУМ СЕРВИС от 01.01.2026.docx
       → templates/contract-services.docx
    Замены: номер/дата/место→{contract.number/date/place}; вводный абзац Заказчик→{client.fullName},
      «в лице {client.directorRole} {client.directorName}», «на основании {client.actingBasis}»; срок→{contract.endDate};
      блок реквизитов Заказчика (TABLE 0, правая ячейка)→{client.legalAddress/postalAddress/inn/kpp/ogrn/
      bankAccount/bankName/bankBik/bankCorrAccount/phone/email}; подписи (TABLE 1/3/6)→
      «{client.directorRole} {client.shortName} /{client.directorShort}/».
    Приложение №2 «СТОИМОСТЬ УСЛУГ» (прайс-таблица) → цикл {#priceItems}{objectName}|{serviceName}|{area}|
      {priceGross}|{frequency}|{objectAddress}{/priceItems}.
    СТАТИКА: юр.текст 1-8, Исполнитель (=CONTRACT_PROVIDER), Приложение №1 «ЗАЯВКА» (пустой бланк), TABLE 5 «Прочие услуги».
    ⚠️ Исполнитель совпадает с provider 1:1 — оставить статикой."""
    raise NotImplementedError("build_dogovor: см. план")


# ─────────────────────────────── ДС (addendum) — TODO, сложный ───────────────────────────────
def build_ds():
    """Источник: DTUdocs/ДС№2 ООО Аппетит.docx → templates/agreement-addendum.docx
    Замены: «№N»→{addendum.number}, «№<договор>»→{contract.number}, даты ДС/договора→{addendum.date}/{contract.date},
      место→{addendum.place}, Заказчик (преамбула + TABLE реквизитов)→{client.*}, подпись→{client.directorShort}.
    ⚠️ МУЛЬТИ-ОБЪЕКТ (решение Сани — вложенный цикл): несколько прайс-таблиц, у каждой свой объект+адрес заголовком.
      Использовать {#priceItemsByObject}: абзац-заголовок «{objectName} ({objectAddress})» + таблица с {#items}...{/items}.
      Колонка «НДС 5%» (рубли на строку) → {vatLine}. Колонки: Наименование→{serviceName}, Площадь→{area},
      без НДС→{priceNet}, НДС 5%→{vatLine}, с НДС→{priceGross}, Периодичность→{frequency}.
    NB: в build-data есть priceItemsByObject (группировка) + vatLine + directorShort (коммит 4b5f404)."""
    raise NotImplementedError("build_ds: см. план; мульти-объект через {#priceItemsByObject}")


BUILDERS = {"ao": build_ao, "avr": build_avr, "dogovor": build_dogovor, "ds": build_ds}

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "ao"
    targets = list(BUILDERS) if arg == "all" else [arg]
    for t in targets:
        if t not in BUILDERS:
            print("Неизвестная цель:", t, "— доступно:", list(BUILDERS)); sys.exit(1)
        BUILDERS[t]()
