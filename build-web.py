# Збирає web-src/* в одну сторінку app/index.html (з локальними шрифтами) і web/ewi-tutor.html (для браузера)
import re, os
ORDER = ['core.js','soundfont.js','backing.js','multitrack.js','section.js','engine.js','curriculum.js','songs_data.js','curriculum_more.js','curriculum_cool.js',
         'curriculum_extra.js','songs_more.js','ui.js','songs_ui.js','rep_extra.js','perform.js','reading.js','daily.js','badges.js','teacher.js']
S = 'web-src/'
t = open(S+'template.html', encoding='utf8').read()
css = open(S+'style.css', encoding='utf8').read()
js = '\n'.join(open(S+f, encoding='utf8').read() for f in ORDER)
page = t.replace('/*STYLE*/', css).replace('/*SCRIPT*/', js)
os.makedirs('web', exist_ok=True)
open('web/ewi-tutor.html', 'w', encoding='utf8').write(page)
desk = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', page)
desk = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>', '<link href="fonts.css" rel="stylesheet">', desk)
open('app/index.html', 'w', encoding='utf8').write(desk)
print('Зібрано: app/index.html і web/ewi-tutor.html')
