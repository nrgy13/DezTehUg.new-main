#!/usr/bin/env python3
"""Правки вёрстки АО/АВР по замечаниям Регины 13.10.2026. Идемпотентно.

  python tools/patch-act-layout.py                      # оба шаблона в templates/
  python tools/patch-act-layout.py in.docx out.docx     # один файл

1. Таблица объектов — колонки перераспределены (№ 480 | Объект 2700 | Адрес 3300 |
   Площадь 1420 | Услуга 2448, сумма та же 10348). В узкую «Услугу» (2018) не влезали
   «Дезинсекционные», «профилактические», и LibreOffice рвал слово посреди.
   Ширины посчитаны по самым длинным словам всех 267 актов прода (Times 12pt + поля ячейки).
2. АВР, ячейка «Заказчик»: «Контакт: {имя}» одной строкой (раньше имя уезжало строкой ниже,
   «Контакт:» стоял пустой). У физлица ({#client.isIndividual}) — только «Контакт» и
   «Мобильный», вровень с «ИП Белавина О.В.»; у юрлица — название, ИНН, контакт, как было.
3. АО: подписи (Исполнитель/Заказчик, линии, расшифровки, м.п.) — один абзац с
   «не разрывать». Четыре абзаца с keepNext LibreOffice 7.4 в АО-2026-100 разорвал:
   подписи уехали на 2-й лист одни. АВР не трогаем — там keepNext держится (142 из 142).

⚠️ build-templates-from-real.py этих правок не содержит: после перегенерации шаблонов
прогнать patch-act-tables-inline.py, затем этот скрипт.
"""
import copy
import sys
import zipfile
from lxml import etree

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{%s}' % NS['w']

COLS = [480, 2700, 3300, 1420, 2448]


def w(tag):
    return W + tag


def text(el):
    return ''.join(t.text or '' for t in el.iter(w('t')))


def set_attr(parent, tag, **attrs):
    el = parent.find(w(tag))
    if el is None:
        el = etree.SubElement(parent, w(tag))
    for k, v in attrs.items():
        el.set(w(k), v)
    return el


# ── 1. ширины колонок ──────────────────────────────────────────────
def patch_columns(root, log):
    n = 0
    for tbl in root.iter(w('tbl')):
        rows = tbl.findall(w('tr'))
        if not rows:
            continue
        head = [text(tc).strip() for tc in rows[0].findall(w('tc'))]
        if len(head) != 5 or not head[1].startswith('Объект') or not head[2].startswith('Адрес'):
            continue
        grid = tbl.find(w('tblGrid')).findall(w('gridCol'))
        if [int(g.get(w('w'))) for g in grid] == COLS:
            continue
        old = [g.get(w('w')) for g in grid]
        for g, v in zip(grid, COLS):
            g.set(w('w'), str(v))
        for tr in rows:
            for tc, v in zip(tr.findall(w('tc')), COLS):
                tcPr = tc.find(w('tcPr'))
                if tcPr is None:
                    tcPr = etree.Element(w('tcPr'))
                    tc.insert(0, tcPr)
                tcW = tcPr.find(w('tcW'))
                if tcW is None:
                    tcW = etree.Element(w('tcW'))
                    tcPr.insert(0, tcW)
                tcW.set(w('w'), str(v))
                tcW.set(w('type'), 'dxa')
        n += 1
        log.append(f'таблица объектов: колонки {old} → {COLS}')
    return n


# ── 2. АВР: ячейка «Заказчик» ───────────────────────────────────────
def tag_paragraph(tag):
    p = etree.Element(w('p'))
    r = etree.SubElement(p, w('r'))
    t = etree.SubElement(r, w('t'))
    t.text = tag
    return p


def patch_customer(root, log):
    cell = None
    for tc in root.iter(w('tc')):
        if '{client.shortName}' in text(tc):
            cell = tc
            break
    if cell is None:
        return 0
    n = 0
    # «Контакт: ⏎{act.responsibleName}» → «Контакт: {act.responsibleName}»
    for p in cell.findall(w('p')):
        if 'Контакт:' not in text(p):
            continue
        runs = p.findall(w('r'))
        for i, r in enumerate(runs):
            kids = [k for k in r if k.tag != w('rPr')]
            if len(kids) == 1 and kids[0].tag == w('br'):
                before = ''.join(text(x) for x in runs[:i])
                after = text(runs[i + 1]) if i + 1 < len(runs) else ''
                if before.rstrip().endswith('Контакт:') and after.startswith('{act.responsibleName}'):
                    p.remove(r)
                    n += 1
                    log.append('«Контакт:» и имя — одной строкой')
                break
    # Юрлицо: название + ИНН + контакт (как было). Физлицо: только контакт и мобильный —
    # копия абзаца «Контакт…» с отступом сверху как у строки названия (стиль «1», 167),
    # чтобы «Контакт» встал вровень с «ИП Белавина О.В.» соседней колонки.
    if '{#client.isIndividual}' not in text(cell):
        paras = cell.findall(w('p'))
        p_name = next(p for p in paras if '{client.shortName}' in text(p))
        p_contact = next(p for p in paras if 'Контакт:' in text(p))
        twin = copy.deepcopy(p_contact)
        set_attr(twin.find(w('pPr')), 'spacing', before='167')
        p_name.addprevious(tag_paragraph('{^client.isIndividual}'))
        p_contact.addnext(tag_paragraph('{/client.isIndividual}'))
        p_contact.getnext().addnext(tag_paragraph('{#client.isIndividual}'))
        p_contact.getnext().getnext().addnext(twin)
        twin.addnext(tag_paragraph('{/client.isIndividual}'))
        n += 1
        log.append('«Заказчик»: у физлица только «Контакт» и «Мобильный» ({#client.isIndividual})')
    return n


