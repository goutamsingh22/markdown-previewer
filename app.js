(function () {
    'use strict';

    var SAMPLE = [
        '# Welcome to Markdown Previewer',
        '',
        'Write **Markdown** on the left and see the *formatted output* on the right — instantly.',
        '',
        '## Features',
        '',
        '- Live preview as you type',
        '- **Bold**, *italic*, ~~strikethrough~~ and `inline code`',
        '- Headings, lists, tables and blockquotes',
        '- Fenced code blocks with an optional language hint',
        '- Light and dark themes',
        '',
        '> Tip: use the toolbar above the editor or press **Ctrl+B** / **Ctrl+I** to format text quickly.',
        '',
        '## Code example',
        '',
        '```js',
        'function greet(name) {',
        '  return `Hello, ${name}!`;',
        '}',
        '```',
        '',
        '## Task list',
        '',
        '- [x] Design the layout',
        '- [x] Build the Markdown parser',
        '- [ ] Add even more features',
        '',
        '## Table',
        '',
        '| Feature | Status | Notes |',
        '| :--- | :---: | ---: |',
        '| Live preview | Done | Instant |',
        '| Themes | Done | Light / dark |',
        '',
        '---',
        '',
        'Made with HTML, CSS and vanilla JavaScript.'
    ].join('\n');

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function quoteAttr(value) {
        return String(value)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(url) {
        var normalized = String(url).replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
        if (
            normalized.indexOf('javascript:') === 0 ||
            normalized.indexOf('vbscript:') === 0 ||
            normalized.indexOf('data:') === 0
        ) {
            return '#';
        }
        return url;
    }

    function inline(text) {
        var codeStore = [];

        text = String(text).replace(/`([^`\n]+)`/g, function (match, code) {
            codeStore.push(code);
            return '\u0000' + (codeStore.length - 1) + '\u0000';
        });

        text = escapeHtml(text);

        text = text.replace(
            /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g,
            function (match, alt, url, title) {
                var src = quoteAttr(sanitizeUrl(url));
                var titleAttr = title ? ' title="' + quoteAttr(title) + '"' : '';
                return '<img src="' + src + '" alt="' + quoteAttr(alt) + '"' + titleAttr + '>';
            }
        );

        text = text.replace(
            /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g,
            function (match, label, url, title) {
                var href = quoteAttr(sanitizeUrl(url));
                var titleAttr = title ? ' title="' + quoteAttr(title) + '"' : '';
                return (
                    '<a href="' + href + '"' + titleAttr +
                    ' target="_blank" rel="noopener noreferrer">' + label + '</a>'
                );
            }
        );

        text = text.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');
        text = text.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
        text = text.replace(/(\*|_)([^*_\n]+?)\1/g, '<em>$2</em>');
        text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

        text = text.replace(/\u0000(\d+)\u0000/g, function (match, index) {
            return '<code>' + escapeHtml(codeStore[Number(index)]) + '</code>';
        });

        return text.replace(/\n/g, '<br>');
    }

    function listMatch(line) {
        return /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.test(line);
    }

    function isOrderedItem(line) {
        return /^\s*\d+[.)]\s+/.test(line);
    }

    function leadingSpaces(line) {
        return line.match(/^\s*/)[0].length;
    }

    function splitRow(line) {
        var value = line.trim();
        if (value.charAt(0) === '|') value = value.slice(1);
        if (value.charAt(value.length - 1) === '|') value = value.slice(0, -1);
        return value.split('|').map(function (cell) {
            return cell.trim();
        });
    }

    function isTableSeparator(line) {
        if (!line || line.indexOf('|') === -1 || line.indexOf('-') === -1) {
            return false;
        }
        var cells = splitRow(line);
        return cells.length > 0 && cells.every(function (cell) {
            return /^:?-{3,}:?$/.test(cell);
        });
    }

    function alignmentFor(cell) {
        var left = cell.charAt(0) === ':';
        var right = cell.charAt(cell.length - 1) === ':';
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
    }

    function renderTable(header, alignments, rows) {
        var html = '<table>\n<thead>\n<tr>';
        header.forEach(function (cell, index) {
            var align = alignments[index];
            var style = align ? ' style="text-align:' + align + '"' : '';
            html += '<th' + style + '>' + inline(cell) + '</th>';
        });
        html += '</tr>\n</thead>\n<tbody>\n';
        rows.forEach(function (row) {
            html += '<tr>';
            header.forEach(function (unused, index) {
                var cell = row[index] !== undefined ? row[index] : '';
                var align = alignments[index];
                var style = align ? ' style="text-align:' + align + '"' : '';
                html += '<td' + style + '>' + inline(cell) + '</td>';
            });
            html += '</tr>\n';
        });
        html += '</tbody>\n</table>\n';
        return html;
    }

    function isBlockStart(lines, index) {
        var line = lines[index];
        if (/^\s{0,3}#{1,6}\s+/.test(line)) return true;
        if (/^\s*(```|~~~)/.test(line)) return true;
        if (/^\s{0,3}>/.test(line)) return true;
        if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return true;
        if (line.indexOf('|') !== -1 && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
            return true;
        }
        return listMatch(line);
    }

    function isSameList(line, indent, ordered) {
        var match = line.match(/^\s*([-*+]|\d+[.)])\s+/);
        if (!match) return false;
        return leadingSpaces(line) === indent && /^\s*\d+[.)]\s+/.test(line) === ordered;
    }

    function parseList(lines, start) {
        var first = lines[start];
        var baseIndent = leadingSpaces(first);
        var ordered = isOrderedItem(first);
        var startNumber = ordered ? parseInt(first.match(/^\s*(\d+)/)[1], 10) : 1;
        var items = [];
        var index = start;

        while (index < lines.length) {
            if (!lines[index].trim()) {
                var nextNonBlank = index + 1;
                while (nextNonBlank < lines.length && !lines[nextNonBlank].trim()) {
                    nextNonBlank++;
                }
                if (
                    nextNonBlank < lines.length &&
                    isSameList(lines[nextNonBlank], baseIndent, ordered)
                ) {
                    index = nextNonBlank;
                    continue;
                }
                break;
            }

            var match = lines[index].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
            if (!match) break;

            var indent = match[1].length;
            if (indent < baseIndent) break;

            if (indent > baseIndent) {
                if (!items.length) break;
                var nested = parseList(lines, index);
                items[items.length - 1].extra += nested.html;
                index = nested.next;
                continue;
            }

            if (isOrderedItem(lines[index]) !== ordered) break;

            var content = match[3];
            index++;

            while (
                index < lines.length &&
                lines[index].trim() &&
                !listMatch(lines[index]) &&
                leadingSpaces(lines[index]) > indent
            ) {
                content += '\n' + lines[index].trim();
                index++;
            }

            items.push({ content: content, extra: '' });
        }

        var html = '<' + (ordered ? 'ol' : 'ul');
        if (ordered && startNumber !== 1) html += ' start="' + startNumber + '"';
        html += '>\n';

        items.forEach(function (item) {
            var content = item.content;
            var task = content.match(/^\[([ xX])\]\s+([\s\S]*)$/);
            if (task) {
                var checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
                html +=
                    '<li class="task-item"><input type="checkbox" disabled' + checked + '> ' +
                    inline(task[2]) + item.extra + '</li>\n';
            } else {
                html += '<li>' + inline(content) + item.extra + '</li>\n';
            }
        });

        html += '</' + (ordered ? 'ol' : 'ul') + '>\n';
        return { html: html, next: index };
    }

    function parseBlocks(lines) {
        var html = '';
        var index = 0;

        while (index < lines.length) {
            var line = lines[index];

            if (!line.trim()) {
                index++;
                continue;
            }

            var fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)\s*$/);
            if (fence) {
                var marker = fence[1];
                var language = fence[2];
                var buffer = [];
                index++;
                var closing = new RegExp('^\\s*' + marker + '\\s*$');
                while (index < lines.length && !closing.test(lines[index])) {
                    buffer.push(lines[index]);
                    index++;
                }
                if (index < lines.length) index++;
                var languageClass = language ? ' class="language-' + quoteAttr(language) + '"' : '';
                html += '<pre><code' + languageClass + '>' + escapeHtml(buffer.join('\n')) +
                    '</code></pre>\n';
                continue;
            }

            var heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
            if (heading) {
                var level = heading[1].length;
                html += '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>\n';
                index++;
                continue;
            }

            if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
                html += '<hr>\n';
                index++;
                continue;
            }

            if (/^\s{0,3}>/.test(line)) {
                var quoteLines = [];
                while (
                    index < lines.length &&
                    (
                        /^\s{0,3}>/.test(lines[index]) ||
                        (
                            !lines[index].trim() &&
                            index + 1 < lines.length &&
                            /^\s{0,3}>/.test(lines[index + 1])
                        )
                    )
                ) {
                    quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
                    index++;
                }
                html += '<blockquote>\n' + parseBlocks(quoteLines) + '</blockquote>\n';
                continue;
            }

            if (
                line.indexOf('|') !== -1 &&
                index + 1 < lines.length &&
                isTableSeparator(lines[index + 1])
            ) {
                var header = splitRow(line);
                var alignments = splitRow(lines[index + 1]).map(alignmentFor);
                index += 2;
                var rows = [];
                while (index < lines.length && lines[index].trim() && lines[index].indexOf('|') !== -1) {
                    rows.push(splitRow(lines[index]));
                    index++;
                }
                html += renderTable(header, alignments, rows);
                continue;
            }

            if (listMatch(line)) {
                var list = parseList(lines, index);
                html += list.html;
                index = list.next;
                continue;
            }

            var paragraph = [];
            while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
                paragraph.push(lines[index].trim());
                index++;
            }
            html += '<p>' + inline(paragraph.join('\n')) + '</p>\n';
        }

        return html;
    }

    function parseMarkdown(source) {
        if (!source || !source.trim()) return '';
        var lines = String(source).replace(/\r\n?/g, '\n').split('\n');
        return parseBlocks(lines).trim();
    }

    if (typeof window === 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = { parseMarkdown: parseMarkdown };
        }
        return;
    }

    var CONTENT_KEY = 'markdown-previewer-content';
    var THEME_KEY = 'markdown-previewer-theme';

    var editor = document.getElementById('editor');
    var preview = document.getElementById('preview');
    var wordCount = document.getElementById('wordCount');
    var charCount = document.getElementById('charCount');
    var lineCount = document.getElementById('lineCount');
    var themeBtn = document.getElementById('themeBtn');
    var sampleBtn = document.getElementById('sampleBtn');
    var clearBtn = document.getElementById('clearBtn');
    var downloadBtn = document.getElementById('downloadBtn');
    var copyHtmlBtn = document.getElementById('copyHtmlBtn');
    var toast = document.getElementById('toast');

    var saveTimer = null;
    var toastTimer = null;

    function getStored(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function setStored(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            return;
        }
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 1800);
    }

    function updateStats(value) {
        var trimmed = value.trim();
        var words = trimmed ? trimmed.split(/\s+/).length : 0;
        var lines = value ? value.split('\n').length : 0;
        wordCount.textContent = words + (words === 1 ? ' word' : ' words');
        charCount.textContent = value.length + (value.length === 1 ? ' character' : ' characters');
        lineCount.textContent = lines + (lines === 1 ? ' line' : ' lines');
    }

    function persist() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            setStored(CONTENT_KEY, editor.value);
        }, 250);
    }

    function render() {
        var value = editor.value;
        preview.innerHTML = parseMarkdown(value);
        preview.classList.toggle('empty', !value.trim());
        updateStats(value);
        persist();
    }

    function applyTheme(theme) {
        document.body.dataset.theme = theme;
        themeBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
        setStored(THEME_KEY, theme);
    }

    function insertText(text, selectionStart, selectionEnd) {
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.setRangeText(text, start, end, 'end');
        if (typeof selectionStart === 'number') {
            editor.setSelectionRange(
                start + selectionStart,
                start + (typeof selectionEnd === 'number' ? selectionEnd : selectionStart)
            );
        }
        editor.focus();
        render();
    }

    function wrapSelection(before, after, placeholder) {
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        var selected = editor.value.slice(start, end);
        var text = selected || placeholder;
        insertText(before + text + after, before.length, before.length + text.length);
    }

    function toggleLinePrefix(prefix) {
        var value = editor.value;
        var start = value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
        var end = value.indexOf('\n', editor.selectionEnd);
        if (end === -1) end = value.length;

        var block = value.slice(start, end);
        var lines = block.split('\n');
        var hasPrefix = lines.every(function (line) {
            return line.indexOf(prefix) === 0;
        });
        var updated = lines.map(function (line) {
            return hasPrefix ? line.slice(prefix.length) : prefix + line;
        }).join('\n');

        editor.setRangeText(updated, start, end, 'end');
        editor.setSelectionRange(start, start + updated.length);
        editor.focus();
        render();
    }

    function insertCodeBlock() {
        var selected = editor.value.slice(editor.selectionStart, editor.selectionEnd) || 'code';
        var block = '```\n' + selected + '\n```';
        insertText(block, 4, 4 + selected.length);
    }

    function insertTable() {
        var table = '\n| Column 1 | Column 2 | Column 3 |\n' +
            '| --- | --- | --- |\n' +
            '| Cell | Cell | Cell |\n';
        var start = table.indexOf('Column 1');
        insertText(table, start, start + 'Column 1'.length);
    }

    function doAction(action) {
        switch (action) {
            case 'bold':
                wrapSelection('**', '**', 'bold text');
                break;
            case 'italic':
                wrapSelection('*', '*', 'italic text');
                break;
            case 'strike':
                wrapSelection('~~', '~~', 'strikethrough');
                break;
            case 'heading':
                toggleLinePrefix('## ');
                break;
            case 'link':
                wrapSelection('[', '](https://example.com)', 'link text');
                break;
            case 'image':
                wrapSelection('![', '](https://example.com/image.png)', 'alt text');
                break;
            case 'code':
                wrapSelection('`', '`', 'code');
                break;
            case 'codeblock':
                insertCodeBlock();
                break;
            case 'ul':
                toggleLinePrefix('- ');
                break;
            case 'ol':
                toggleLinePrefix('1. ');
                break;
            case 'task':
                toggleLinePrefix('- [ ] ');
                break;
            case 'quote':
                toggleLinePrefix('> ');
                break;
            case 'table':
                insertTable();
                break;
            case 'hr':
                insertText('\n\n---\n\n');
                break;
        }
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var helper = document.createElement('textarea');
            helper.value = text;
            helper.setAttribute('readonly', '');
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(helper);
            if (ok) resolve();
            else reject(new Error('Copy failed'));
        });
    }

    editor.addEventListener('input', render);

    editor.addEventListener('keydown', function (event) {
        var modifier = event.ctrlKey || event.metaKey;
        var key = event.key.toLowerCase();

        if (modifier && !event.altKey && !event.shiftKey) {
            if (key === 'b') {
                event.preventDefault();
                doAction('bold');
                return;
            }
            if (key === 'i') {
                event.preventDefault();
                doAction('italic');
                return;
            }
            if (key === 'k') {
                event.preventDefault();
                doAction('link');
                return;
            }
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            insertText('  ', 2, 2);
        }
    });

    editor.addEventListener('scroll', function () {
        var editorMax = editor.scrollHeight - editor.clientHeight;
        if (editorMax <= 0) return;
        var previewMax = preview.scrollHeight - preview.clientHeight;
        if (previewMax <= 0) return;
        preview.scrollTop = (editor.scrollTop / editorMax) * previewMax;
    });

    document.querySelector('.toolbar').addEventListener('click', function (event) {
        var button = event.target.closest('button[data-action]');
        if (!button) return;
        event.preventDefault();
        doAction(button.dataset.action);
    });

    sampleBtn.addEventListener('click', function () {
        editor.value = SAMPLE;
        render();
        editor.focus();
        editor.setSelectionRange(0, 0);
        editor.scrollTop = 0;
        preview.scrollTop = 0;
        showToast('Sample document loaded');
    });

    clearBtn.addEventListener('click', function () {
        if (!editor.value) {
            editor.focus();
            return;
        }
        editor.value = '';
        render();
        editor.focus();
        showToast('Editor cleared');
    });

    downloadBtn.addEventListener('click', function () {
        var blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'document.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Markdown file downloaded');
    });

    copyHtmlBtn.addEventListener('click', function () {
        copyToClipboard(preview.innerHTML).then(function () {
            showToast('HTML copied to clipboard');
        }).catch(function () {
            showToast('Could not copy HTML');
        });
    });

    themeBtn.addEventListener('click', function () {
        var next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });

    var storedTheme = getStored(THEME_KEY);
    if (!storedTheme) {
        storedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }
    applyTheme(storedTheme);

    var storedContent = getStored(CONTENT_KEY);
    editor.value = storedContent === null ? SAMPLE : storedContent;
    render();
})();
