# -*- coding: utf-8 -*-
"""Точечная правка шаблонов актов (АВР/АО): таблица объектов НЕ плавающая + нумерация страниц.

Зачем (жалоба Регины 02.10.2026, АР-2026-101, сеть пекарен «Хлебъ» на 10 точек):
таблица объектов в обоих шаблонах — ПЛАВАЮЩАЯ (<w:tblpPr>, так было в исходном Word).
LibreOffice 7.4 (он делает клиентские PDF на сервере) превращает её во врезку, а врезку
через страницу не режет: не влезла в остаток первой страницы — уезжает целиком на
вторую, первая остаётся полупустой. Делить плавающие таблицы умеет только LO 7.6+.

Что делает:
  1. таблица с шапкой «Объект:» → обычная (inline): убирает tblpPr, горизонталь
     сохраняет (центр → jc=center, отступ от края листа → tblInd);
  2. шапка таблицы повторяется на каждой странице (tblHeader), строка объекта
     не рвётся пополам (cantSplit);
  3. отступ: у плавающей таблицы зазор сверху давал tblpY, а под ним стояли пустые
     строки (<w:br/>) следующего абзаца — переносит зазор в абзац-распорку ПЕРЕД
     таблицей и снимает ведущие переносы «Качество…»/следующего абзаца;
  4. нижний колонтитул «Страница N из M» (поля PAGE/NUMPAGES) — у АВР в существующий
     пустой footer1.xml, у АО создаёт footer (у него колонтитула не было);
  5. финальный блок (АВР: «Уполномоченное лицо…» + подписи, АО: «Исполнитель/Заказчик» +
     подписи) неразрывный — keepLines/keepNext: на длинной таблице заголовок блока
     иначе рвался между листами.

Идемпотентен: повторный запуск ничего не меняет. Работает и на шаблоне, и на уже
сгенерированном документе (так проверялся на всех актах с прода).

ЗАПУСК:  python tools/patch-act-tables-inline.py <in.docx> [out.docx]   (без out — на месте)
⚠️ build-templates-from-real.py эту правку НЕ содержит (как и патч отступов 18.09):
   перегенерация шаблонов из исходников её потеряет — после неё прогнать этот скрипт.
"""
import re
import sys
import zipfile