# ── 3. АО: подписи одним неразрывным абзацем ─────────────────────
def is_tab_run(r):
    return r.find(w('tab')) is not None


def br_run():
    r = etree.Element(w('r'))
    set_attr(etree.SubElement(r, w('rPr')), 'sz', val='24')
    etree.SubElement(r, w('br'))
    return r


def set_text(t, value):
    t.text = value
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')


def merge_ao_signatures(root, log):
    """Хвост АО «Исполнитель / Заказчик» + линии + расшифровки + м.п. — 4 абзаца с keepNext.
    LibreOffice 7.4 эти keepNext не держит (АО-2026-100: подписи уехали на 2-й лист одни;
    проверено на стенде — не помогли ни снятие переноса, ни удлинение цепочки, ни поле снизу).
    «Не разрывать абзац» он держит всегда, поэтому склеиваем 4 строки в ОДИН абзац с
    переносами строк и общими позициями табуляции. Положение колонок сохраняется.
    (Обёртка в таблицу отвергнута: LibreOffice уносил её на лист вперёд без причины —
    АР-2026-132, а обязательный абзац после неё давал пустой 2-й лист — АО-2026-057.)"""
    body = root.find(w('body'))
    paras = [k for k in body if k.tag == w('p')]
    if len(paras) < 4:
        return 0
    p21, p22, p23, p24 = paras[-4:]
    t21, t22, t23, t24 = (text(p).strip() for p in (p21, p22, p23, p24))
    if 'Исполнитель' in t24 and 'м.п.' in t24:
        return 0  # уже склеено
    if not t21.startswith('Исполнитель'):
        return 0  # не АО (у АВР хвост другой и keepNext там держится)
    ok = ('Заказчик' in t21
          and t22.replace('/', '').strip() == ''
          and t23.count('(Подпись/расшифровка подписи)') == 2
          and t24.replace(' ', '') == 'м.п.м.п.'
          and all(sum(is_tab_run(r) for r in p.findall(w('r'))) == 1 for p in (p21, p24)))
    if not ok:
        log.append('АО: хвост подписей не опознан — НЕ склеиваю')
        return 0

    pPr = p21.find(w('pPr'))
    kn = pPr.find(w('keepNext'))
    if kn is not None:
        pPr.remove(kn)
    # позиции табуляции — из строки с линиями подписей (2334/4007/5252/7437/9109)
    pPr.replace(pPr.find(w('tabs')), copy.deepcopy(p22.find(w('pPr')).find(w('tabs'))))

    def tabs_to_5252(p):  # «текст <таб> текст»: один таб до 5252 → три (2334→4007→5252)
        tab_runs = [r for r in p.findall(w('r')) if is_tab_run(r)]
        assert len(tab_runs) == 1, 'ожидался один таб'
        for _ in range(2):
            tab_runs[0].append(etree.Element(w('tab')))

    tabs_to_5252(p21)
    p21.append(br_run())
    for r in p22.findall(w('r')):
        p21.append(r)
    p21.append(br_run())
    for r in p23.findall(w('r')):
        if is_tab_run(r):  # «таб + 16 пробелов» → два таба (до 5252)
            for t in r.findall(w('t')):
                r.remove(t)
            r.append(etree.Element(w('tab')))
        for t in r.findall(w('t')):
            if t.text == '   (':  # отступ под линией, как было
                set_text(t, '    (')
        p21.append(r)
    p21.append(br_run())
    tabs_to_5252(p24)
    first = p24.find(f"{w('r')}/{w('t')}")
    set_text(first, '  ' + first.text)  # у «м.п.» был отступ 150
    for r in p24.findall(w('r')):
        p21.append(r)
    for p in (p22, p23, p24):
        body.remove(p)
    log.append('АО: подписи (4 абзаца) склеены в один неразрывный')
    return 1


def patch_docx(src, dst):
    zin = zipfile.ZipFile(src)
    root = etree.fromstring(zin.read('word/document.xml'))
    log = []
    n = patch_columns(root, log) + patch_customer(root, log) + merge_ao_signatures(root, log)
    if n:
        xml = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
        items = [(it, xml if it.filename == 'word/document.xml' else zin.read(it.filename))
                 for it in zin.infolist()]
        zin.close()
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
            for it, data in items:
                zout.writestr(it, data)
    elif src != dst:
        zin.close()
        with open(src, 'rb') as f, open(dst, 'wb') as g:
            g.write(f.read())
    return log


if __name__ == '__main__':
    if len(sys.argv) == 3:
        pairs = [(sys.argv[1], sys.argv[2])]
    else:
        pairs = [(p, p) for p in ('templates/work-completion-report.docx',
                                  'templates/inspection-report.docx')]
    for src, dst in pairs:
        log = patch_docx(src, dst)
        print(f'{dst}: ' + ('; '.join(log) if log else 'уже пропатчен, без изменений'))
