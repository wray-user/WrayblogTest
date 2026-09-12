import styles from './Edit.module.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import * as commands from '@uiw/react-md-editor/commands-cn';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';

const Edit = ({
    onDraftChange,
    externalDraft,
    externalDraftKey = '',
    clearSignal = 0,
    onNewPost,
}) => {
    const location = useLocation();
    const EDITOR_BACKUP_KEY = 'main-editor';
    const AUTO_BACKUP_INTERVAL = 10 * 60 * 1000;
    const DRAFT_STORAGE_PREFIX = 'blog-editor-draft';
    const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${location.pathname}`;
    const readStoredDraft = () => {
        try {
            const savedDraft = localStorage.getItem(draftStorageKey);

            if (savedDraft) {
                try {
                    const parsedDraft = JSON.parse(savedDraft);

                    return {
                        title: parsedDraft.title || '',
                        content: parsedDraft.content || '',
                        hasStoredDraft: true,
                    };
                } catch {
                    return {
                        title: '',
                        content: savedDraft,
                        hasStoredDraft: true,
                    };
                }
            }

            const legacyDraft = localStorage.getItem(DRAFT_STORAGE_PREFIX) || '';

            return {
                title: '',
                content: legacyDraft,
                hasStoredDraft: Boolean(legacyDraft),
            };
        } catch (error) {
            console.warn('读取本地草稿失败', error);

            return { title: '', content: '', hasStoredDraft: false };
        }
    };
    const initialDraft = readStoredDraft();
    const hasStoredDraft = Boolean(initialDraft.hasStoredDraft);

    const [title, setTitle] = useState(initialDraft.title);
    const [content, setContent] = useState(initialDraft.content);
    const [previewMode, setPreviewMode] = useState('live');
    const [isEditorPreview, setIsEditorPreview] = useState(false);
    const [editorFullscreen, setEditorFullscreen] = useState(false);
    const [backupPanelOpen, setBackupPanelOpen] = useState(false);
    const [backups, setBackups] = useState([]);
    const [selectedBackupId, setSelectedBackupId] = useState('');
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupPreviewLoading, setBackupPreviewLoading] = useState(false);
    const [backupStatus, setBackupStatus] = useState('');

    const [tableModalOpen, setTableModalOpen] = useState(false);
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(2);
    const [tableAlign, setTableAlign] = useState('left');
    const [tableApi, setTableApi] = useState(null);

    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [searchApi, setSearchApi] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [searchMatchIndex, setSearchMatchIndex] = useState(-1);
    const [searchMatches, setSearchMatches] = useState([]);
    const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
    const [searchWholeWord, setSearchWholeWord] = useState(false);
    const [replacePanelOpen, setReplacePanelOpen] = useState(true);
    const [gotoLineOpen, setGotoLineOpen] = useState(false);
    const [gotoLineApi, setGotoLineApi] = useState(null);
    const [gotoLineText, setGotoLineText] = useState('');
    const [gotoLineError, setGotoLineError] = useState('');

    const editorWrapRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const gotoLineInputRef = useRef(null);
    const titleInputRef = useRef(null);
    const latestDraftRef = useRef(initialDraft);
    const imageInsertionsRef = useRef([]);
    const [lineNumberRoot, setLineNumberRoot] = useState(null);

    useEffect(() => {
        const wrap = editorWrapRef.current;

        if (!wrap) return;

        setLineNumberRoot(wrap.querySelector('.w-md-editor-content'));
    }, [editorFullscreen, previewMode]);

    useEffect(() => {
        if (previewMode === 'preview') return;

        const wrap = editorWrapRef.current;

        if (!wrap) return;

        const scrollArea = wrap.querySelector('.w-md-editor-area.w-md-editor-input');

        if (!scrollArea) return;

        const handleScroll = () => {
            if (lineNumbersRef.current) {
                lineNumbersRef.current.style.transform = `translateY(-${scrollArea.scrollTop}px)`;
            }
        };

        handleScroll();
        scrollArea.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            scrollArea.removeEventListener('scroll', handleScroll);
        };
    }, [editorFullscreen, previewMode]);

    useEffect(() => {
        const wrap = editorWrapRef.current;
        const scrollArea = wrap?.querySelector('.w-md-editor-area.w-md-editor-input');

        if (scrollArea && lineNumbersRef.current) {
            lineNumbersRef.current.style.transform = `translateY(-${scrollArea.scrollTop}px)`;
        }
    }, [lineNumberRoot, lineNumbersRef, content, editorFullscreen, previewMode]);

    useEffect(() => {
        if (!gotoLineOpen) return;

        requestAnimationFrame(() => {
            gotoLineInputRef.current?.focus();
            gotoLineInputRef.current?.select();
        });
    }, [gotoLineOpen]);

    useEffect(() => {
        latestDraftRef.current = { title, content };
        onDraftChange?.({ title, content });
    }, [title, content]);

    useEffect(() => {
        if (!externalDraftKey || !externalDraft) {
            return;
        }

        const nextTitle = externalDraft.title || '';
        const nextContent = externalDraft.content || '';

        setTitle(nextTitle);
        setContent(nextContent);
        latestDraftRef.current = { title: nextTitle, content: nextContent };
    }, [externalDraftKey]);

    useEffect(() => {
        if (!clearSignal) {
            return;
        }

        setTitle('');
        setContent('');
        latestDraftRef.current = { title: '', content: '' };
    }, [clearSignal]);

    useEffect(() => {
        const restoreLatestBackup = async () => {
            if (hasStoredDraft) {
                return;
            }

            if (latestDraftRef.current.title || latestDraftRef.current.content) {
                return;
            }

            const token = localStorage.getItem('token');

            if (!token) {
                return;
            }

            try {
                const res = await fetch(`/api/editor-backups?editorKey=${EDITOR_BACKUP_KEY}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const data = await res.json();

                if (!res.ok) {
                    return;
                }

                const latestBackupId = data.backups?.[0]?.id;

                if (!latestBackupId) {
                    return;
                }

                const detailRes = await fetch(`/api/editor-backups/${latestBackupId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const detailData = await detailRes.json();

                if (!detailRes.ok || !detailData.backup) {
                    return;
                }

                const nextTitle = detailData.backup.title || '';
                const nextContent = detailData.backup.content || '';

                setTitle(nextTitle);
                setContent(nextContent);
                latestDraftRef.current = { title: nextTitle, content: nextContent };
            } catch (error) {
                console.warn('悬态备份恢失败', error);
            }
        };

        restoreLatestBackup();
    }, [hasStoredDraft]);

    useEffect(() => {
        try {
            localStorage.setItem(
                draftStorageKey,
                JSON.stringify({
                    title,
                    content,
                    updatedAt: new Date().toISOString(),
                })
            );
            localStorage.setItem(DRAFT_STORAGE_PREFIX, content);
        } catch (error) {
            console.warn('保存本地草稿失败', error);
        }
    }, [draftStorageKey, title, content]);

    const lineNumbers = content.split('\n').map((_, index) => index + 1);
    const selectedBackupSummary = backups.find((backup) => backup.id === selectedBackupId);
    const selectedBackupTitle = selectedBackup?.title || selectedBackupSummary?.title || '';
    const mathPreviewOptions = {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeKatex],
    };
    const urlPattern = /https?:\/\/[^\s<>"'`)\]}，。！？；、]+/g;

    const getUrlAtPosition = (text, position) => {
        let match;

        urlPattern.lastIndex = 0;

        while ((match = urlPattern.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;

            if (position >= start && position <= end) {
                return match[0];
            }
        }

        return '';
    };

    const handleNewPost = () => {
        if (onNewPost) {
            onNewPost();
            return;
        }

        setTitle('');
        setContent('');
        latestDraftRef.current = { title: '', content: '' };
    };

    const handleEditorClick = (event) => {
        if (!event.ctrlKey && !event.metaKey) return;

        const textarea = event.currentTarget;
        const url = getUrlAtPosition(textarea.value, textarea.selectionStart);

        if (!url) return;

        event.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const formatBackupTime = (dateValue) => {
        const date = new Date(dateValue);
        const pad = (value) => String(value).padStart(2, '0');

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');

        if (!token) {
            throw new Error('请先登录');
        }

        return {
            Authorization: `Bearer ${token}`,
        };
    };

    const loadBackupDetail = async (backupId, { showLoading = true } = {}) => {
        if (!backupId) {
            setSelectedBackup(null);
            return null;
        }

        if (showLoading) {
            setBackupPreviewLoading(true);
        }

        try {
            const res = await fetch(`/api/editor-backups/${backupId}`, {
                headers: getAuthHeaders(),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || '读取备份内容失败');
            }

            setSelectedBackup(data.backup || null);
            return data.backup || null;
        } catch (error) {
            setBackupStatus(error.message);
            setSelectedBackup(null);
            return null;
        } finally {
            if (showLoading) {
                setBackupPreviewLoading(false);
            }
        }
    };

    const fetchBackups = async (preferredSelectedId = '') => {
        setBackupLoading(true);

        try {
            const res = await fetch(`/api/editor-backups?editorKey=${EDITOR_BACKUP_KEY}`, {
                headers: getAuthHeaders(),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || '读取备份失败');
            }

            const backupList = data.backups || [];
            const nextSelectedId = preferredSelectedId && backupList.some((backup) => backup.id === preferredSelectedId)
                ? preferredSelectedId
                : selectedBackupId && backupList.some((backup) => backup.id === selectedBackupId)
                    ? selectedBackupId
                    : backupList[0]?.id || '';

            setBackups(backupList);
            setSelectedBackupId(nextSelectedId);

            if (nextSelectedId) {
                await loadBackupDetail(nextSelectedId, { showLoading: false });
            } else {
                setSelectedBackup(null);
            }
            setBackupStatus('');
        } catch (error) {
            setBackupStatus(error.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const saveEditorBackup = async ({ silent = false, draftOverride = null } = {}) => {
        const inputTitle = titleInputRef.current?.value ?? '';
        const draftSource = draftOverride || latestDraftRef.current;
        const draft = {
            title: (inputTitle || draftSource.title || '').trim(),
            content: draftSource.content || '',
        };

        if (!draft.title && !draft.content.trim()) {
            return false;
        }

        try {
            const res = await fetch('/api/editor-backups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({
                    editorKey: EDITOR_BACKUP_KEY,
                    title: draft.title,
                    content: draft.content,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || '自动备份失败');
            }

            if (backupPanelOpen) {
                await fetchBackups(data.backup.id);
            }

            return true;
        } catch (error) {
            if (!silent) {
                setBackupStatus(error.message);
            }

            return false;
        }
    };

    const saveCurrentDraft = async (draftContent = latestDraftRef.current.content) => {
        const currentTitle = (titleInputRef.current?.value ?? title).trim();
        const nextDraft = {
            title: currentTitle,
            content: draftContent || '',
        };

        localStorage.setItem(
            draftStorageKey,
            JSON.stringify({
                ...nextDraft,
                updatedAt: new Date().toISOString(),
            })
        );
        localStorage.setItem('blog-editor-draft', nextDraft.content);
        latestDraftRef.current = nextDraft;
        setBackupStatus('保存中...');

        const backedUp = await saveEditorBackup({
            silent: true,
            draftOverride: nextDraft,
        });

        setBackupStatus(backedUp ? '已保存并备份' : '已保存，本次备份失败');

        return backedUp;
    };

    const openBackupPanel = async () => {
        setBackupPanelOpen((open) => !open);

        if (!backupPanelOpen) {
            await fetchBackups();
        }
    };

    const restoreSelectedBackup = async () => {
        if (!selectedBackupId) return;

        setBackupLoading(true);

        try {
            const res = await fetch(`/api/editor-backups/${selectedBackupId}`, {
                headers: getAuthHeaders(),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || '还原失败');
            }

            setTitle(data.backup.title || '');
            setContent(data.backup.content || '');
            setBackupStatus(`已还原 ${formatBackupTime(data.backup.createdAt)}`);
        } catch (error) {
            setBackupStatus(error.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const deleteSelectedBackup = async () => {
        if (!selectedBackupId) return;

        setBackupLoading(true);

        try {
            const res = await fetch(`/api/editor-backups/${selectedBackupId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || '删除失败');
            }

            setBackupStatus('已删除备份');
            await fetchBackups();
        } catch (error) {
            setBackupStatus(error.message);
        } finally {
            setBackupLoading(false);
        }
    };

    useEffect(() => {
        const timer = window.setInterval(() => {
            saveEditorBackup({ silent: true });
        }, AUTO_BACKUP_INTERVAL);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        if (previewMode === 'preview') return;

        const wrap = editorWrapRef.current;
        const textLayer = wrap?.querySelector('.w-md-editor-text');

        if (!textLayer) return;

        let frameId = 0;

        const annotateCodeLines = () => {
            const codeLines = textLayer.querySelectorAll('.w-md-editor-text-pre .code-line');

            if (!codeLines.length) return;

            const lines = content.split('\n');
            const tableSeparatorPattern = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
            const isTableLine = (line) => /^\s*\|.*\|\s*$/.test(line);
            const decoratePlainUrls = (lineElement) => {
                const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT, {
                    acceptNode: (node) => {
                        urlPattern.lastIndex = 0;

                        if (!urlPattern.test(node.nodeValue || '')) {
                            urlPattern.lastIndex = 0;
                            return NodeFilter.FILTER_REJECT;
                        }

                        urlPattern.lastIndex = 0;

                        if (node.parentElement?.closest('.md-editor-plain-url, .token.url, .token.code-block')) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        return NodeFilter.FILTER_ACCEPT;
                    },
                });
                const textNodes = [];
                let node;

                while ((node = walker.nextNode())) {
                    textNodes.push(node);
                }

                textNodes.forEach((textNode) => {
                    const fragment = document.createDocumentFragment();
                    const text = textNode.nodeValue || '';
                    let cursor = 0;
                    let match;

                    urlPattern.lastIndex = 0;

                    while ((match = urlPattern.exec(text)) !== null) {
                        const url = match[0];

                        if (match.index > cursor) {
                            fragment.append(document.createTextNode(text.slice(cursor, match.index)));
                        }

                        const span = document.createElement('span');
                        span.className = 'md-editor-plain-url';
                        span.textContent = url;
                        fragment.append(span);
                        cursor = match.index + url.length;
                    }

                    if (cursor < text.length) {
                        fragment.append(document.createTextNode(text.slice(cursor)));
                    }

                    textNode.replaceWith(fragment);
                });
            };
            let inCodeBlock = false;

            codeLines.forEach((lineElement, index) => {
                const line = lines[index] || '';
                const trimmed = line.trim();
                let kind = '';

                if (/^```/.test(trimmed)) {
                    kind = 'code-block';
                    inCodeBlock = !inCodeBlock;
                } else if (inCodeBlock) {
                    kind = 'code-block';
                } else if (/^#(?!#)\s+/.test(trimmed)) {
                    kind = 'h1';
                } else if (/^##(?!#)\s+/.test(trimmed)) {
                    kind = 'h2';
                } else if (/^###(?!#)\s+/.test(trimmed)) {
                    kind = 'h3';
                } else if (/^#{4,6}\s+/.test(trimmed)) {
                    kind = 'h4-h6';
                } else if (/^>\s?/.test(trimmed)) {
                    kind = 'blockquote';
                } else if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed)) {
                    kind = 'task-list';
                } else if (/^[-*+]\s+/.test(trimmed)) {
                    kind = 'unordered-list';
                } else if (/^\d+\.\s+/.test(trimmed)) {
                    kind = 'ordered-list';
                } else if (/^([-*_])(\s*\1){2,}\s*$/.test(trimmed)) {
                    kind = 'hr';
                } else if (tableSeparatorPattern.test(line)) {
                    kind = 'table-border';
                } else if (isTableLine(line) && tableSeparatorPattern.test(lines[index + 1] || '')) {
                    kind = 'table-header';
                } else if (isTableLine(line)) {
                    kind = 'table-row';
                }

                if (kind) {
                    lineElement.dataset.mdLineKind = kind;
                } else {
                    delete lineElement.dataset.mdLineKind;
                }

                if (kind !== 'code-block') {
                    decoratePlainUrls(lineElement);
                }
            });
        };

        const scheduleAnnotate = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(annotateCodeLines);
        };

        const observer = new MutationObserver(scheduleAnnotate);

        annotateCodeLines();
        observer.observe(textLayer, { childList: true, subtree: true });
        wrap.addEventListener('focusin', scheduleAnnotate);
        wrap.addEventListener('focusout', scheduleAnnotate);
        wrap.addEventListener('mousedown', scheduleAnnotate);

        return () => {
            cancelAnimationFrame(frameId);
            observer.disconnect();
            wrap.removeEventListener('focusin', scheduleAnnotate);
            wrap.removeEventListener('focusout', scheduleAnnotate);
            wrap.removeEventListener('mousedown', scheduleAnnotate);
        };
    }, [content, editorFullscreen, previewMode]);




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
            if (undoLastImageInsertion(api.textArea)) return;
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
        icon: <span>??</span>,
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

    const languageCodeBlockCommand = {
        name: 'language-code-block',
        keyCommand: 'language-code-block',
        buttonProps: {
            title: '插入代码块并指定语言',
            'aria-label': '插入代码块并指定语言',
        },
        icon: commands.codeBlock.icon,
        execute: (state, api) => {
            const code = state.selectedText || '// code';
            const block = `\n\`\`\`js\n${code}\n\`\`\`\n`;
            const languageStart = state.selection.start + 4;

            api.replaceSelection(block);

            requestAnimationFrame(() => {
                api.textArea.focus();
                api.setSelectionRange({
                    start: languageStart,
                    end: languageStart + 2,
                });
            });
        },
    };

    const mathCommand = {
        name: 'math',
        keyCommand: 'math',
        buttonProps: {
            title: '插入数学公式',
            'aria-label': '插入数学公式',
        },
        icon: <span>fx</span>,
        execute: (state, api) => {
            const selectedText = state.selectedText.trim();

            if (selectedText) {
                api.replaceSelection(`$${selectedText}$`);
                return;
            }

            api.replaceSelection('\n$$\nE = mc^2\n$$\n');
        },
    };

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const getSearchMatches = (text, keyword) => {
        if (!keyword) return [];

        const source = searchWholeWord
            ? `\\b${escapeRegExp(keyword)}\\b`
            : escapeRegExp(keyword);
        const flags = searchCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(source, flags);
        const matches = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
            });

            if (match[0].length === 0) {
                regex.lastIndex += 1;
            }
        }

        return matches;
    };

    const selectSearchMatch = (index, matches = searchMatches) => {
        if (!searchApi || !matches.length) return;

        const nextIndex = (index + matches.length) % matches.length;
        const match = matches[nextIndex];

        searchApi.textArea.focus();
        searchApi.setSelectionRange({
            start: match.start,
            end: match.end,
        });

        setSearchMatchIndex(nextIndex);
    };

    const refreshSearchMatches = (keyword = searchText) => {
        const text = searchApi?.textArea?.value ?? content;
        const matches = getSearchMatches(text, keyword);

        setSearchMatches(matches);

        if (!matches.length) {
            setSearchMatchIndex(-1);
            return matches;
        }

        const selectionEnd = searchApi?.textArea?.selectionEnd ?? 0;
        const nextIndex = Math.max(0, matches.findIndex((match) => match.end >= selectionEnd));

        setSearchMatchIndex(nextIndex);
        return matches;
    };

    const findSearchMatch = (direction) => {
        const matches = refreshSearchMatches();
        if (!matches.length) return;

        const currentIndex = searchMatchIndex === -1 ? 0 : searchMatchIndex;
        const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

        selectSearchMatch(nextIndex, matches);
    };

    const replaceCurrentMatch = () => {
        if (!searchApi || searchMatchIndex === -1 || !searchMatches.length) return;

        const match = searchMatches[searchMatchIndex];
        const text = searchApi.textArea.value;
        const nextText = text.slice(0, match.start) + replaceText + text.slice(match.end);
        const nextCursor = match.start + replaceText.length;

        setContent(nextText);

        requestAnimationFrame(() => {
            searchApi.textArea.focus();
            searchApi.setSelectionRange({
                start: nextCursor,
                end: nextCursor,
            });

            const matches = getSearchMatches(nextText, searchText);
            setSearchMatches(matches);

            if (matches.length) {
                const nextIndex = Math.min(searchMatchIndex, matches.length - 1);
                selectSearchMatch(nextIndex, matches);
            } else {
                setSearchMatchIndex(-1);
            }
        });
    };

    const replaceAllMatches = () => {
        if (!searchApi || !searchText) return;

        const text = searchApi.textArea.value;
        const matches = getSearchMatches(text, searchText);
        if (!matches.length) return;

        let nextText = '';
        let cursor = 0;

        matches.forEach((match) => {
            nextText += text.slice(cursor, match.start) + replaceText;
            cursor = match.end;
        });

        nextText += text.slice(cursor);
        setContent(nextText);
        setSearchMatches([]);
        setSearchMatchIndex(-1);

        requestAnimationFrame(() => {
            searchApi.textArea.focus();
        });
    };

    useEffect(() => {
        if (!searchPanelOpen) return;

        refreshSearchMatches(searchText);
    }, [content, searchText, searchCaseSensitive, searchWholeWord, searchPanelOpen]);

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
            setSearchApi(api);
            setSearchText(state.selectedText || searchText);
            setSearchPanelOpen(true);

            requestAnimationFrame(() => {
                api.textArea.focus();
            });
        },
    };

    const jumpToLine = (api, rawLine) => {
        const lineNumber = Number(rawLine);

        if (!Number.isInteger(lineNumber) || lineNumber < 1) {
            setGotoLineError('请输入有效的行号');
            return;
        }

        const lines = api.textArea.value.split('\n');
        const targetLine = Math.min(lineNumber, lines.length);
        const start = lines
            .slice(0, targetLine - 1)
            .reduce((total, line) => total + line.length + 1, 0);
        const editor = api.textArea.closest('.w-md-editor');
        const scrollArea = editor?.querySelector('.w-md-editor-area.w-md-editor-input');
        const lineHeight = Number.parseFloat(window.getComputedStyle(api.textArea).lineHeight) || 20;

        api.textArea.focus();
        api.setSelectionRange({ start, end: start });

        requestAnimationFrame(() => {
            const scrollTarget = scrollArea || api.textArea;

            scrollTarget.scrollTop = Math.max(
                0,
                (targetLine - 1) * lineHeight - scrollTarget.clientHeight / 2
            );
        });

        setGotoLineError('');
        setGotoLineOpen(false);
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
            setGotoLineApi(api);
            setGotoLineText('');
            setGotoLineError('');
            setSearchPanelOpen(false);
            setGotoLineOpen(true);
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
        execute: async (state) => {
            await saveCurrentDraft(state.text);
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

            requestAnimationFrame(() => {
                document.activeElement?.blur?.();
            });
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

            requestAnimationFrame(() => {
                document.activeElement?.blur?.();
            });
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

    const pickLocalFile = (accept) => {
        return new Promise((resolve) => {
            const input = document.createElement('input');

            input.type = 'file';
            input.accept = accept;

            input.onchange = () => {
                resolve(input.files?.[0] || null);
            };

            input.click();
        });
    };

    const uploadFile = async (file, apiPath) => {
        const token = localStorage.getItem('token');

        if (!token) {
            throw new Error('请先登录');
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(apiPath, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || '上传失败');
        }

        return data;
    };

    const escapeHtmlAttribute = (value) => String(value || '图片')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const createCenteredImageHtml = (url, alt = '??') => (
        `<div align="center">\n    <img src="${url}" alt="${escapeHtmlAttribute(alt)}" width="100%" />\n</div>`
    );

    const rememberImageInsertion = (start, text) => {
        imageInsertionsRef.current = [
            ...imageInsertionsRef.current.slice(-9),
            {
                start,
                end: start + text.length,
                text,
            },
        ];
    };

    const undoLastImageInsertion = (textarea) => {
        const last = imageInsertionsRef.current.at(-1);

        if (!last || !textarea) return false;

        const currentText = textarea.value;
        const currentSlice = currentText.slice(last.start, last.end);

        if (
            currentSlice !== last.text
            || textarea.selectionStart !== last.end
            || textarea.selectionEnd !== last.end
        ) {
            return false;
        }

        const nextText = currentText.slice(0, last.start) + currentText.slice(last.end);
        imageInsertionsRef.current = imageInsertionsRef.current.slice(0, -1);
        setContent(nextText);

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(last.start, last.start);
        });

        return true;
    };

    const insertTextWithUndo = (textarea, text, selection = null) => {
        if (!textarea || !text) return;

        const start = selection?.start ?? textarea.selectionStart;
        const end = selection?.end ?? textarea.selectionEnd;

        textarea.focus();
        textarea.setSelectionRange(start, end);

        const inserted = document.execCommand('insertText', false, text);

        if (!inserted) {
            const nextValue = textarea.value.slice(0, start) + text + textarea.value.slice(end);
            setContent(nextValue);

            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(start + text.length, start + text.length);
            });
        }

        rememberImageInsertion(start, text);
    };

    const imageCommand = {
        name: 'custom-image',
        keyCommand: 'custom-image',
        buttonProps: {
            title: '插入图片',
            'aria-label': '插入图片',
        },
        icon: commands.image.icon,
        execute: async (state, api) => {
            try {
                const file = await pickLocalFile('image/*');

                if (!file) return;

                const data = await uploadFile(file, '/api/images');
                const imageHtml = createCenteredImageHtml(data.url, file.name);

                api.replaceSelection(imageHtml);
                rememberImageInsertion(state.selection.start, imageHtml);
                } catch (error) {
                    console.error(error);
                    window.alert(error.message);
                }
        },
    };

    const videoCommand = {
        name: 'video',
        keyCommand: 'video',
        buttonProps: {
            title: '插入视频',
            'aria-label': '插入视频',
        },
        icon: icon('icon-shipin'),
        execute: async (state, api) => {

            try {
                const file = await pickLocalFile('video/*');

                if (!file) return;

                const data = await uploadFile(file, '/api/videos');

                api.replaceSelection(
                    `\n<video src="${data.url}" controls width="100%"></video>\n`
                );
            } catch (error) {
                console.error(error);
                window.alert(error.message);
            }
        },
    };


    const handleEditorPaste = async (event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return;

        const items = Array.from(clipboard.items || []);
        const files = Array.from(clipboard.files || []);

        const imageItem = items.find(
            (item) => item.kind === 'file' && item.type.startsWith('image/')
        );

        const file =
            imageItem?.getAsFile() ||
            files.find((f) => f.type.startsWith('image/'));

        if (!file) return;

        event.preventDefault();

        const textarea = event.target;
        const selection = {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
        };

        try {
            const data = await uploadFile(file, '/api/images');
            const imageHtml = createCenteredImageHtml(data.url, '??');

            insertTextWithUndo(textarea, imageHtml, selection);
        } catch (error) {
            console.error(error);
            window.alert(error.message);
        }
    };

    const handleEditorKeyDown = (event) => {
        const isSave = (event.ctrlKey || event.metaKey)
            && !event.shiftKey
            && event.key.toLowerCase() === 's';

        if (isSave) {
            event.preventDefault();
            event.stopPropagation();
            saveCurrentDraft(event.currentTarget.value);
            return;
        }

        const isUndo = (event.ctrlKey || event.metaKey)
            && !event.shiftKey
            && event.key.toLowerCase() === 'z';

        if (!isUndo) return;

        if (undoLastImageInsertion(event.currentTarget)) {
            event.preventDefault();
        }
    };



    return (
        <div className={styles.main}>

            <div className={styles.title}>
                <span className={styles.note}>标题</span>
                <input
                    ref={titleInputRef}
                    className={styles.titleInput}
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="请输入标题"
                />
            </div>

                <div className={styles.content}>
                    <div className={styles.contentNote}>
                        <div className={styles.backupHeader}>
                            <div className={styles.quickActions}>
                                <button
                                    type="button"
                                    className={styles.quickActionButton}
                                    onClick={handleNewPost}
                                >
                                    新建文章
                                </button>
                            </div>
                            {backupStatus && (
                                <span className={styles.backupStatus}>{backupStatus}</span>
                            )}
                        <button
                            type="button"
                            className={styles.backupToggle}
                            onClick={openBackupPanel}
                        >
                            自动备份
                        </button>
                    </div>
                    <span className={styles.note}>内容</span>
                </div>

                {backupPanelOpen && (
                    <div
                        className={styles.backupModalMask}
                        onClick={() => setBackupPanelOpen(false)}
                    >
                        <section
                            className={styles.backupModal}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <header className={styles.backupModalHeader}>
                                <div>
                                    <h3>自动备份</h3>
                                </div>
                                <button
                                    type="button"
                                    className={styles.backupClose}
                                    onClick={() => setBackupPanelOpen(false)}
                                    aria-label="关闭"
                                >
                                    ×
                                </button>
                            </header>

                            <div className={styles.backupModalBody}>
                                <aside className={styles.backupList}>
                                    {backupLoading && (
                                        <div className={styles.backupLoading}>读取中...</div>
                                    )}

                                    {!backupLoading && backups.map((backup) => (
                                        <button
                                            type="button"
                                            key={backup.id}
                                            className={`${styles.backupTimeItem} ${selectedBackupId === backup.id ? styles.backupTimeActive : ''}`}
                                            onClick={() => {
                                                setSelectedBackupId(backup.id);
                                                loadBackupDetail(backup.id);
                                            }}
                                        >
                                            {formatBackupTime(backup.createdAt)}
                                        </button>
                                    ))}
                                </aside>

                                <section className={styles.backupPreview}>
                                    <div className={styles.backupPanelActions}>
                                        <button
                                            type="button"
                                            className={styles.backupDelete}
                                            onClick={deleteSelectedBackup}
                                            disabled={!selectedBackupId || backupLoading || backupPreviewLoading}
                                        >
                                            删除
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.backupRestore}
                                            onClick={restoreSelectedBackup}
                                            disabled={!selectedBackupId || backupLoading || backupPreviewLoading}
                                        >
                                            还原
                                        </button>
                                    </div>

                                    <div className={styles.backupPreviewMeta}>
                                        <h4>{selectedBackup ? selectedBackupTitle || '未命名备份' : ''}</h4>
                                    </div>

                                    {backupPreviewLoading ? (
                                        <div className={styles.backupLoading}>读取中...</div>
                                    ) : (
                                        <pre className={styles.backupPreviewContent}>
                                            {selectedBackup?.content || ''}
                                        </pre>
                                    )}
                                </section>
                            </div>
                        </section>
                    </div>
                )}

                <div
                    ref={editorWrapRef}
                    className={styles.edit}
                    data-color-mode="light"
                >
                    <MDEditor
                        value={content}
                        onChange={(value) => setContent(value || '')}
                        height={560}
                        preview={previewMode}
                        previewOptions={mathPreviewOptions}
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

                            imageCommand,
                            videoCommand,
                            commands.link,
                            languageCodeBlockCommand,
                            commands.code,
                            detailsCodeCommand,
                            mathCommand,
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
                            onKeyDown: handleEditorKeyDown,
                            onClick: handleEditorClick,
                        }}
                    />

                    {previewMode !== 'preview' && lineNumberRoot && createPortal(
                        <div className={styles.lineNumberGutter} aria-hidden="true">
                            <div className={styles.lineNumbers} ref={lineNumbersRef}>
                                {lineNumbers.map((line) => (
                                    <span key={line}>{line}</span>
                                ))}
                            </div>
                        </div>,
                        lineNumberRoot
                    )}

                    {gotoLineOpen && lineNumberRoot && createPortal(
                        <form
                            className={styles.gotoLinePanel}
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (gotoLineApi) {
                                    jumpToLine(gotoLineApi, gotoLineText);
                                }
                            }}
                        >
                            <div className={styles.gotoLineHeader}>
                                <strong>跳转到行</strong>
                                <button
                                    type="button"
                                    onClick={() => setGotoLineOpen(false)}
                                    title="关闭"
                                    aria-label="关闭"
                                >
                                    ×
                                </button>
                            </div>

                            <div className={styles.gotoLineBody}>
                                <input
                                    ref={gotoLineInputRef}
                                    type="number"
                                    min="1"
                                    max={lineNumbers.length}
                                    value={gotoLineText}
                                    onChange={(event) => {
                                        setGotoLineText(event.target.value);
                                        setGotoLineError('');
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setGotoLineOpen(false);
                                        }
                                    }}
                                    placeholder={`1 - ${lineNumbers.length}`}
                                />
                                <span>共 {lineNumbers.length} 行</span>
                            </div>

                            {gotoLineError && (
                                <div className={styles.gotoLineError}>{gotoLineError}</div>
                            )}

                            <div className={styles.gotoLineFooter}>
                                <button type="button" onClick={() => setGotoLineOpen(false)}>
                                    取消
                                </button>
                                <button type="submit">
                                    跳转
                                </button>
                            </div>
                        </form>,
                        lineNumberRoot
                    )}

                    {searchPanelOpen && (
                        <div className={styles.searchPanel}>
                            <button
                                type="button"
                                className={styles.searchToggle}
                                onClick={() => setReplacePanelOpen((value) => !value)}
                                title={replacePanelOpen ? '收起替换' : '展开替换'}
                                aria-label={replacePanelOpen ? '收起替换' : '展开替换'}
                            >
                                {replacePanelOpen ? '?' : '?'}
                            </button>

                            <div className={styles.searchFields}>
                                <div className={styles.searchRow}>
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(event) => setSearchText(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                findSearchMatch(event.shiftKey ? 'prev' : 'next');
                                            }

                                            if (event.key === 'Escape') {
                                                setSearchPanelOpen(false);
                                            }
                                        }}
                                        placeholder="查找"
                                        autoFocus
                                    />

                                    <button
                                        type="button"
                                        className={searchCaseSensitive ? styles.searchOptionActive : ''}
                                        onClick={() => setSearchCaseSensitive((value) => !value)}
                                        title="区分大小写"
                                        aria-label="区分大小写"
                                    >
                                        Aa
                                    </button>

                                    <button
                                        type="button"
                                        className={searchWholeWord ? styles.searchOptionActive : ''}
                                        onClick={() => setSearchWholeWord((value) => !value)}
                                        title="全字匹配"
                                        aria-label="全字匹配"
                                    >
                                        ab
                                    </button>

                                    <span className={styles.searchCount}>
                                        {searchText ? `${searchMatches.length ? searchMatchIndex + 1 : 0} / ${searchMatches.length}` : '0 / 0'}
                                    </span>

                                    <button type="button" onClick={() => findSearchMatch('prev')} title="上一个" aria-label="上一个">
                                        ↑
                                    </button>

                                    <button type="button" onClick={() => findSearchMatch('next')} title="下一个" aria-label="下一个">
                                        ↓
                                    </button>

                                    <button type="button" onClick={() => setSearchPanelOpen(false)} title="关闭" aria-label="关闭">
                                        ×
                                    </button>
                                </div>

                                {replacePanelOpen && (
                                    <div className={styles.searchRow}>
                                        <input
                                            type="text"
                                            value={replaceText}
                                            onChange={(event) => setReplaceText(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    replaceCurrentMatch();
                                                }

                                                if (event.key === 'Escape') {
                                                    setSearchPanelOpen(false);
                                                }
                                            }}
                                            placeholder="替换"
                                        />

                                        <button type="button" onClick={replaceCurrentMatch} title="替换当前" aria-label="替换当前">
                                            AB
                                        </button>

                                        <button type="button" onClick={replaceAllMatches} title="全部替换" aria-label="全部替换">
                                            all
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
                            <MDEditor.Markdown source={content} {...mathPreviewOptions} />
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