from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
NS = {'w': W, 'r': R, 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
FOOTER_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'
FOOTER_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'

# Порядок детей w:tblPr по схеме (Word капризен к порядку элементов).
TBLPR_ORDER = ['tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual', 'tblStyleRowBandSize',
               'tblStyleColBandSize', 'tblW', 'jc', 'tblCellSpacing', 'tblInd', 'tblBorders',
               'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription']

FOOTER_DIST = '567'  # 1 см от нижнего края листа до колонтитула


def w(tag):
    return '{%s}%s' % (W, tag)


def insert_ordered(parent, el, order):
    """Вставить el в parent с соблюдением порядка схемы."""
    name = etree.QName(el).localname
    idx = order.index(name)
    for i, child in enumerate(parent):
        cname = etree.QName(child).localname
        if cname in order and order.index(cname) > idx:
            parent.insert(i, el)
            return
    parent.append(el)


def ensure_tr_flag(tr, flag):
    trPr = tr.find('w:trPr', NS)
    if trPr is None:
        trPr = etree.Element(w('trPr'))
        prex = tr.find('w:tblPrEx', NS)
        tr.insert(1 if prex is not None else 0, trPr)
    if trPr.find('w:' + flag, NS) is None:
        trPr.append(etree.Element(w(flag)))
        return 1
    return 0


def is_br_only_run(r):
    kids = [etree.QName(k).localname for k in r if etree.QName(k).localname != 'rPr']
    return kids == ['br']


def make_spacer(height_twips):
    p = etree.Element(w('p'))
    pPr = etree.SubElement(p, w('pPr'))
    sp = etree.SubElement(pPr, w('spacing'))
    sp.set(w('before'), '0')
    sp.set(w('after'), '0')
    sp.set(w('line'), str(height_twips))
    sp.set(w('lineRule'), 'exact')
    rPr = etree.SubElement(pPr, w('rPr'))
    etree.SubElement(rPr, w('sz')).set(w('val'), '2')
    return p


def patch_tables(root, log):
    n = 0
    for tbl in list(root.iter(w('tbl'))):
        tblPr = tbl.find('w:tblPr', NS)
        pos = tblPr.find('w:tblpPr', NS) if tblPr is not None else None
        rows = tbl.findall('w:tr', NS)
        if pos is None or not rows or 'Объект' not in ''.join(rows[0].itertext()):
            continue
        # горизонталь плавающей таблицы → inline
        x_spec = pos.get(w('tblpXSpec'))
        x = pos.get(w('tblpX'))
        y = int(pos.get(w('tblpY')) or 0)
        tblPr.remove(pos)
        if x_spec == 'center':
            if tblPr.find('w:jc', NS) is None:
                jc = etree.Element(w('jc'))
                jc.set(w('val'), 'center')
                insert_ordered(tblPr, jc, TBLPR_ORDER)
        elif x is not None and pos.get(w('horzAnchor')) == 'page':
            sect = root.find('.//w:body/w:sectPr', NS)
            left = int(sect.find('w:pgMar', NS).get(w('left')))
            ind = etree.Element(w('tblInd'))
            ind.set(w('w'), str(max(0, int(x) - left)))
            ind.set(w('type'), 'dxa')
            old = tblPr.find('w:tblInd', NS)
            if old is not None:
                tblPr.remove(old)
            insert_ordered(tblPr, ind, TBLPR_ORDER)
        # шапка повторяется на каждой странице, строка объекта не рвётся
        ensure_tr_flag(rows[0], 'tblHeader')
        for tr in rows[1:]:
            ensure_tr_flag(tr, 'cantSplit')
        # зазор: был tblpY над таблицей + ведущие <w:br/> следующего абзаца
        nxt = tbl.getnext()
        dropped = 0
        if nxt is not None and etree.QName(nxt).localname == 'p':
            for r in nxt.findall('w:r', NS):
                if dropped < 2 and is_br_only_run(r):
                    nxt.remove(r)
                    dropped += 1
                else:
                    break
        if y > 0:
            tbl.addprevious(make_spacer(y))
        n += 1
        log.append(f'таблица «Объект»: inline (было tblpY={y}, X={x_spec or x}), строк {len(rows)}, '
                   f'снято ведущих переносов {dropped}')
    return n


def find_tail_start(kids):
    """Начало финального блока: АВР — «Уполномоченное лицо…», АО — строка «Исполнитель … Заказчик»."""
    texts = [''.join(k.itertext()).strip() if etree.QName(k).localname == 'p' else None for k in kids]
    for i, t in enumerate(texts):
        if t and t.startswith('Уполномоченное лицо'):
            return i
    for i in range(len(texts) - 1, -1, -1):
        t = texts[i]
        if t and t.startswith('Исполнитель') and 'Заказчик' in t:
            return i
    return None


def keep_tail_together(root, log):
    """Финальный блок (уполномоченное лицо + подписи) — неразрывный: не влезает — переезжает
    на следующий лист целиком, а не рвётся посередине заголовка/подписей."""
    body = root.find('w:body', NS)
    kids = [k for k in body if etree.QName(k).localname != 'sectPr']
    start = find_tail_start(kids)
    if start is None:
        return 0
    block = []
    for k in kids[start:]:
        if etree.QName(k).localname != 'p':
            break
        block.append(k)
    added = 0
    for i, p in enumerate(block):
        pPr = p.find('w:pPr', NS)
        if pPr is None:
            pPr = etree.Element(w('pPr'))
            p.insert(0, pPr)
        flags = ['keepLines'] + (['keepNext'] if i < len(block) - 1 else [])
        for flag in ('keepLines', 'keepNext'):  # порядок схемы: pStyle, keepNext, keepLines
            if flag not in flags or pPr.find('w:' + flag, NS) is not None:
                continue
            el = etree.Element(w(flag))
            style = pPr.find('w:pStyle', NS)
            kn = pPr.find('w:keepNext', NS)
            if flag == 'keepLines' and kn is not None:
                kn.addnext(el)
            elif style is not None:
                style.addnext(el)
            else:
                pPr.insert(0, el)
            added += 1
    if added:
        first = ''.join(block[0].itertext()).strip()[:30]
        log.append(f'финальный блок «{first}…»: {len(block)} абз. неразрывны (+{added} флагов)')
    return added


def page_number_paragraph():
    rpr = ('<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
           'w:cs="Times New Roman"/><w:color w:val="595959"/><w:sz w:val="18"/>'
           '<w:szCs w:val="18"/></w:rPr>')

    def run(inner):
        return f'<w:r>{rpr}{inner}</w:r>'

    def field(code, cached):
        return (run('<w:fldChar w:fldCharType="begin"/>')
                + run(f'<w:instrText xml:space="preserve"> {code} </w:instrText>')
                + run('<w:fldChar w:fldCharType="separate"/>')
                + run(f'<w:t>{cached}</w:t>')
                + run('<w:fldChar w:fldCharType="end"/>'))

    return ('<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0" '
            'w:line="240" w:lineRule="auto"/></w:pPr>'
            + run('<w:t xml:space="preserve">Страница </w:t>') + field('PAGE', '1')
            + run('<w:t xml:space="preserve"> из </w:t>') + field('NUMPAGES', '1')
            + '</w:p>')


FOOTER_XML = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              f'<w:ftr xmlns:w="{W}" xmlns:r="{R}">' + '{P}</w:ftr>')


