import styles from './Edit.module.css';
import { useEffect, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import * as commands from '@uiw/react-md-editor/commands-cn';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const Edit = () => {
    const [content, setContent] = useState('');
    const [previewMode, setPreviewMode] = useState('live');
    const [isEditorPreview, setIsEditorPreview] = useState(false);
    const [editorFullscreen, setEditorFullscreen] = useState(false);

    const [tableModalOpen, setTableModalOpen] = useState(false);
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(2);
    const [tableAlign, setTableAlign] = useState('left');
    const [tableApi, setTableApi] = useState(null);


    const icon = (id) => (
        <svg className={styles.commandIcon} aria-hidden="true">
            <use href={`#${id}`} />
        </svg>
    );

    const undoCommand = {
        name: 'undo',
        keyCommand: 'undo',
        buttonProps: {
            title: '撤销 (Ctrl+Z)',
            'aria-label': '撤销 (Ctrl+Z)',
            className: styles.historyButton,
        },
        icon: icon('icon-chexiao'),
        execute: (state, api) => {
            api.textArea.focus();
            document.execCommand('undo');
        },
    };

    const redoCommand = {
        name: 'redo',
        keyCommand: 'redo',
        buttonProps: {
            title: '重做 (Ctrl+Y)',
            'aria-label': '重做 (Ctrl+Y)',
            className: styles.historyButton,
        },
        icon: icon('icon-chongzuo'),
        execute: (state, api) => {
            api.textArea.focus();
            document.execCommand('redo');
        },
    };

    const capitalizeCommand = {
        name: 'capitalize',
        keyCommand: 'capitalize',
        buttonProps: {
            title: '将每个单词首字母转换成大写',
            'aria-label': '将每个单词首字母转换成大写',
        },
        icon: <span>Aa</span>,
        execute: (state, api) => {
            const text = state.selectedText;
            if (!text) return;

            const nextText = text.replace(/\b[a-z]/g, (char) => char.toUpperCase());
            api.replaceSelection(nextText);
        },
    };

    const uppercaseCommand = {
        name: 'uppercase',
        keyCommand: 'uppercase',
        buttonProps: {
            title: '将所选转换成大写',
            'aria-label': '将所选转换成大写',
        },
        icon: <span>A</span>,
        execute: (state, api) => {
            if (!state.selectedText) return;
            api.replaceSelection(state.selectedText.toUpperCase());
        },
    };

    const lowercaseCommand = {
        name: 'lowercase',
        keyCommand: 'lowercase',
        buttonProps: {
            title: '将所选转换成小写',
            'aria-label': '将所选转换成小写',
        },
        icon: <span>a</span>,
        execute: (state, api) => {
            if (!state.selectedText) return;
            api.replaceSelection(state.selectedText.toLowerCase());
        },
    };

    const headingCommand = (command, text) => ({
        ...command,
        icon: command.icon
            ? {
                ...command.icon,
                props: {
                    ...command.icon.props,
                    children: text,
                },
            }
            : <span>{text}</span>,
    });

    const formatDateTime = () => {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const weekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const year = now.getFullYear();
        const month = pad(now.getMonth() + 1);
        const day = pad(now.getDate());
        const hour = pad(now.getHours());
        const minute = pad(now.getMinutes());
        const second = pad(now.getSeconds());
        const week = weekMap[now.getDay()];

        return `${year}-${month}-${day} ${hour}:${minute}:${second} ${week}`;
    };

    const dateTimeCommand = {
        name: 'datetime',
        keyCommand: 'datetime',
        buttonProps: {
            title: '插入日期时间',
            'aria-label': '插入日期时间',
        },
        icon: <span>🕒</span>,
        execute: (state, api) => {
            api.replaceSelection(formatDateTime());
        },
    };

    const detailsCodeCommand = {
        name: 'details-code',
        keyCommand: 'details-code',
        shortcuts: 'ctrl+/',
        buttonProps: {
            title: '可折叠代码块 (Ctrl+/)',
            'aria-label': '可折叠代码块 (Ctrl+/)',
        },
        icon: icon('icon-zhedie'),
        execute: (state, api) => {
            api.replaceSelection(
            `<details>
            <summary>查看代码</summary>

            \`\`\`js
            ${state.selectedText || '// code'}
            \`\`\`

            </details>`
                        );
                    },
    };

    const searchCommand = {
        name: 'search-replace',
        keyCommand: 'search-replace',
        shortcuts: 'ctrl+f',
        buttonProps: {
            title: '查找/替换 (Ctrl+F)',
            'aria-label': '查找/替换 (Ctrl+F)',
        },
        icon: icon('icon-a-rongqi2021x'),
        execute: (state, api) => {
            const keyword = window.prompt('查找内容');
            if (!keyword) return;

            const startIndex = state.selection.end;
            let matchIndex = state.text.indexOf(keyword, startIndex);
            if (matchIndex === -1) {
                matchIndex = state.text.indexOf(keyword);
            }

            if (matchIndex === -1) {
                window.alert(`没有找到：${keyword}`);
                return;
            }

            api.textArea.focus();
            api.setSelectionRange({
                start: matchIndex,
                end: matchIndex + keyword.length,
            });

            const replacement = window.prompt('替换为（取消则只查找）', keyword);
            if (replacement !== null && replacement !== keyword) {
                api.replaceSelection(replacement);
            }
        },
    };

    const gotoLineCommand = {
        name: 'goto-line',
        keyCommand: 'goto-line',
        shortcuts: 'ctrl+g',
        buttonProps: {
            title: '跳转到行 (Ctrl+G)',
            'aria-label': '跳转到行 (Ctrl+G)',
        },
        icon: icon('icon-tiaozhuan'),
        execute: (state, api) => {
            const lineText = window.prompt('跳转到第几行');
            if (!lineText) return;

            const lineNumber = Number(lineText);
            if (!Number.isInteger(lineNumber) || lineNumber < 1) {
                window.alert('请输入有效的行号');
                return;
            }

            const lines = state.text.split('\n');
            const targetLine = Math.min(lineNumber, lines.length);
            const start = lines
                .slice(0, targetLine - 1)
                .reduce((total, line) => total + line.length + 1, 0);

            api.textArea.focus();
            api.setSelectionRange({ start, end: start });

            const lineHeight = Number.parseFloat(window.getComputedStyle(api.textArea).lineHeight) || 20;
            api.textArea.scrollTop = Math.max(0, (targetLine - 1) * lineHeight - api.textArea.clientHeight / 2);
        },
    };

    const saveCommand = {
        name: 'save',
        keyCommand: 'save',
        shortcuts: 'ctrl+s',
        buttonProps: {
            title: '保存 (Ctrl+S)',
            'aria-label': '保存 (Ctrl+S)',
        },
        icon: icon('icon-baocun'),
        execute: (state) => {
            localStorage.setItem('blog-editor-draft', state.text);
            window.alert('已保存');
        },
    };

    const livePreviewCommand = {
        name: 'live-preview-toggle',
        keyCommand: 'live-preview-toggle',
        shortcuts: 'alt+w',
        buttonProps: {
            title: previewMode === 'live' ? '实时预览' : '实时预览',
            'aria-label': previewMode === 'live' ? '实时预览' : '实时预览',
        },
        icon: (
            <span className={styles.previewToggleIcon}>
            <svg
                className={`${styles.previewIcon} ${previewMode === 'live' ? styles.iconVisible : styles.iconHidden}`}
                aria-hidden="true"
            >
                <use href="#icon-chakan" />
            </svg>

            <svg
                className={`${styles.previewIcon} ${previewMode === 'live' ? styles.iconHidden : styles.iconVisible}`}
                aria-hidden="true"
            >
                <use href="#icon-yulanguanbi" />
            </svg>
            </span>
        ),
        execute: () => {
            setPreviewMode((mode) => (mode === 'live' ? 'edit' : 'live'));
        },
    };

    const editorPreviewCommand = {
        name: 'editor-preview',
        keyCommand: 'editor-preview',
        buttonProps: {
            title: '全屏预览',
            'aria-label': '全屏预览',
        },
        icon: (
            <svg className={styles.commandIcon} aria-hidden="true">
            <use href="#icon-yulan" />
            </svg>
        ),
        execute: () => {
            setIsEditorPreview(true);
        },
    };

    const browserFullscreenCommand = {
        name: 'browser-fullscreen',
        keyCommand: 'browser-fullscreen',
        buttonProps: {
            title: '全浏览器编辑',
            'aria-label': '全浏览器编辑',
        },
        icon: (
            <svg className={`${styles.commandIcon} ${styles.smallCommandIcon}`} aria-hidden="true">
            <use href="#icon-full-screen" />
            </svg>
        ),
        execute: () => {
            setEditorFullscreen((value) => !value);
        },
    };

    useEffect(() => {
        if (!editorFullscreen) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
            setEditorFullscreen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [editorFullscreen]);

    const screenFullscreenCommand = {
        name: 'screen-fullscreen',
        keyCommand: 'screen-fullscreen',
        buttonProps: {
            title: '全屏编辑',
            'aria-label': '全屏编辑',
        },
        icon: (
            <svg className={styles.commandIcon} aria-hidden="true">
            <use href="#icon-pingmu" />
            </svg>
        ),
        execute: (state, api) => {
            const editor = api.textArea.closest('.w-md-editor');

            if (!document.fullscreenElement) {
            editor?.requestFullscreen?.();
            } else {
            document.exitFullscreen?.();
            }
        },
    };

    const createTableMarkdown = (rows, cols, align) => {
        const alignMap = {
            left: ':---',
            center: ':---:',
            right: '---:',
            none: '---',
        };

        const headers = Array.from({ length: cols }, (_, index) => `标题${index + 1}`);
        const separator = Array.from({ length: cols }, () => alignMap[align]);
        const body = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => '内容')
        );

        const toRow = (items) => `| ${items.join(' | ')} |`;

        return [
            toRow(headers),
            toRow(separator),
            ...body.map(toRow),
        ].join('\n');
    };

    const insertTable = () => {
        if (!tableApi) return;

        const markdown = createTableMarkdown(tableRows, tableCols, tableAlign);

        tableApi.replaceSelection(`\n${markdown}\n`);
        setTableModalOpen(false);
        setTableApi(null);
    };

    const closeTableModal = () => {
        setTableModalOpen(false);
        setTableApi(null);
    };


    const tableCommand = {
        name: 'custom-table',
        keyCommand: 'custom-table',
        buttonProps: {
            title: '添加表格',
            'aria-label': '添加表格',
        },
        icon: commands.table.icon,
        execute: (state, api) => {
            setTableApi(api);
            setTableModalOpen(true);
        },
    };

    const tableAlignOptions = [
        { value: 'left', icon: 'icon-zuoduiqi', title: '左对齐' },
        { value: 'center', icon: 'icon-juzhongduiqi', title: '居中对齐' },
        { value: 'right', icon: 'icon-youduiqi', title: '右对齐' },
        { value: 'none', icon: 'icon-zuoyouduiqi', title: '两端对齐' },
    ];

    const videoCommand = {
        name: 'video',
        keyCommand: 'video',
        buttonProps: {
            title: '插入视频',
            'aria-label': '插入视频',
        },
        icon: icon('icon-shipin'),
        execute: (state, api) => {
            const url = window.prompt('请输入视频地址');
            if (!url) return;

            api.replaceSelection(`\n<video src="${url}" controls width="100%"></video>\n`);
        },
    };


    // paste 图片
    const insertTextAtCursor = (textarea, text) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue =
        textarea.value.slice(0, start) + text + textarea.value.slice(end);

        setContent(nextValue);

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        });
    };

    const handleEditorPaste = async (event) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        const imageItem = Array.from(items).find(
            (item) => item.kind === 'file' && item.type.startsWith('image/')
        );

        if (!imageItem) return;

        event.preventDefault();

        const file = imageItem.getAsFile();
        if (!file) return;

        const formData = new FormData();
            formData.append('file', file);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        insertTextAtCursor(event.target, `![${file.name}](${data.url})`);
    };

    return (
        <div className={styles.main}>
            <div className={styles.state}>
                <span>编辑草稿</span>
            </div>

            <div className={styles.title}>
                <span className={styles.note}>标题</span>
                <input
                    className={styles.titleInput}
                    type="text"
                    placeholder="请输入标题"
                />
            </div>

            <div className={styles.content}>
                <div className={styles.contentNote}>
                    <span className={styles.note}>内容</span>
                </div>

                <div className={styles.edit} data-color-mode="light">
                    <MDEditor
                        value={content}
                        onChange={(value) => setContent(value || '')}
                        height={560}
                        preview={previewMode}
                        fullscreen={editorFullscreen}
                        commands={[
                            undoCommand,
                            redoCommand,
                            commands.divider,

                            commands.bold,
                            commands.strikethrough,
                            commands.italic,
                            commands.quote,
                            capitalizeCommand,
                            uppercaseCommand,
                            lowercaseCommand,
                            commands.divider,

                            headingCommand(commands.title1, 'H1'),
                            headingCommand(commands.title2, 'H2'),
                            headingCommand(commands.title3, 'H3'),
                            headingCommand(commands.title4, 'H4'),
                            headingCommand(commands.title5, 'H5'),
                            headingCommand(commands.title6, 'H6'),
                            commands.divider,

                            commands.orderedListCommand,
                            commands.unorderedListCommand,
                            commands.hr,
                            commands.checkedListCommand,
                            commands.divider,

                            commands.image,
                            videoCommand,
                            commands.link,
                            commands.codeBlock,
                            commands.code,
                            detailsCodeCommand,
                            tableCommand,
                            dateTimeCommand,
                            commands.divider,

                            searchCommand,
                            gotoLineCommand,
                            editorPreviewCommand,
                            livePreviewCommand,
                            browserFullscreenCommand,
                            screenFullscreenCommand,
                            commands.divider,

                            saveCommand,
                        ]}
                        extraCommands={[]}
                        textareaProps={{
                            placeholder: '请输入正文，支持 Markdown',
                            onPaste: handleEditorPaste,
                        }}
                    />

                     {isEditorPreview && (
                        <div className={styles.editorPreviewOverlay}>
                        <button
                            type="button"
                            className={styles.editorPreviewClose}
                            onClick={() => setIsEditorPreview(false)}
                            title="退出全屏预览"
                            aria-label="退出全屏预览"
                        >
                            ×
                        </button>

                        <div className={styles.editorPreviewContent}>
                            <MDEditor.Markdown source={content} />
                        </div>
                        </div>
                    )}

                    {tableModalOpen && (
                        <div className={styles.tableModalMask}>
                            <div className={styles.tableModal}>
                            <div className={styles.tableModalHeader}>
                                <strong>添加表格</strong>
                                <button type="button" onClick={closeTableModal}>×</button>
                            </div>

                            <div className={styles.tableModalBody}>
                                <div className={styles.tableSizeRow}>
                                    <span> 单元格数</span>
                                    <div className={styles.tableSize}>
                                        <label>
                                            行数
                                            <input
                                                type="number"
                                                min="1"
                                                value={tableRows}
                                                onChange={(e) => setTableRows(Number(e.target.value))}
                                            />
                                            </label>

                                            <label>
                                            列数
                                            <input
                                                type="number"
                                                min="1"
                                                value={tableCols}
                                                onChange={(e) => setTableCols(Number(e.target.value))}
                                            />
                                        </label> 
                                    </div>
                                    
                                </div>
                                

                                <div className={styles.alignGroup}>
                                    <span>对齐方式</span>
                                    <div className={styles.group}>
                                        {tableAlignOptions.map((item) => (
                                            <label key={item.value} className={styles.alignOption}>
                                            <input
                                                type="radio"
                                                name="tableAlign"
                                                checked={tableAlign === item.value}
                                                onChange={() => setTableAlign(item.value)}
                                            />

                                            <span className={styles.alignIcon} title={item.title}>
                                                {icon(item.icon)}
                                            </span>
                                            </label>
                                        ))}
                                    </div>
                                    
                                </div>

                            </div>

                            <div className={styles.tableModalFooter}>
                                <button type="button" onClick={insertTable}>确定</button>
                                <button type="button" onClick={closeTableModal}>取消</button>
                            </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Edit;
