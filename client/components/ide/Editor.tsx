"use client";

import React from "react";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import { useProject } from "./useProjectState";

const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const StellarIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-20">
        <circle cx="12" cy="12" r="10" stroke="#FFC800" strokeWidth="1" />
        <circle cx="12" cy="12" r="6" stroke="#FFC800" strokeWidth="1" />
        <circle cx="12" cy="12" r="2" fill="#FFC800" />
    </svg>
);

export default function CodeEditor() {
    const { activeFile, updateFileContent } = useProject();
    const handleEditorWillMount = (monaco: any) => {
        if (monaco) {
            // Register Solidity language
            monaco.languages.register({ id: 'solidity' });

            // Solidity language configuration
            monaco.languages.setLanguageConfiguration('solidity', {
                comments: {
                    lineComment: '//',
                    blockComment: ['/*', '*/'],
                },
                brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    ['(', ')'],
                ],
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" },
                ],
                surroundingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" },
                ],
                folding: {
                    markers: {
                        start: /^\s*\/\/\s*#?region\b/,
                        end: /^\s*\/\/\s*#?endregion\b/,
                    },
                },
            });

            // Solidity tokenizer for syntax highlighting
            monaco.languages.setMonarchTokensProvider('solidity', {
                keywords: [
                    'pragma', 'solidity', 'import', 'as', 'from',
                    'contract', 'interface', 'library', 'is', 'struct', 'enum',
                    'function', 'constructor', 'modifier', 'event', 'error',
                    'public', 'private', 'internal', 'external', 'pure', 'view', 'payable',
                    'constant', 'immutable', 'anonymous', 'indexed', 'virtual', 'override',
                    'returns', 'return', 'if', 'else', 'for', 'while', 'do', 'break', 'continue',
                    'throw', 'emit', 'try', 'catch', 'revert', 'require', 'assert',
                    'new', 'delete', 'mapping', 'storage', 'memory', 'calldata',
                    'assembly', 'let', 'switch', 'case', 'default', 'leave',
                    'using', 'abstract', 'unchecked', 'receive', 'fallback',
                ],
                typeKeywords: [
                    'address', 'bool', 'string', 'bytes', 'byte',
                    'int', 'int8', 'int16', 'int24', 'int32', 'int40', 'int48', 'int56', 'int64',
                    'int72', 'int80', 'int88', 'int96', 'int104', 'int112', 'int120', 'int128',
                    'int136', 'int144', 'int152', 'int160', 'int168', 'int176', 'int184', 'int192',
                    'int200', 'int208', 'int216', 'int224', 'int232', 'int240', 'int248', 'int256',
                    'uint', 'uint8', 'uint16', 'uint24', 'uint32', 'uint40', 'uint48', 'uint56', 'uint64',
                    'uint72', 'uint80', 'uint88', 'uint96', 'uint104', 'uint112', 'uint120', 'uint128',
                    'uint136', 'uint144', 'uint152', 'uint160', 'uint168', 'uint176', 'uint184', 'uint192',
                    'uint200', 'uint208', 'uint216', 'uint224', 'uint232', 'uint240', 'uint248', 'uint256',
                    'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6', 'bytes7', 'bytes8',
                    'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13', 'bytes14', 'bytes15', 'bytes16',
                    'bytes17', 'bytes18', 'bytes19', 'bytes20', 'bytes21', 'bytes22', 'bytes23', 'bytes24',
                    'bytes25', 'bytes26', 'bytes27', 'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32',
                    'fixed', 'ufixed',
                ],
                operators: [
                    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
                    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
                    '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
                    '%=', '<<=', '>>=', '>>>=', '=>',
                ],
                symbols: /[=><!~?:&|+\-*\/\^%]+/,
                escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
                tokenizer: {
                    root: [
                        // SPDX License
                        [/\/\/\s*SPDX-License-Identifier:.*$/, 'comment.spdx'],

                        // Identifiers and keywords
                        [/[a-zA-Z_]\w*/, {
                            cases: {
                                '@keywords': 'keyword',
                                '@typeKeywords': 'type',
                                '@default': 'identifier',
                            },
                        }],

                        // Whitespace
                        { include: '@whitespace' },

                        // Delimiters and operators
                        [/[{}()\[\]]/, '@brackets'],
                        [/[<>](?!@symbols)/, '@brackets'],
                        [/@symbols/, {
                            cases: {
                                '@operators': 'operator',
                                '@default': '',
                            },
                        }],

                        // Numbers
                        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
                        [/\d+/, 'number'],

                        // Delimiter
                        [/[;,.]/, 'delimiter'],

                        // Strings
                        [/"([^"\\]|\\.)*$/, 'string.invalid'],
                        [/'([^'\\]|\\.)*$/, 'string.invalid'],
                        [/"/, 'string', '@string_double'],
                        [/'/, 'string', '@string_single'],
                    ],
                    whitespace: [
                        [/[ \t\r\n]+/, 'white'],
                        [/\/\*/, 'comment', '@comment'],
                        [/\/\/.*$/, 'comment'],
                    ],
                    comment: [
                        [/[^\/*]+/, 'comment'],
                        [/\/\*/, 'comment', '@push'],
                        [/\*\//, 'comment', '@pop'],
                        [/[\/*]/, 'comment'],
                    ],
                    string_double: [
                        [/[^\\"]+/, 'string'],
                        [/@escapes/, 'string.escape'],
                        [/\\./, 'string.escape.invalid'],
                        [/"/, 'string', '@pop'],
                    ],
                    string_single: [
                        [/[^\\']+/, 'string'],
                        [/@escapes/, 'string.escape'],
                        [/\\./, 'string.escape.invalid'],
                        [/'/, 'string', '@pop'],
                    ],
                },
            });

            // Solidity completions
            monaco.languages.registerCompletionItemProvider('solidity', {
                provideCompletionItems: (model, position) => {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn,
                    };

                    const suggestions = [
                        // Contract templates
                        {
                            label: 'contract',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'contract ${1:ContractName} {\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create a new contract',
                            range,
                        },
                        {
                            label: 'function',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'function ${1:name}(${2:params}) ${3:public} ${4:returns (${5:type})} {\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create a new function',
                            range,
                        },
                        {
                            label: 'constructor',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'constructor(${1:params}) {\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create a constructor',
                            range,
                        },
                        {
                            label: 'modifier',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'modifier ${1:name}(${2:params}) {\n\t${3:require(${4:condition}, "${5:error message}");}\n\t_;\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create a modifier',
                            range,
                        },
                        {
                            label: 'event',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'event ${1:EventName}(${2:params});',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create an event',
                            range,
                        },
                        {
                            label: 'require',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'require(${1:condition}, "${2:error message}");',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Require statement',
                            range,
                        },
                        {
                            label: 'mapping',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'mapping(${1:keyType} => ${2:valueType}) ${3:public} ${4:name};',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create a mapping',
                            range,
                        },
                        {
                            label: 'struct',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'struct ${1:StructName} {\n\t${2:type} ${3:field};\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create a struct',
                            range,
                        },
                        {
                            label: 'enum',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'enum ${1:EnumName} { ${2:Value1}, ${3:Value2} }',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Create an enum',
                            range,
                        },
                        // Common types
                        { label: 'uint256', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'uint256', range },
                        { label: 'address', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'address', range },
                        { label: 'bool', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'bool', range },
                        { label: 'string', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'string', range },
                        { label: 'bytes32', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'bytes32', range },
                        // Visibility
                        { label: 'public', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'public', range },
                        { label: 'private', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'private', range },
                        { label: 'internal', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'internal', range },
                        { label: 'external', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'external', range },
                        // State mutability
                        { label: 'view', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'view', range },
                        { label: 'pure', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'pure', range },
                        { label: 'payable', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'payable', range },
                    ];

                    return { suggestions };
                },
            });

            // Hover provider for documentation
            monaco.languages.registerHoverProvider('solidity', {
                provideHover: (model, position) => {
                    const word = model.getWordAtPosition(position);
                    if (!word) return null;

                    const hoverDocs: Record<string, string> = {
                        // Keywords
                        'pragma': '**pragma** - Specifies compiler version constraints',
                        'contract': '**contract** - Defines a smart contract\n\n```solidity\ncontract MyContract {\n    // state variables and functions\n}\n```',
                        'interface': '**interface** - Defines a contract interface without implementation',
                        'library': '**library** - Defines a reusable library',
                        'function': '**function** - Declares a function\n\n```solidity\nfunction name(params) visibility returns (type) {\n    // body\n}\n```',
                        'constructor': '**constructor** - Called once when contract is deployed',
                        'modifier': '**modifier** - Defines reusable function behavior modifiers',
                        'event': '**event** - Declares an event for logging',
                        'emit': '**emit** - Triggers an event',
                        'require': '**require(condition, message)** - Reverts if condition is false',
                        'revert': '**revert(message)** - Reverts the transaction',
                        'assert': '**assert(condition)** - Used for internal error checking',
                        'mapping': '**mapping(keyType => valueType)** - Hash table data structure',

                        // Visibility
                        'public': '**public** - Accessible from anywhere',
                        'private': '**private** - Only accessible within the contract',
                        'internal': '**internal** - Accessible within contract and derived contracts',
                        'external': '**external** - Only callable from outside the contract',

                        // State mutability
                        'view': '**view** - Function does not modify state',
                        'pure': '**pure** - Function does not read or modify state',
                        'payable': '**payable** - Function can receive Ether',

                        // Data locations
                        'memory': '**memory** - Temporary data location, cleared after function call',
                        'storage': '**storage** - Persistent data location on blockchain',
                        'calldata': '**calldata** - Non-modifiable, non-persistent area for function arguments',

                        // Types
                        'address': '**address** - 20-byte Ethereum address\n\nMembers: `balance`, `transfer()`, `send()`, `call()`',
                        'uint256': '**uint256** - Unsigned 256-bit integer (0 to 2²⁵⁶-1)',
                        'uint': '**uint** - Alias for uint256',
                        'int256': '**int256** - Signed 256-bit integer',
                        'int': '**int** - Alias for int256',
                        'bool': '**bool** - Boolean value (true or false)',
                        'string': '**string** - Dynamic UTF-8 encoded string',
                        'bytes': '**bytes** - Dynamic byte array',
                        'bytes32': '**bytes32** - Fixed 32-byte array',

                        // Special
                        'msg': '**msg** - Message call properties\n\n- `msg.sender` - Address of caller\n- `msg.value` - Ether sent\n- `msg.data` - Complete calldata',
                        'block': '**block** - Block properties\n\n- `block.timestamp` - Current block timestamp\n- `block.number` - Current block number',
                        'tx': '**tx** - Transaction properties\n\n- `tx.origin` - Original sender',
                        'this': '**this** - Current contract instance (converts to address)',
                    };

                    const doc = hoverDocs[word.word];
                    if (doc) {
                        return {
                            range: new monaco.Range(
                                position.lineNumber,
                                word.startColumn,
                                position.lineNumber,
                                word.endColumn
                            ),
                            contents: [{ value: doc }],
                        };
                    }

                    return null;
                },
            });

            // Define custom theme matching Stellar with comprehensive syntax highlighting
            monaco.editor.defineTheme('stellar-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    // Comments
                    { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
                    { token: 'comment.spdx', foreground: '5c6370', fontStyle: 'italic' },

                    // Keywords - Stellar Yellow
                    { token: 'keyword', foreground: 'FFC800', fontStyle: 'bold' },
                    { token: 'keyword.control', foreground: 'FFC800' },

                    // Types - Cyan/Teal
                    { token: 'type', foreground: '56D4DD' },
                    { token: 'type.identifier', foreground: '56D4DD' },

                    // Strings - Green
                    { token: 'string', foreground: '98C379' },
                    { token: 'string.escape', foreground: 'D19A66' },
                    { token: 'string.invalid', foreground: 'EF4444', fontStyle: 'underline' },

                    // Numbers - Orange
                    { token: 'number', foreground: 'D19A66' },
                    { token: 'number.float', foreground: 'D19A66' },
                    { token: 'number.hex', foreground: 'D19A66' },

                    // Functions - Blue
                    { token: 'function', foreground: '61AFEF' },
                    { token: 'function.declaration', foreground: '61AFEF', fontStyle: 'bold' },

                    // Variables - White/Light
                    { token: 'variable', foreground: 'E5E5E5' },
                    { token: 'variable.predefined', foreground: 'E06C75' },
                    { token: 'identifier', foreground: 'E5E5E5' },

                    // Operators - Light gray
                    { token: 'operator', foreground: 'ABB2BF' },
                    { token: 'delimiter', foreground: 'ABB2BF' },

                    // Brackets
                    { token: 'delimiter.bracket', foreground: 'E5E5E5' },
                    { token: '@brackets', foreground: 'E5E5E5' },

                    // Constants
                    { token: 'constant', foreground: 'D19A66' },

                    // Tags (for other languages)
                    { token: 'tag', foreground: 'E06C75' },
                    { token: 'attribute.name', foreground: 'D19A66' },
                    { token: 'attribute.value', foreground: '98C379' },

                    // Regexp
                    { token: 'regexp', foreground: '98C379' },

                    // Annotations
                    { token: 'annotation', foreground: 'C678DD' },

                    // Invalid
                    { token: 'invalid', foreground: 'EF4444', fontStyle: 'underline' },

                    // White/default
                    { token: '', foreground: 'E5E5E5' },
                ],
                colors: {
                    'editor.background': '#000000',
                    'editor.foreground': '#e0e0e0',
                    'editor.lineHighlightBackground': '#0a0a0a',
                    'editor.selectionBackground': '#FFC80030',
                    'editor.inactiveSelectionBackground': '#FFC80015',
                    'editorLineNumber.foreground': '#4a4a4a',
                    'editorLineNumber.activeForeground': '#FFC800',
                    'editorCursor.foreground': '#FFC800',
                    'editor.wordHighlightBackground': '#FFC80020',
                    'editorBracketMatch.background': '#FFC80030',
                    'editorBracketMatch.border': '#FFC80050',
                    'scrollbarSlider.background': '#2a2a2a80',
                    'scrollbarSlider.hoverBackground': '#3a3a3a80',
                    'scrollbarSlider.activeBackground': '#4a4a4a80',
                    'minimap.background': '#0a0a0a',
                    'minimap.selectionHighlight': '#FFC80050',
                    'minimap.errorHighlight': '#EF444480',
                    'minimap.warningHighlight': '#F59E0B80',
                    'minimap.findMatchHighlight': '#FFC80060',
                    'minimapSlider.background': '#FFC80020',
                    'minimapSlider.hoverBackground': '#FFC80040',
                    'minimapSlider.activeBackground': '#FFC80060',
                    'minimapGutter.addedBackground': '#22C55E',
                    'minimapGutter.modifiedBackground': '#FFC800',
                    'minimapGutter.deletedBackground': '#EF4444',
                    'editorGutter.background': '#000000',
                    'editorIndentGuide.background': '#111111',
                    'editorIndentGuide.activeBackground': '#222222',
                }
            });
        }
    };

    if (!activeFile) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 bg-[#000000] flex items-center justify-center relative overflow-hidden"
            >
                {/* Background grid pattern */}
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, #FFC800 1px, transparent 1px),
                            linear-gradient(to bottom, #FFC800 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px'
                    }}
                />

                {/* Glowing orb */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#FFC800]/5 blur-[100px]" />

                <motion.div
                    className="text-center relative z-10"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <motion.div
                        className="mb-6"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                        <StellarIcon />
                    </motion.div>
                    <h3 className="text-xl font-semibold text-white mb-2">Select a file to start editing</h3>
                    <p className="text-sm text-[#4a4a4a]">Choose a file from the explorer on the left</p>

                    {/* Keyboard shortcuts hint */}
                    <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-[#4a4a4a]">
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">Cmd</kbd>
                            <span>+</span>
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">P</kbd>
                            <span className="ml-1">Quick Open</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">Cmd</kbd>
                            <span>+</span>
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">S</kbd>
                            <span className="ml-1">Save</span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        );
    }

    const getFileExtColor = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        const colors: Record<string, string> = {
            sol: "#FFC800",
            rs: "#DEA584",
            ts: "#3178C6",
            tsx: "#3178C6",
            js: "#F7DF1E",
            jsx: "#F7DF1E",
            json: "#6D6D6D",
            md: "#519ABA",
            toml: "#9C4121",
            yaml: "#CB171E",
            yml: "#CB171E",
            css: "#264DE4",
            html: "#E44D26",
        };
        return colors[ext || ''] || '#808080';
    };

    const getLanguageFromFile = (name: string, type: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        // Only support Solidity syntax highlighting
        if (ext === 'sol' || type === 'solidity') {
            return 'solidity';
        }
        return 'plaintext';
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 h-full overflow-hidden bg-[#000000] flex flex-col"
        >
            {/* Tab Bar */}
            <div className="h-[40px] bg-[#050505] flex items-end overflow-x-auto select-none border-b border-[#1a1a1a]">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-[40px] px-4 min-w-[140px] max-w-[220px] bg-[#000000] text-white text-[13px] flex items-center justify-between gap-3 border-t-2 border-[#FFC800] border-r border-r-[#1a1a1a] group"
                >
                    <span className="flex items-center gap-2 truncate">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getFileExtColor(activeFile.name) }}
                        />
                        <span className="truncate font-medium">{activeFile.name}</span>
                    </span>
                    <motion.button
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-[#4a4a4a] hover:text-white transition-all"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <CloseIcon />
                    </motion.button>
                </motion.div>

                {/* Empty tab space for visual balance */}
                <div className="flex-1 h-full border-b border-[#1a1a1a]" />
            </div>

            {/* Breadcrumb */}
            <div className="h-[28px] bg-[#000000] flex items-center px-4 text-[12px] text-[#4a4a4a] border-b border-[#111111] gap-1">
                <span className="hover:text-[#808080] cursor-pointer transition-colors">src</span>
                <span>/</span>
                <span className="text-[#808080]">{activeFile.name}</span>
            </div>

            {/* Editor */}
            <div className="flex-1 relative">
                <Editor
                    beforeMount={handleEditorWillMount}
                    height="100%"
                    defaultLanguage="solidity"
                    language={getLanguageFromFile(activeFile.name, activeFile.type)}
                    theme="stellar-dark"
                    path={activeFile.name}
                    value={activeFile.content}
                    onChange={(value) => updateFileContent(activeFile.id, value || "")}
                    options={{
                        minimap: {
                            enabled: true,
                            scale: 1,
                            size: "fill",
                            maxColumn: 120,
                            renderCharacters: false,
                            showSlider: "mouseover",
                            side: "right",
                            autohide: false,
                        },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
                        fontLigatures: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                        lineNumbers: "on",
                        glyphMargin: true,
                        folding: true,
                        lineDecorationsWidth: 8,
                        lineNumbersMinChars: 4,
                        roundedSelection: true,
                        renderLineHighlight: "line",
                        overviewRulerBorder: false,
                        hideCursorInOverviewRuler: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        smoothScrolling: true,
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        guides: {
                            indentation: true,
                            bracketPairs: true,
                        },
                        scrollbar: {
                            vertical: "auto",
                            horizontal: "auto",
                            useShadows: false,
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10,
                        },
                    }}
                    loading={
                        <div className="flex-1 bg-[#000000] flex items-center justify-center">
                            <motion.div
                                className="w-8 h-8 rounded-full border-2 border-[#FFC800] border-t-transparent"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            />
                        </div>
                    }
                />
            </div>
        </motion.div>
    );
}