def patch_footer(files, root, log):
    """files: dict name->bytes (меняется на месте). root: document.xml."""
    rels = etree.fromstring(files['word/_rels/document.xml.rels'])
    footer_rels = [r for r in rels if r.get('Type') == FOOTER_REL_TYPE]
    sects = root.findall('.//w:sectPr', NS)
    if footer_rels:
        target = 'word/' + footer_rels[0].get('Target')
        fx = files[target].decode('utf-8')
        if 'NUMPAGES' in fx:
            return 0
        # заменить содержимое существующего (пустого) колонтитула
        body = re.sub(r'(<w:ftr\b[^>]*>).*(</w:ftr>)',
                      lambda m: m.group(1) + page_number_paragraph() + m.group(2), fx, flags=re.S)
        files[target] = body.encode('utf-8')
        log.append(f'колонтитул: номер страниц в существующий {target}')
    else:
        name = 'footer1.xml'
        i = 1
        while 'word/' + name in files:
            i += 1
            name = f'footer{i}.xml'
        files['word/' + name] = FOOTER_XML.replace('{P}', page_number_paragraph()).encode('utf-8')
        ids = {r.get('Id') for r in rels}
        rid = 'rIdPageNum'
        while rid in ids:
            rid += 'X'
        rel = etree.SubElement(rels, '{%s}Relationship' % PKG_REL)
        rel.set('Id', rid)
        rel.set('Type', FOOTER_REL_TYPE)
        rel.set('Target', name)
        files['word/_rels/document.xml.rels'] = etree.tostring(
            rels, xml_declaration=True, encoding='UTF-8', standalone=True)
        ct = etree.fromstring(files['[Content_Types].xml'])
        ov = etree.SubElement(ct, '{%s}Override' % CT)
        ov.set('PartName', '/word/' + name)
        ov.set('ContentType', FOOTER_CT)
        files['[Content_Types].xml'] = etree.tostring(
            ct, xml_declaration=True, encoding='UTF-8', standalone=True)
        # ссылка в ПЕРВОЙ секции (остальные continuous наследуют колонтитулы)
        fr = etree.Element(w('footerReference'))
        fr.set(w('type'), 'default')
        fr.set('{%s}id' % R, rid)
        first = sects[0]
        refs = [c for c in first if etree.QName(c).localname in ('headerReference', 'footerReference')]
        if refs:
            refs[-1].addnext(fr)
        else:
            first.insert(0, fr)
        log.append(f'колонтитул: создан word/{name} ({rid}) + ссылка в секции 1')
    # расстояние до колонтитула одинаковое во всех секциях (у АВР в секции 1 было 0 —
    # Word печатал бы номер впритык к краю листа)
    for s in sects:
        pg = s.find('w:pgMar', NS)
        if pg is not None:
            pg.set(w('footer'), FOOTER_DIST)
    return 1


def patch_docx(src, dst):
    with zipfile.ZipFile(src) as z:
        infos = z.infolist()
        files = {i.filename: z.read(i.filename) for i in infos}
    root = etree.fromstring(files['word/document.xml'])
    blips_before = len(root.findall('.//a:blip', NS))
    log = []
    nt = patch_tables(root, log)
    nt += keep_tail_together(root, log)
    nf = patch_footer(files, root, log)
    blips_after = len(root.findall('.//a:blip', NS))
    if blips_after != blips_before:
        raise SystemExit(f'ОСТАНОВ: картинок было {blips_before}, стало {blips_after}')
    files['word/document.xml'] = etree.tostring(
        root, xml_declaration=True, encoding='UTF-8', standalone=True)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as out:
        names = [i.filename for i in infos] + [n for n in files if n not in {i.filename for i in infos}]
        for n in names:
            out.writestr(n, files[n])
    return nt, nf, blips_after, log


if __name__ == '__main__':
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    nt, nf, blips, log = patch_docx(src, dst)
    for line in log:
        print('  ' + line)
    print(f'{src} -> {dst}: правок вёрстки {nt}, колонтитул {nf}, картинок {blips}')
