// SQL Diagram - UI Utilities (Toast, Line Numbers, Syntax Highlighting)

// Update line numbers and syntax highlight
function updateLineNumbers() {
    const text = elements.sqlInput.value;
    const lineCount = text.split('\n').length;
    const nums = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
    elements.lineNumbers.textContent = nums;
    syncLineNumberHeight();
    updateSyntaxHighlight(text);
}

// Ensure line-numbers scrollable range matches textarea scrollable range
function syncLineNumberHeight() {
    if (!elements.sqlInput || !elements.lineNumbers) return;

    // Reset padding to base so we measure the natural content height
    elements.lineNumbers.style.paddingBottom = '12px';

    // Now measure
    const taMaxScroll = elements.sqlInput.scrollHeight - elements.sqlInput.clientHeight;
    const lnMaxScroll = elements.lineNumbers.scrollHeight - elements.lineNumbers.clientHeight;
    const diff = taMaxScroll - lnMaxScroll;

    if (diff > 0) {
        elements.lineNumbers.style.paddingBottom = (12 + diff) + 'px';
    }
}

// Syntax highlight the DSL text
function updateSyntaxHighlight(text) {
    if (!elements.syntaxHighlight) return;

    // Escape HTML entities
    function esc(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Process line by line for simpler regex handling
    const lines = text.split('\n');
    const highlighted = lines.map(line => {
        // Comments
        const commentIdx = line.indexOf('//');
        let code = line;
        let commentPart = '';
        if (commentIdx !== -1) {
            code = line.substring(0, commentIdx);
            commentPart = `<span class="syn-comment">${esc(line.substring(commentIdx))}</span>`;
        }

        // Highlight the code part
        code = highlightCodeLine(code);

        return code + commentPart;
    });

    // Add trailing newline to match textarea behavior
    elements.syntaxHighlight.innerHTML = highlighted.join('\n') + '\n';
}

function highlightCodeLine(line) {
    function esc(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Table keyword + name + optional attributes
    const tableMatch = line.match(/^(\s*)(Table)(\s+)(\w+)(\s*)(\[[^\]]*\])?(\s*\{?)$/i);
    if (tableMatch) {
        const [, indent, keyword, sp1, name, sp2, attrs, brace] = tableMatch;
        let result = esc(indent);
        result += `<span class="syn-keyword">${esc(keyword)}</span>`;
        result += esc(sp1);
        result += `<span class="syn-name">${esc(name)}</span>`;
        result += esc(sp2 || '');
        if (attrs) {
            result += highlightTableAttrs(attrs);
        }
        if (brace) {
            result += `<span class="syn-brace">${esc(brace.trim())}</span>`;
        }
        return result;
    }

    // Closing brace
    if (/^\s*\}\s*$/.test(line)) {
        return line.replace('}', '<span class="syn-brace">}</span>');
    }

    // Note line
    const noteMatch = line.match(/^(\s*)(note:\s*)(['"])(.*?)(\3)(.*)$/i);
    if (noteMatch) {
        const [, indent, noteKw, q1, noteText, q2, rest] = noteMatch;
        return `${esc(indent)}<span class="syn-constraint">${esc(noteKw)}</span><span class="syn-string">${esc(q1 + noteText + q2)}</span>${esc(rest)}`;
    }

    // Indexes keyword
    if (/^\s*indexes?\s*\{?\s*$/i.test(line)) {
        return line.replace(/(indexes?)/i, '<span class="syn-keyword">$1</span>')
                   .replace('{', '<span class="syn-brace">{</span>');
    }

    // Index entry like (col1, col2)
    if (/^\s*\([\w,\s]+\)\s*$/.test(line)) {
        return esc(line).replace(/(\w+)/g, '<span class="syn-name">$1</span>');
    }

    // Column definition: "name type [constraints]"
    const colMatch = line.match(/^(\s+)(\w+)(\s+)(\w+(?:\([^)]+\))?)(\s*)((?:\[.*\])?)(.*)$/);
    if (colMatch) {
        const [, indent, colName, sp1, colType, sp2, constraints, rest] = colMatch;
        let result = esc(indent);
        result += `<span class="syn-name">${esc(colName)}</span>`;
        result += esc(sp1);
        result += highlightType(colType);
        result += esc(sp2);
        if (constraints) {
            result += highlightConstraints(constraints);
        }
        result += esc(rest);
        return result;
    }

    // Fallback
    return esc(line);
}

function highlightType(type) {
    function esc(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    // Split type from size: varchar(100) -> varchar + (100)
    const m = type.match(/^(\w+)(\(([^)]+)\))?$/);
    if (!m) return esc(type);
    let result = `<span class="syn-type">${esc(m[1])}</span>`;
    if (m[2]) {
        result += `(<span class="syn-number">${esc(m[3])}</span>)`;
    }
    return result;
}

function highlightConstraints(str) {
    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Match outer brackets
    const inner = str.match(/^\[([^\]]*)\]$/);
    if (!inner) return esc(str);

    const parts = inner[1].split(',');
    const highlighted = parts.map(part => {
        const trimmed = part.trim();
        const leading = part.match(/^(\s*)/)[1];

        // ref: > Table.Column
        if (/^ref:/i.test(trimmed)) {
            const refMatch = trimmed.match(/^(ref:\s*)(>?\s*)(\w+)\.?(\w*)$/i);
            if (refMatch) {
                return `${esc(leading)}<span class="syn-constraint">${esc(refMatch[1])}</span><span class="syn-ref">${esc(refMatch[2])}${esc(refMatch[3])}${refMatch[4] ? '.' + esc(refMatch[4]) : ''}</span>`;
            }
            return `${esc(leading)}<span class="syn-ref">${esc(trimmed)}</span>`;
        }

        // default: value
        if (/^default:/i.test(trimmed)) {
            const defMatch = trimmed.match(/^(default:\s*)(.+)$/i);
            if (defMatch) {
                return `${esc(leading)}<span class="syn-constraint">${esc(defMatch[1])}</span><span class="syn-string">${esc(defMatch[2])}</span>`;
            }
        }

        // note: 'value'
        if (/^note:/i.test(trimmed)) {
            const nMatch = trimmed.match(/^(note:\s*)(.+)$/i);
            if (nMatch) {
                return `${esc(leading)}<span class="syn-constraint">${esc(nMatch[1])}</span><span class="syn-string">${esc(nMatch[2])}</span>`;
            }
        }

        // icon: fa-xxx
        if (/^icon:/i.test(trimmed)) {
            const iMatch = trimmed.match(/^(icon:\s*)(.+)$/i);
            if (iMatch) {
                return `${esc(leading)}<span class="syn-constraint">${esc(iMatch[1])}</span><span class="syn-attr">${esc(iMatch[2])}</span>`;
            }
        }

        // color: #hex
        if (/^color:/i.test(trimmed)) {
            const cMatch = trimmed.match(/^(color:\s*)(.+)$/i);
            if (cMatch) {
                return `${esc(leading)}<span class="syn-constraint">${esc(cMatch[1])}</span><span class="syn-attr">${esc(cMatch[2])}</span>`;
            }
        }

        // Simple constraints: pk, increment, not null, unique, etc.
        return `${esc(leading)}<span class="syn-constraint">${esc(trimmed)}</span>`;
    });

    return `<span class="syn-bracket">[</span>${highlighted.join(',')}<span class="syn-bracket">]</span>`;
}

function highlightTableAttrs(str) {
    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    const inner = str.match(/^\[([^\]]*)\]$/);
    if (!inner) return esc(str);

    const parts = inner[1].split(',');
    const highlighted = parts.map(part => {
        const trimmed = part.trim();
        const leading = part.match(/^(\s*)/)[1];
        // icon: fa-xxx
        const iconMatch = trimmed.match(/^(icon:\s*)([\w-]+)$/i);
        if (iconMatch) {
            return `${esc(leading)}<span class="syn-constraint">${esc(iconMatch[1])}</span><span class="syn-attr">${esc(iconMatch[2])}</span>`;
        }
        // color: #hex
        const colorMatch = trimmed.match(/^(color:\s*)(#[0-9a-fA-F]{6})$/i);
        if (colorMatch) {
            return `${esc(leading)}<span class="syn-constraint">${esc(colorMatch[1])}</span><span class="syn-attr">${esc(colorMatch[2])}</span>`;
        }
        return `${esc(leading)}<span class="syn-attr">${esc(trimmed)}</span>`;
    });
    return `<span class="syn-bracket">[</span>${highlighted.join(',')}<span class="syn-bracket">]</span>`;
}

// Sync textarea scroll to highlight overlay
function syncHighlightScroll() {
    if (elements.syntaxHighlight && elements.sqlInput) {
        elements.syntaxHighlight.scrollTop = elements.sqlInput.scrollTop;
        elements.syntaxHighlight.scrollLeft = elements.sqlInput.scrollLeft;
    }
}

// Scroll editor to a table definition and highlight it
function scrollToTableInEditor(tableName) {
    if (!elements.sqlInput || !tableName) return;

    const text = elements.sqlInput.value;
    // Find the "Table <name>" definition (with optional attrs)
    const regex = new RegExp(`^(\\s*Table\\s+${escapeRegex(tableName)}\\s*(?:\\[[^\\]]*\\])?\\s*\\{)`, 'im');
    const match = regex.exec(text);
    if (!match) return;

    const startIdx = match.index;

    // Find the closing brace for this table
    let braceDepth = 0;
    let endIdx = startIdx;
    let foundOpen = false;
    for (let i = startIdx; i < text.length; i++) {
        if (text[i] === '{') {
            braceDepth++;
            foundOpen = true;
        } else if (text[i] === '}') {
            braceDepth--;
            if (foundOpen && braceDepth === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }

    // Calculate line numbers for the range
    const beforeStart = text.substring(0, startIdx);
    const startLine = beforeStart.split('\n').length - 1; // 0-based
    const tableText = text.substring(startIdx, endIdx);
    const endLine = startLine + tableText.split('\n').length - 1;

    // Scroll textarea so the table is visible
    const lineHeight = parseFloat(getComputedStyle(elements.sqlInput).lineHeight) || 20.8;
    const scrollTarget = startLine * lineHeight - 30; // 30px padding above
    elements.sqlInput.scrollTop = Math.max(0, scrollTarget);
    syncHighlightScroll();
    if (elements.lineNumbers) {
        elements.lineNumbers.scrollTop = elements.sqlInput.scrollTop;
    }

    // Apply highlight to the syntax overlay
    applyEditorHighlightRange(startLine, endLine);
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight a range of lines in the syntax overlay
let _editorHighlightTimeout = null;

function applyEditorHighlightRange(startLine, endLine) {
    if (!elements.syntaxHighlight) return;

    // Remove any previous highlight
    clearEditorHighlight();

    // Wrap lines in the range with a highlight span
    const pre = elements.syntaxHighlight;
    const html = pre.innerHTML;
    const lines = html.split('\n');

    for (let i = startLine; i <= endLine && i < lines.length; i++) {
        lines[i] = `<span class="editor-line-highlight">${lines[i]}</span>`;
    }

    pre.innerHTML = lines.join('\n');

    // Auto-remove highlight after 2.5s
    _editorHighlightTimeout = setTimeout(() => {
        clearEditorHighlight();
    }, 2500);
}

function clearEditorHighlight() {
    if (_editorHighlightTimeout) {
        clearTimeout(_editorHighlightTimeout);
        _editorHighlightTimeout = null;
    }
    // Re-generate clean highlight without line markers
    updateSyntaxHighlight(elements.sqlInput.value);
}

// Toast notifications
function showToast(message, type = 'success') {
    const icons = { success: 'check', error: 'times', warning: 'exclamation' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${icons[type]}"></i> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
